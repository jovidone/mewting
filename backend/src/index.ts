import { z } from 'zod';
import { buildApp } from './app.js';
import { voiceConfigSchema } from './voice.js';

const result = z.object({
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  PUBLIC_APP_URL: z.string().trim().pipe(z.union([
    z.literal(''),
    z.url().refine((value) => {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password
        && url.pathname === '/' && !url.search && !url.hash;
    }).transform((value) => new URL(value).origin),
  ])).default(''),
}).safeParse(process.env);

if (!result.success) {
  console.error('Invalid backend configuration. Check HOST, PORT, and PUBLIC_APP_URL (an HTTPS origin or empty).');
  process.exitCode = 1;
} else {
  const { PORT, PUBLIC_APP_URL } = result.data;
  const voice = voiceConfigSchema.safeParse(process.env);
  const voiceConfig = voice.success && (!PUBLIC_APP_URL || new URL(voice.data.LIVEKIT_URL).protocol === 'wss:')
    ? voice.data : undefined;
  if (!voiceConfig) console.warn('Voice disabled. Configure all LiveKit variables and use WSS for public access.');
  const app = buildApp(true, {
    allowedOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173',
      `http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`,
      ...(PUBLIC_APP_URL ? [PUBLIC_APP_URL] : [])],
    serveFrontend: Boolean(PUBLIC_APP_URL),
    voice: voiceConfig,
  });
  const shutdown = async () => {
    try {
      await app.close();
    } catch (error) {
      app.log.error(error);
      process.exitCode = 1;
    }
  };
  process.once('SIGINT', () => { void shutdown(); });
  process.once('SIGTERM', () => { void shutdown(); });
  try {
    await app.listen({ host: result.data.HOST, port: result.data.PORT });
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
}

