import assert from 'node:assert/strict';
import test from 'node:test';
import { io } from 'socket.io-client';
import { buildApp } from '../backend/src/app.js';

test('chat rejects invalid payloads, room spoofing, and bursts', async () => {
  const app = buildApp();
  const origin = await app.listen({ host: '127.0.0.1', port: 0 });
  const socket = io(origin, { autoConnect: false, reconnection: false, transports: ['websocket'] });
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
      socket.connect();
    });
    const send = (payload: unknown) => socket.timeout(2000).emitWithAck('chat:send', payload);
    assert.equal((await send({ text: 'Hello', membershipVersion: 1 })).error.code, 'NOT_JOINED');
    const joined = await socket.timeout(2000).emitWithAck('session:join', { nickname: 'Pip', color: 'sage' });
    assert.equal(joined.ok, true);
    const { membershipVersion } = joined.data;
    for (const payload of [
      { text: '   ', membershipVersion },
      { text: 'a'.repeat(501), membershipVersion },
      { text: 'Hello', roomId: 'catfe', membershipVersion },
    ]) assert.equal((await send(payload)).error.code, 'INVALID_INPUT');
    assert.equal((await send({ text: 'Hello', membershipVersion: membershipVersion + 1 })).error.code, 'NOT_JOINED');
    const accepted = await send({ text: 'a'.repeat(500), membershipVersion });
    assert.equal(accepted.ok, true);
    assert.equal(accepted.data.nickname, 'Pip');
    assert.equal(accepted.data.roomId, 'lobby');
    assert.equal((await send({ text: 'Too fast', membershipVersion })).error.code, 'RATE_LIMITED');
  } finally {
    socket.disconnect();
    await app.close();
  }
});
