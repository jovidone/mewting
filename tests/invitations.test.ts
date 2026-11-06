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
  const hostLive: string[] = [];
  const guestLive: string[] = [];
  const stopHostChat = host.subscribeLiveChat((message) => hostLive.push(message.text));
  const stopGuestChat = guest.subscribeLiveChat((message) => guestLive.push(message.text));
  try {
    host.start({ nickname: 'Host', color: 'sage' });
    await until(() => host.getState().status === 'online');
    assert.equal(await host.changeRoom('catfe'), true);
    assert.equal(await host.sendChat('Welcome to Catfé'), null);
    const invite = new URL(invitationUrl(origin, host.getState().roomId));
    guest.start({ nickname: 'Guest', color: 'rose' }, invitedRoom(invite.search) ?? 'lobby');
    await until(() => host.getState().players.length === 2 && guest.getState().players.length === 2);
    for (const client of [host, guest]) {
      assert.equal(client.getScene().snapshot?.roomId, 'catfe');
      assert.deepEqual(client.getState().players.map((player) => player.nickname).sort(), ['Guest', 'Host']);
      assert.deepEqual(client.getState().messages.map((message) => message.text), ['Welcome to Catfé']);
    }
    const hostId = host.getState().self?.id;
    assert.deepEqual(hostLive, ['Welcome to Catfé']);
    assert.deepEqual(guestLive, []);
    const guestId = guest.getState().self?.id;
    assert.notEqual(hostId, guestId);
    assert.equal(await guest.updateProfile({ nickname: 'Host', color: 'rose' }), true);
    await until(() => host.getState().players.filter((player) => player.nickname === 'Host').length === 2);
    assert.deepEqual(new Set(host.getState().players.map((player) => player.id)), new Set([hostId, guestId]));
    const initialX = guest.getScene().snapshot?.players.find((player) => player.id === hostId)?.position.x;
    assert.ok(initialX !== undefined);
    host.setInput({ x: 1, y: 0 });
    await until(() => (guest.getScene().snapshot?.players.find((player) => player.id === hostId)?.position.x ?? 0) > initialX);
    host.setInput({ x: 0, y: 0 });
    assert.equal(await guest.sendChat('<script>hello</script>'), null);
    await until(() => host.getState().messages.length === 2);
    assert.equal(host.getState().messages.at(-1)?.text, '<script>hello</script>');
    guest.retry();
    await until(() => guest.getState().status === 'online');
    assert.equal(guest.getState().self?.id, guestId);
    assert.equal(guest.getState().messages.length, 2);
    assert.deepEqual(hostLive, ['Welcome to Catfé', '<script>hello</script>']);
    assert.deepEqual(guestLive, ['<script>hello</script>']);
    assert.equal(await guest.changeRoom('pawffice'), true);
    await until(() => host.getState().players.length === 1);
    assert.equal(guest.getState().players.length, 1);
    assert.deepEqual(guest.getState().messages, []);
    assert.equal(await guest.sendChat('Pawffice only'), null);
    // The host's acknowledgement follows any earlier broadcast on that socket.
    assert.equal(await host.sendChat('Still in Catfé'), null);
    assert.deepEqual(host.getState().messages.map((message) => message.text),
      ['Welcome to Catfé', '<script>hello</script>', 'Still in Catfé']);
    assert.equal(await guest.changeRoom('catfe'), true);
    assert.equal(guest.getState().messages.length, 3);
  } finally {
    stopHostChat();
    stopGuestChat();
    host.dispose();
    guest.dispose();
    await app.close();
  }
});
