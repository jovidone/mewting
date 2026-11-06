import { io, type Socket } from 'socket.io-client';
import {
  CHAT_HISTORY_LIMIT, chatMessageSchema, type ChatMessage,
  INPUT_INTERVAL_MS, errorSchema, joinedSchema, playerSchema, presenceSchema, resultSchema, roomEntrySchema, snapshotSchema,
  type ClientToServerEvents, type Direction, type LocalPlayer, type PlayerPreferences, type Presence,
  type RoomId, type RoomSnapshot, type ServerToClientEvents,
} from '@mewting/shared';

export type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'replaced';
const emptyCounts = (): Presence => ({ lobby: 0, pawffice: 0, 'mewting-room': 0, catfe: 0, 'catnap-corner': 0 });
export interface MultiplayerState {
  status: ConnectionStatus;
  self: LocalPlayer | null;
  roomId: RoomId;
  players: LocalPlayer[];
  counts: Presence;
  transitioning: boolean;
  error: string | null;
  messages: ChatMessage[];
  receivedMessages: number;
}
export interface SceneState {
  connected: boolean;
  playerId: string | null;
  membershipVersion: number;
  snapshot: RoomSnapshot | null;
}

/** Transport and high-frequency snapshots stay outside React's render loop. */
export class RealtimeClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private state: MultiplayerState = { status: 'idle', self: null, roomId: 'lobby', players: [], counts: emptyCounts(), transitioning: false, error: null, messages: [], receivedMessages: 0 };
  private listeners = new Set<() => void>();
  private sceneListeners = new Set<() => void>();
  private chatListeners = new Set<(message: ChatMessage) => void>();
  private scene: RoomSnapshot | null = null;
  private resumeToken: string | undefined;
  private preferences: PlayerPreferences | null = null;
  private membershipVersion = 0;
  private sequence = 0;
  private rosterKey = '';
  private input: Direction = { x: 0, y: 0 };
  private sentInput: Direction = { x: 0, y: 0 };
  private sentAt = 0;
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  private generation = 0;

  constructor(private readonly endpoint?: string) {}
  getState = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  subscribeScene = (listener: () => void) => { this.sceneListeners.add(listener); return () => { this.sceneListeners.delete(listener); }; };
  subscribeLiveChat = (listener: (message: ChatMessage) => void) => {
    this.chatListeners.add(listener);
    return () => { this.chatListeners.delete(listener); };
  };
  getScene = (): SceneState => ({ connected: this.state.status === 'online', playerId: this.state.self?.id ?? null, membershipVersion: this.membershipVersion, snapshot: this.scene });
  private update(patch: Partial<MultiplayerState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach((listener) => listener()); }
  private notifyScene() { this.sceneListeners.forEach((listener) => listener()); }

  start(preferences: PlayerPreferences, roomId: RoomId = 'lobby') {
    this.dispose();
    this.preferences = preferences;
    this.update({ self: { ...preferences, id: crypto.randomUUID() }, roomId, status: 'connecting', error: null, messages: [], receivedMessages: 0 });
    const socket = io(this.endpoint, { autoConnect: false, transports: ['websocket', 'polling'], tryAllTransports: true,
      reconnection: true, reconnectionDelay: 500, reconnectionDelayMax: 5000, timeout: 5000 });
    this.socket = socket;
    socket.on('connect', () => {
      this.update({ status: 'connecting' });
      void this.join(socket);
    });
    socket.on('connect_error', () => this.disconnected('Cannot reach the host. Retrying automatically…'));
    socket.on('disconnect', (reason) => {
      if (this.state.status !== 'replaced') this.disconnected(reason === 'io server disconnect'
        ? 'The host ended this connection. Select Reconnect to try again.' : 'Connection lost. Your cat will rejoin automatically.');
    });
    socket.on('session:replaced', () => {
      this.resumeToken = undefined;
      this.disconnected('This session was opened elsewhere. Reconnect to join as a new cat.', 'replaced');
    });
    socket.on('room:snapshot', (value) => {
      const parsed = snapshotSchema.safeParse(value);
      if (!parsed.success || this.state.status !== 'online') return;
      this.acceptSnapshot(parsed.data);
    });
    socket.on('room:presence', (value) => {
      const parsed = presenceSchema.safeParse(value);
      if (parsed.success && this.state.status === 'online') this.update({ counts: parsed.data });
    });
    socket.on('chat:message', (value) => {
      const parsed = chatMessageSchema.safeParse(value);
      if (parsed.success && this.state.status === 'online') this.appendMessage(parsed.data);
    });
    socket.on('session:error', (value) => {
      const parsed = errorSchema.safeParse(value);
      if (parsed.success) this.update({ error: parsed.data.message });
    });
    this.heartbeat = setInterval(() => {
      if (this.input.x || this.input.y || this.sentInput.x || this.sentInput.y) this.sendInput();
    }, INPUT_INTERVAL_MS);
    socket.connect();
  }

  private async join(socket: Socket<ServerToClientEvents, ClientToServerEvents>) {
    const generation = ++this.generation;
    if (!this.preferences) return;
    try {
      const response: unknown = await socket.timeout(5000).emitWithAck('session:join', {
        ...this.preferences, roomId: this.state.roomId, ...(this.resumeToken ? { resumeToken: this.resumeToken } : {}),
      });
      if (generation !== this.generation || socket !== this.socket || !socket.connected) return;
      const parsed = resultSchema(joinedSchema).safeParse(response);
      if (!parsed.success) { this.disconnected('The host sent an invalid session. Please reconnect.'); return; }
      if (!parsed.data.ok) { this.disconnected(parsed.data.error.message); return; }
      const joined = parsed.data.data;
      this.resumeToken = joined.resumeToken;
      this.membershipVersion = joined.membershipVersion;
      this.sequence = 0; this.input = { x: 0, y: 0 }; this.sentInput = { x: 0, y: 0 };
      this.scene = null; this.rosterKey = '';
      const self = joined.snapshot.players.find((player) => player.id === joined.playerId)!;
      this.update({ status: 'online', self, roomId: joined.snapshot.roomId, counts: joined.counts,
        transitioning: false, error: null, ...this.loadHistory(joined.snapshot.roomId, joined.history) });
      this.acceptSnapshot(joined.snapshot);
    } catch {
      if (generation === this.generation && socket === this.socket) {
        this.disconnected('The host did not answer. Select Reconnect to try again.');
        socket.disconnect();
      }
    }
  }

  private acceptSnapshot(snapshot: RoomSnapshot) {
    const self = snapshot.players.find((player) => player.id === this.state.self?.id);
    if (snapshot.roomId !== this.state.roomId || !self || self.membershipVersion !== this.membershipVersion
      || (this.scene && snapshot.revision < this.scene.revision)) return;
    this.scene = snapshot;
    const players = snapshot.players.map(({ id, nickname, color }) => ({ id, nickname, color }));
    const key = JSON.stringify(players);
    if (key !== this.rosterKey) { this.rosterKey = key; this.update({ players, self: { id: self.id, nickname: self.nickname, color: self.color } }); }
    this.notifyScene();
  }

  private disconnected(error: string, status: ConnectionStatus = 'reconnecting') {
    ++this.generation;
    this.input = { x: 0, y: 0 }; this.sentInput = { x: 0, y: 0 }; this.scene = null; this.rosterKey = '';
    this.update({ status, players: [], counts: emptyCounts(), transitioning: false, error });
    this.notifyScene();
  }

  setInput = (input: Direction) => {
    if (this.input.x === input.x && this.input.y === input.y) return;
    this.input = { ...input };
    if ((!input.x && !input.y) || performance.now() - this.sentAt >= INPUT_INTERVAL_MS) this.sendInput();
  };
  private sendInput() {
    if (!this.socket?.connected || this.state.status !== 'online' || this.state.transitioning) return;
    this.socket.volatile.emit('player:input', { sequence: ++this.sequence, membershipVersion: this.membershipVersion, direction: this.input });
    this.sentInput = { ...this.input }; this.sentAt = performance.now();
  }

  async changeRoom(roomId: RoomId): Promise<boolean> {
    const socket = this.socket;
    if (this.state.status === 'connecting' || this.state.transitioning) return false;
    if (!socket?.connected || this.state.status !== 'online') {
      if (roomId !== this.state.roomId) this.update({ roomId, messages: [], receivedMessages: 0 });
      return true;
    }
    if (this.state.roomId === roomId) return true;
    this.setInput({ x: 0, y: 0 });
    const generation = this.generation;
    this.update({ transitioning: true, error: null });
    try {
      const response: unknown = await socket.timeout(5000).emitWithAck('room:join', { roomId });
      if (generation !== this.generation) return false;
      const parsed = resultSchema(roomEntrySchema).safeParse(response);
      if (!parsed.success) throw new Error('Invalid room response');
      if (!parsed.data.ok) { this.update({ transitioning: false, error: parsed.data.error.message }); return false; }
      const entry = parsed.data.data;
      this.membershipVersion = entry.membershipVersion; this.scene = null;
      this.update({ roomId: entry.snapshot.roomId, transitioning: false,
        ...this.loadHistory(entry.snapshot.roomId, entry.history) });
      this.acceptSnapshot(entry.snapshot);
      return true;
    } catch {
      if (generation === this.generation) this.retry(); // Resolve an uncertain transition from server state.
      return false;
    }
  }

  private loadHistory(roomId: RoomId, history: ChatMessage[]) {
    const messages = [...new Map(history.filter((message) => message.roomId === roomId)
      .map((message) => [message.id, message])).values()];
    if (roomId !== this.state.roomId) return { messages, receivedMessages: 0 };
    const lastId = this.state.messages.at(-1)?.id;
    const lastIndex = messages.findIndex((message) => message.id === lastId);
    const missed = lastIndex >= 0 ? messages.slice(lastIndex + 1) : [];
    return { messages, receivedMessages: this.state.receivedMessages +
      missed.filter((message) => message.senderId !== this.state.self?.id).length };
  }

  private appendMessage(message: ChatMessage) {
    const { roomId, messages, self, receivedMessages } = this.state;
    if (message.roomId !== roomId || messages.some(({ id }) => id === message.id)) return;
    this.update({ messages: [...messages, message].slice(-CHAT_HISTORY_LIMIT),
      receivedMessages: receivedMessages + Number(message.senderId !== self?.id) });
    this.chatListeners.forEach((listener) => listener(message));
  }

  sendChat = async (text: string): Promise<string | null> => {
    const socket = this.socket;
    if (!socket?.connected || this.state.status !== 'online' || this.state.transitioning) {
      return 'Connect to a room before sending.';
    }
    const membershipVersion = this.membershipVersion;
    const generation = this.generation;
    try {
      const response: unknown = await socket.timeout(5000).emitWithAck('chat:send', { text, membershipVersion });
      const parsed = resultSchema(chatMessageSchema).safeParse(response);
      if (!parsed.success) return 'The host returned an invalid response.';
      if (!parsed.data.ok) return parsed.data.error.message;
      if (generation === this.generation && membershipVersion === this.membershipVersion) {
        this.appendMessage(parsed.data.data);
      }
      return null;
    } catch {
      return 'Delivery could not be confirmed. Check the history before sending again.';
    }
  };

  async updateProfile(preferences: PlayerPreferences): Promise<boolean> {
    const socket = this.socket;
    if (!socket?.connected || this.state.status !== 'online') {
      this.preferences = preferences;
      if (this.state.self) this.update({ self: { ...this.state.self, ...preferences } });
      return true;
    }
    const generation = this.generation;
    try {
      const response: unknown = await socket.timeout(5000).emitWithAck('profile:update', preferences);
      if (generation !== this.generation) return false;
      const parsed = resultSchema(playerSchema).safeParse(response);
      if (!parsed.success) throw new Error('Invalid profile response');
      if (!parsed.data.ok) { this.update({ error: parsed.data.error.message }); return false; }
      this.preferences = preferences;
      this.update({ self: parsed.data.data, error: null });
      return true;
    } catch {
      if (generation === this.generation) this.update({ error: 'Your changes could not be confirmed. Please try saving again.' });
      return false;
    }
  }

  retry = () => {
    if (!this.socket || !this.preferences) return;
    this.socket.disconnect();
    this.update({ status: 'connecting', error: null });
    this.socket.connect();
  };
  dispose() {
    ++this.generation;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = undefined;
    this.socket?.removeAllListeners(); this.socket?.disconnect(); this.socket = null;
    this.scene = null;
  }
}
