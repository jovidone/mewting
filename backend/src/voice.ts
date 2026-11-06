import type { FastifyInstance } from 'fastify';
import { AccessToken, TrackSource } from 'livekit-server-sdk';
import { roomIdSchema } from '@mewting/shared';
import { z } from 'zod';
import type { attachRealtime } from './realtime.js';

export const voiceConfigSchema = z.object({
  LIVEKIT_URL: z.url({ protocol: /^wss?$/ }),
  LIVEKIT_API_KEY: z.string().trim().min(1),
  LIVEKIT_API_SECRET: z.string().trim().min(1),
});
export type VoiceConfig = z.infer<typeof voiceConfigSchema>;

const requestSchema = z.object({ roomId: roomIdSchema, membershipVersion: z.number().int().positive() }).strict();
const bearer = z.string().regex(/^Bearer [a-f0-9]{64}$/);

export function registerVoice(app: FastifyInstance, realtime: ReturnType<typeof attachRealtime>,
  allowedOrigins: string[], config?: VoiceConfig) {
  app.post('/voice/token', { bodyLimit: 1024 }, async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    if (request.headers.origin && !allowedOrigins.includes(request.headers.origin)) {
      return reply.code(403).send({ error: 'Voice origin is not allowed.' });
    }
    const body = requestSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: 'Invalid voice room request.' });
    const auth = bearer.safeParse(request.headers.authorization);
    if (!auth.success) return reply.code(401).send({ error: 'Join a room before connecting to voice.' });
    const { roomId, membershipVersion } = body.data;
    const result = realtime.authorizeVoice(auth.data.slice(7), roomId, membershipVersion);
    if (result.status === 403) return reply.code(403).send({ error: 'Your room membership has changed.' });
    if (result.status === 429) return reply.code(429).send({ error: 'Please wait before retrying voice.' });
    if (!config) return reply.code(503).send({ error: 'Voice is not configured on this server.' });

    try {
      const token = new AccessToken(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET, {
        identity: result.player.id, name: result.player.nickname, ttl: '90s',
      });
      token.addGrant({ roomJoin: true, room: `mewting-${roomId}`, canSubscribe: true,
        canPublish: true, canPublishSources: [TrackSource.MICROPHONE], canPublishData: false });
      return { url: config.LIVEKIT_URL, token: await token.toJwt() };
    } catch {
      request.log.warn('LiveKit token generation failed');
      return reply.code(503).send({ error: 'Voice could not issue a connection token.' });
    }
  });
}
