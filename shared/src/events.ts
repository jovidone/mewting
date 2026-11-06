import type { z } from 'zod';
import type { chatMessageSchema, chatSendSchema, directionSchema, errorSchema, inputSchema, joinSchema, joinedSchema, playerSchema,
  preferencesSchema, presenceSchema, roomEntrySchema, roomJoinSchema, snapshotSchema } from './protocol.js';

export type PlayerSnapshot = z.infer<typeof playerSchema>;
export type RoomSnapshot = z.infer<typeof snapshotSchema>;
export type Presence = z.infer<typeof presenceSchema>;
export type SessionJoined = z.infer<typeof joinedSchema>;
export type RoomEntry = z.infer<typeof roomEntrySchema>;
export type ProtocolError = z.infer<typeof errorSchema>;
export type EventResult<T> = { ok: true; data: T } | { ok: false; error: ProtocolError };
export type Acknowledge<T> = (result: EventResult<T>) => void;
export type Direction = z.infer<typeof directionSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export interface ClientToServerEvents {
  'chat:send': (payload: z.infer<typeof chatSendSchema>, acknowledge: Acknowledge<ChatMessage>) => void;
  'session:join': (payload: z.infer<typeof joinSchema>, acknowledge: Acknowledge<SessionJoined>) => void;
  'player:input': (payload: z.infer<typeof inputSchema>) => void;
  'profile:update': (payload: z.infer<typeof preferencesSchema>, acknowledge: Acknowledge<PlayerSnapshot>) => void;
  'room:join': (payload: z.infer<typeof roomJoinSchema>, acknowledge: Acknowledge<RoomEntry>) => void;
}

export interface ServerToClientEvents {
  'chat:message': (message: ChatMessage) => void;
  'room:snapshot': (snapshot: RoomSnapshot) => void;
  'room:presence': (counts: Presence) => void;
  'session:error': (error: ProtocolError) => void;
  'session:replaced': () => void;
}

