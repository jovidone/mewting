import assert from 'node:assert/strict';
import test from 'node:test';
import { buildApp } from '../backend/src/app.js';

test('backend exposes multiplayer health without a voice endpoint', async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: 'ok', application: 'mewting', milestone: 2, mode: 'multiplayer' });
    assert.equal((await app.inject({ method: 'GET', url: '/voice/token' })).statusCode, 404);
  } finally {
    await app.close();
  }
});
