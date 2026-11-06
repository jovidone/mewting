import assert from 'node:assert/strict';
import test from 'node:test';
import { VoicePresence, voiceState } from '../frontend/src/network/VoicePresence.js';

test('an open mic alone does not show a speaking indicator', () => {
  assert.equal(voiceState({ isMicrophoneEnabled: true, isSpeaking: false }), 'active');
  assert.equal(voiceState({ isMicrophoneEnabled: true, isSpeaking: true }), 'speaking');
  assert.equal(voiceState({ isMicrophoneEnabled: false, isSpeaking: true }), 'muted');
});

test('voice presence clears on room changes and notifies only when state changes', () => {
  const presence = new VoicePresence();
  let updates = 0;
  const unsubscribe = presence.subscribe(() => { updates++; });
  presence.replace('lobby', new Map([['player-a', 'speaking']]));
  presence.replace('lobby', new Map([['player-a', 'speaking']]));
  assert.equal(updates, 1);
  assert.equal(presence.get('catfe').size, 0);
  presence.clear('lobby');
  assert.equal(presence.get('lobby').size, 0);
  presence.replace('catfe', new Map([['player-a', 'connecting']]));
  presence.clear('lobby');
  assert.equal(presence.get('catfe').get('player-a'), 'connecting');
  unsubscribe();
  presence.clear('catfe');
  assert.equal(presence.get('catfe').size, 0);
  assert.equal(updates, 3);
});
