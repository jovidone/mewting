import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { attachRealtime, type RealtimeOptions } from './realtime.js';
import { registerVoice, type VoiceConfig } from './voice.js';

interface AppOptions extends RealtimeOptions {
  serveFrontend?: boolean;
  voice?: VoiceConfig;
}

const localOptions: AppOptions = {
  allowedOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000'],
};

export function buildApp(logger = false, options: AppOptions = localOptions) {
  const app = Fastify({ logger });
  const realtime = attachRealtime(app.server, options);
  registerVoice(app, realtime, options.allowedOrigins, options.voice);
  app.addHook('preClose', async () => { await realtime.close(); });
  if (options.serveFrontend) {
    app.register(fastifyStatic, {
      root: fileURLToPath(new URL('../../frontend/dist/', import.meta.url)),
      wildcard: false,
    });
  } else app.get('/health', async () => ({
    status: 'ok', application: 'mewting', milestone: 2, mode: 'multiplayer',
  }));
  return app;
}

