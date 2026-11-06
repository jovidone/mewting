import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { ROOMS } from '@mewting/shared';
import { buildApp } from '../backend/src/app.js';
import { invitationUrl, invitedRoom } from '../frontend/src/invitations.js';
import { RealtimeClient } from '../frontend/src/network/RealtimeClient.js';

test('invitation links preserve a public origin and round trip every room', () => {
  for (const room of ROOMS) {
    const url = new URL(invitationUrl('https://mewting.example', room.id));
    assert.equal(url.origin, 'https://mewting.example');
    assert.equal(invitedRoom(url.search), room.id);
  }
  assert.equal(invitedRoom('?room=unknown'), null);
});

async function until(check: () => boolean) {
  for (let i = 0; i < 200; i++) {
    if (check()) return;
    await delay(20);
  }
  assert.fail('Expected multiplayer state was not received');
}

test('a guest joining the copied room shares server membership with the host', async () => {
  const app = buildApp();
  const origin = await app.listen({ host: '127.0.0.1', port: 0 });
  const host = new RealtimeClient(origin);
  const guest = new RealtimeClient(origin);
  try {
    host.start({ nickname: 'Host', color: 'sage' });
    await until(() => host.getState().status === 'online');
    assert.equal(await host.changeRoom('catfe'), true);
    const invite = new URL(invitationUrl(origin, host.getState().roomId));
    guest.start({ nickname: 'Guest', color: 'rose' }, invitedRoom(invite.search) ?? 'lobby');
    await until(() => host.getState().players.length === 2 && guest.getState().players.length === 2);
    for (const client of [host, guest]) {
      assert.equal(client.getScene().snapshot?.roomId, 'catfe');
      assert.deepEqual(client.getState().players.map((player) => player.nickname).sort(), ['Guest', 'Host']);
    }
    assert.equal(await guest.changeRoom('pawffice'), true);
    await until(() => host.getState().players.length === 1);
    assert.equal(guest.getState().players.length, 1);
  } finally {
    host.dispose();
    guest.dispose();
    await app.close();
  }
});
