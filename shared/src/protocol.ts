import { z } from 'zod';
import { CAT_COLORS, nicknameError } from './identity.js';
import { ROOM_IDS, WALK_BOUNDS } from './rooms.js';

export const INPUT_INTERVAL_MS = 50;
export const INPUT_TIMEOUT_MS = 300;
export const MAX_PLAYERS = 50;
export const roomIdSchema = z.enum(ROOM_IDS);
export const preferencesSchema = z.object({
  nickname: z.string().max(80).refine((value) => nicknameError(value) === null, 'Use a nickname of 1–20 visible characters.').transform((value) => value.trim()),
  color: z.enum(CAT_COLORS.map((color) => color.id)),
}).strict();
export const directionSchema = z.object({ x: z.number().int().min(-1).max(1), y: z.number().int().min(-1).max(1) }).strict();
export const inputSchema = z.object({
  sequence: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  membershipVersion: z.number().int().min(1), direction: directionSchema,
}).strict();
export const joinSchema = preferencesSchema.extend({
  roomId: roomIdSchema.optional(), resumeToken: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict();
export const roomJoinSchema = z.object({ roomId: roomIdSchema }).strict();
export const playerSchema = preferencesSchema.extend({
  id: z.uuid(), roomId: roomIdSchema,
  position: z.object({ x: z.number().min(WALK_BOUNDS.left).max(WALK_BOUNDS.right), y: z.number().min(WALK_BOUNDS.top).max(WALK_BOUNDS.bottom) }).strict(),
  direction: directionSchema, membershipVersion: z.number().int().min(1), lastInputSequence: z.number().int().nonnegative(),
}).strict();
export const presenceSchema = z.object({
  lobby: z.number().int().nonnegative(), pawffice: z.number().int().nonnegative(),
  'mewting-room': z.number().int().nonnegative(), catfe: z.number().int().nonnegative(), 'catnap-corner': z.number().int().nonnegative(),
}).strict();
export const snapshotSchema = z.object({
  roomId: roomIdSchema, revision: z.number().int().nonnegative(), players: z.array(playerSchema).max(MAX_PLAYERS),
}).strict().refine((snapshot) => snapshot.players.every((player) => player.roomId === snapshot.roomId)
  && new Set(snapshot.players.map((player) => player.id)).size === snapshot.players.length);
export const CHAT_LIMIT = 500;
export const CHAT_HISTORY_LIMIT = 100;
const chatTextSchema = z.string().max(CHAT_LIMIT).trim().min(1);
export const chatSendSchema = z.object({
  text: chatTextSchema,
  membershipVersion: z.number().int().min(1),
}).strict();
export const chatMessageSchema = z.object({
  id: z.uuid(),
  roomId: roomIdSchema,
  senderId: z.uuid(),
  nickname: preferencesSchema.shape.nickname,
  text: chatTextSchema,
  sentAt: z.number().int().nonnegative().max(8.64e15),
}).strict();
export const roomEntrySchema = z.object({
  membershipVersion: z.number().int().min(1),
  snapshot: snapshotSchema,
  history: z.array(chatMessageSchema).max(CHAT_HISTORY_LIMIT),
}).strict();
export const joinedSchema = roomEntrySchema.extend({
  playerId: z.uuid(), resumeToken: z.string().regex(/^[a-f0-9]{64}$/), counts: presenceSchema,
}).strict().refine((joined) => joined.snapshot.players.some((player) => player.id === joined.playerId && player.membershipVersion === joined.membershipVersion));
export const errorSchema = z.object({
  code: z.enum(['INVALID_INPUT', 'NOT_JOINED', 'RATE_LIMITED', 'SESSION_EXPIRED', 'SERVER_FULL']), message: z.string().max(240),
}).strict();
export const resultSchema = <T extends z.ZodType>(data: T) => z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), data }).strict(), z.object({ ok: z.literal(false), error: errorSchema }).strict(),
]);
