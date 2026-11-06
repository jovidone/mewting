import assert from 'node:assert/strict';
import test from 'node:test';
import { speechText } from '../frontend/src/game/speech-text.js';

test('speech previews collapse line breaks and truncate at a nearby word boundary', () => {
  assert.equal(speechText('Hello\n\tMewting'), 'Hello Mewting');
  assert.equal(speechText('A cozy corner for cats and their friends'), 'A cozy corner for cats and their...');
});

test('speech previews fit the limit including the ellipsis without splitting emoji', () => {
  const emoji = '👩🏽‍💻';
  assert.equal(speechText(emoji.repeat(35)), emoji.repeat(35));
  assert.equal(speechText(emoji.repeat(36)), emoji.repeat(32) + '...');
});
