import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../backend/src/app.js';

test('backend exposes multiplayer health and requires a session for voice tokens', async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: 'ok', application: 'mewting', milestone: 2, mode: 'multiplayer' });
    const voice = await app.inject({ method: 'POST', url: '/voice/token', payload: { roomId: 'lobby', membershipVersion: 1 } });
    assert.equal(voice.statusCode, 401);
  } finally {
    await app.close();
  }
});
