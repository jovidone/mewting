import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { io } from 'socket.io-client';
import { TokenVerifier } from 'livekit-server-sdk';
import { buildApp } from '../backend/src/app.js';

test('voice tokens require current membership and grant microphone access to one room', async () => {
  const key = randomBytes(16).toString('hex');
  const secret = randomBytes(32).toString('hex');
  const url = 'wss://voice.example.test';
  const app = buildApp(false, { allowedOrigins: [], voice: {
    LIVEKIT_URL: url, LIVEKIT_API_KEY: key, LIVEKIT_API_SECRET: secret,
  } });
  const origin = await app.listen({ host: '127.0.0.1', port: 0 });
  const socket = io(origin, { autoConnect: false, reconnection: false, transports: ['websocket'] });
  try {
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
      socket.connect();
    });
    const joined = await socket.timeout(2000).emitWithAck('session:join', { nickname: 'Pip', color: 'sage' });
    assert.equal(joined.ok, true);
    const { playerId, resumeToken, membershipVersion } = joined.data;
    const request = (roomId: string, version = membershipVersion, token = resumeToken) => app.inject({
      method: 'POST', url: '/voice/token', headers: { authorization: `Bearer ${token}` },
      payload: { roomId, membershipVersion: version },
    });
    assert.equal((await request('lobby', membershipVersion, '0'.repeat(64))).statusCode, 403);
    assert.equal((await request('catfe')).statusCode, 403);
    const issued = await request('lobby');
    assert.equal(issued.statusCode, 200);
    assert.equal(issued.headers['cache-control'], 'no-store');
    assert.equal(issued.json().url, url);
    const claims = await new TokenVerifier(key, secret).verify(issued.json().token);
    assert.equal(claims.sub, playerId);
    assert.equal(claims.video?.room, 'mewting-lobby');
    assert.equal(claims.video?.roomJoin, true);
    assert.deepEqual(claims.video?.canPublishSources, ['microphone']);
    assert.equal(claims.video?.canPublishData, false);

    const moved = await socket.timeout(2000).emitWithAck('room:join', { roomId: 'catfe' });
    assert.equal(moved.ok, true);
    assert.equal((await request('lobby')).statusCode, 403);
    assert.equal((await request('catfe')).statusCode, 403);
    const currentVersion = moved.data.membershipVersion;
    for (let i = 0; i < 5; i++) assert.equal((await request('catfe', currentVersion)).statusCode, 200);
    assert.equal((await request('catfe', currentVersion)).statusCode, 429);
  } finally {
    socket.disconnect();
    await app.close();
  }
});
