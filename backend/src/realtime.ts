import { randomBytes, randomUUID } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import {
  CHAT_HISTORY_LIMIT, INPUT_TIMEOUT_MS, MAX_PLAYERS, ROOMS, advancePosition, chatSendSchema, getRoom, inputSchema, joinSchema,
  type ChatMessage,
  preferencesSchema, roomJoinSchema, type Acknowledge, type ClientToServerEvents, type PlayerSnapshot,
  type Presence, type ProtocolError, type RoomId, type RoomSnapshot, type ServerToClientEvents,
} from '@mewting/shared';
import { RateLimit } from './rate-limit.js';

interface SocketData { playerId?: string }
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
interface Session {
  player: PlayerSnapshot;
  token: string;
  socketId: string | null;
  expires: number;
  lastInput: number;
  movementLimit: RateLimit;
  actionLimit: RateLimit;
  chatLimit: RateLimit;
}
export interface RealtimeOptions { allowedOrigins: string[]; sessionGraceMs?: number }
const roomChannel = (id: RoomId) => `room:${id}`;

export function attachRealtime(server: HttpServer, options: RealtimeOptions) {
  const allowed = new Set(options.allowedOrigins);
  const originAllowed = (origin: string | undefined) => !origin || allowed.has(origin);
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(server, {
    serveClient: false, maxHttpBufferSize: 8192, pingInterval: 10000, pingTimeout: 5000,
    cors: { origin: (origin, callback) => callback(null, originAllowed(origin)), methods: ['GET', 'POST'] },
    // CORS alone does not protect a WebSocket handshake.
    allowRequest: (request, callback) => callback(null, originAllowed(request.headers.origin)),
  });
  const sessions = new Map<string, Session>();
  const chatHistory = new Map<RoomId, ChatMessage[]>();
  const history = (id: RoomId) => chatHistory.get(id) ?? [];
  const tokens = new Map<string, string>();
  const revisions = new Map<RoomId, number>(ROOMS.map((room) => [room.id, 0]));
  const dirty = new Set<RoomId>();
  const grace = options.sessionGraceMs ?? 120000;
  const touch = (room: RoomId) => { revisions.set(room, revisions.get(room)! + 1); dirty.add(room); };
  const active = () => [...sessions.values()].filter((session) => session.socketId !== null);
  const counts = (): Presence => Object.fromEntries(ROOMS.map((room) => [room.id, active().filter((session) => session.player.roomId === room.id).length])) as Presence;
  const presence = () => io.to('joined').emit('room:presence', counts());
  const snapshot = (roomId: RoomId): RoomSnapshot => ({
    roomId, revision: revisions.get(roomId)!,
    players: active().filter((session) => session.player.roomId === roomId).map((session) => ({
      ...session.player, position: { ...session.player.position }, direction: { ...session.player.direction },
    })),
  });
  const current = (socket: GameSocket) => {
    const session = socket.data.playerId ? sessions.get(socket.data.playerId) : undefined;
    return session?.socketId === socket.id ? session : undefined;
  };
  const fail = <T>(socket: GameSocket, code: ProtocolError['code'], message: string, ack?: Acknowledge<T>) => {
    const error = { code, message };
    if (typeof ack === 'function') ack({ ok: false, error });
    else socket.emit('session:error', error);
  };
  const prune = () => {
    const now = performance.now();
    for (const [id, session] of sessions) if (!session.socketId && session.expires <= now) {
      sessions.delete(id); tokens.delete(session.token);
    }
  };

  io.on('connection', (socket) => {
    if (io.of('/').sockets.size > MAX_PLAYERS * 2) { socket.disconnect(true); return; }
    const joinLimit = new RateLimit(5, 0.5);
    const unjoinedTimeout = setTimeout(() => { if (!current(socket)) socket.disconnect(true); }, 10000);
    unjoinedTimeout.unref();

    socket.on('session:join', (payload, ack) => {
      if (typeof ack !== 'function') return;
      if (!joinLimit.take()) { fail(socket, 'RATE_LIMITED', 'Please wait before joining again.', ack); return; }
      const parsed = joinSchema.safeParse(payload);
      if (!parsed.success) { fail(socket, 'INVALID_INPUT', 'Choose a valid nickname, coat, and room.', ack); return; }
      prune();
      let session = current(socket);
      if (!session && parsed.data.resumeToken) {
        const id = tokens.get(parsed.data.resumeToken);
        session = id ? sessions.get(id) : undefined;
      }
      if (!session) {
        if (active().length >= MAX_PLAYERS || sessions.size >= 500) {
          fail(socket, 'SERVER_FULL', 'This little world is full. Please try again shortly.', ack); return;
        }
        const roomId = parsed.data.roomId ?? 'lobby';
        session = {
          token: randomBytes(32).toString('hex'), socketId: null, expires: Infinity,
          player: { id: randomUUID(), nickname: parsed.data.nickname, color: parsed.data.color, roomId,
            position: { ...getRoom(roomId).spawn }, direction: { x: 0, y: 0 }, membershipVersion: 0, lastInputSequence: 0 },
          lastInput: 0, movementLimit: new RateLimit(40, 30), actionLimit: new RateLimit(5, 1),
          chatLimit: new RateLimit(5, 1),
        };
        sessions.set(session.player.id, session);
        tokens.set(session.token, session.player.id);
      }
      if (session.socketId !== socket.id) {
        if (!session.socketId && active().length >= MAX_PLAYERS) {
          fail(socket, 'SERVER_FULL', 'This little world is full. Please try again shortly.', ack); return;
        }
        if (session.socketId) {
          const oldSocket = io.sockets.sockets.get(session.socketId);
          // Detach first: the old socket cannot remove the new owner on disconnect.
          session.socketId = null;
          oldSocket?.emit('session:replaced'); oldSocket?.disconnect(true);
        }
        session.player.membershipVersion += 1;
        session.player.lastInputSequence = 0;
        session.player.direction = { x: 0, y: 0 };
      }
      session.socketId = socket.id; session.expires = Infinity;
      session.player.nickname = parsed.data.nickname; session.player.color = parsed.data.color;
      socket.data.playerId = session.player.id;
      void socket.join(['joined', roomChannel(session.player.roomId)]);
      clearTimeout(unjoinedTimeout);
      touch(session.player.roomId);
      ack({ ok: true, data: { playerId: session.player.id, resumeToken: session.token,
        membershipVersion: session.player.membershipVersion, snapshot: snapshot(session.player.roomId),
        history: history(session.player.roomId), counts: counts() } });
      presence();
    });

    socket.on('player:input', (payload) => {
      const session = current(socket);
      if (!session || !session.movementLimit.take()) return;
      const parsed = inputSchema.safeParse(payload);
      if (!parsed.success || parsed.data.membershipVersion !== session.player.membershipVersion || parsed.data.sequence <= session.player.lastInputSequence) return;
      session.player.lastInputSequence = parsed.data.sequence;
      const old = session.player.direction;
      session.player.direction = parsed.data.direction; session.lastInput = performance.now();
      if (old.x !== parsed.data.direction.x || old.y !== parsed.data.direction.y) touch(session.player.roomId);
    });

    socket.on('room:join', (payload, ack) => {
      if (typeof ack !== 'function') return;
      const session = current(socket);
      if (!session) { fail(socket, 'NOT_JOINED', 'Join the world first.', ack); return; }
      if (!session.actionLimit.take()) { fail(socket, 'RATE_LIMITED', 'Give your paws a moment before changing rooms.', ack); return; }
      const parsed = roomJoinSchema.safeParse(payload);
      if (!parsed.success) { fail(socket, 'INVALID_INPUT', 'That room does not exist.', ack); return; }
      if (parsed.data.roomId !== session.player.roomId) {
        const previous = session.player.roomId;
        void socket.leave(roomChannel(previous));
        session.player.roomId = parsed.data.roomId; session.player.position = { ...getRoom(parsed.data.roomId).spawn };
        session.player.direction = { x: 0, y: 0 }; session.player.membershipVersion += 1;
        void socket.join(roomChannel(parsed.data.roomId));
        touch(previous); touch(parsed.data.roomId); presence();
      }
      ack({ ok: true, data: { membershipVersion: session.player.membershipVersion,
        snapshot: snapshot(session.player.roomId), history: history(session.player.roomId) } });
    });

    socket.on('chat:send', (payload, ack) => {
      if (typeof ack !== 'function') return;
      const session = current(socket);
      if (!session) { fail(socket, 'NOT_JOINED', 'Join a room to send messages.', ack); return; }
      if (!session.chatLimit.take()) { fail(socket, 'RATE_LIMITED', 'Wait a moment before sending another message.', ack); return; }
      const parsed = chatSendSchema.safeParse(payload);
      if (!parsed.success) { fail(socket, 'INVALID_INPUT', 'Enter a message of 1–500 characters.', ack); return; }
      const { id, nickname, roomId, membershipVersion } = session.player;
      if (parsed.data.membershipVersion !== membershipVersion) {
        fail(socket, 'NOT_JOINED', 'The room changed. Send again when you’re ready.', ack);
        return;
      }
      const message: ChatMessage = { id: randomUUID(), senderId: id, nickname, roomId,
        text: parsed.data.text, sentAt: Date.now() };
      const messages = history(roomId);
      messages.push(message);
      if (messages.length > CHAT_HISTORY_LIMIT) messages.shift();
      chatHistory.set(roomId, messages);
      io.to(roomChannel(roomId)).emit('chat:message', message);
      ack({ ok: true, data: message });
    });

    socket.on('profile:update', (payload, ack) => {
      if (typeof ack !== 'function') return;
      const session = current(socket);
      if (!session) { fail(socket, 'NOT_JOINED', 'Reconnect before updating your cat.', ack); return; }
      if (!session.actionLimit.take()) { fail(socket, 'RATE_LIMITED', 'Please wait a moment before updating again.', ack); return; }
      const parsed = preferencesSchema.safeParse(payload);
      if (!parsed.success) { fail(socket, 'INVALID_INPUT', 'Use a valid nickname and coat.', ack); return; }
      Object.assign(session.player, parsed.data); touch(session.player.roomId);
      ack({ ok: true, data: { ...session.player } });
    });

    socket.on('disconnect', () => {
      clearTimeout(unjoinedTimeout);
      const session = current(socket);
      if (!session) return;
      session.socketId = null; session.expires = performance.now() + grace;
      session.player.direction = { x: 0, y: 0 }; touch(session.player.roomId); presence();
    });
  });

  let lastTick = performance.now();
  let lastBroadcast = lastTick;
  const ticker = setInterval(() => {
    const now = performance.now();
    const seconds = Math.min(0.05, (now - lastTick) / 1000); lastTick = now;
    for (const session of active()) {
      if (now - session.lastInput > INPUT_TIMEOUT_MS && (session.player.direction.x || session.player.direction.y)) {
        session.player.direction = { x: 0, y: 0 }; touch(session.player.roomId);
      }
      const previous = session.player.position;
      const next = advancePosition(previous, session.player.direction, seconds);
      if (next.x !== previous.x || next.y !== previous.y) { session.player.position = next; touch(session.player.roomId); }
    }
    if (now - lastBroadcast >= 50) {
      for (const id of dirty) io.to(roomChannel(id)).emit('room:snapshot', snapshot(id));
      dirty.clear(); lastBroadcast = now;
    }
    prune();
  }, 1000 / 30);
  ticker.unref();
  return { close: async () => { clearInterval(ticker); await new Promise<void>((resolve) => io.close(() => resolve())); } };
}
