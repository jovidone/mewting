import assert from 'node:assert/strict';
import test from 'node:test';
import { nicknameError, parsePreferences } from '@mewting/shared';
import { PREFERENCES_KEY, readPreferences, savePreferences } from '../frontend/src/preferences.js';

test('nickname validation handles blanks, limits, Unicode, and invisible control characters', () => {
  assert.ok(nicknameError('   '));
  assert.ok(nicknameError('a'.repeat(21)));
  assert.equal(nicknameError('a'.repeat(20)), null);
  assert.equal(nicknameError('猫咪'), null);
  assert.equal(nicknameError('🐱'.repeat(20)), null);
  assert.ok(nicknameError('A\u0000B'));
  assert.ok(nicknameError('A\u202eB'));
});

test('untrusted stored preferences require a valid nickname and a known coat', () => {
  assert.deepEqual(parsePreferences({ nickname: '  Mochi  ', color: 'sage', id: 'not-trusted' }), { nickname: 'Mochi', color: 'sage' });
  for (const value of [null, [], 'Mochi', { nickname: '', color: 'sage' }, { nickname: 'Mochi', color: '#fff' }, { nickname: 2, color: 'sage' }]) {
    assert.equal(parsePreferences(value), null);
  }
});

test('preferences survive round trips and malformed or blocked storage does not crash', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string, string>();
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
    } });
    const preferences = { nickname: 'Mochi', color: 'sage' } as const;
    assert.equal(savePreferences(preferences), true);
    assert.deepEqual(readPreferences(), preferences);
    assert.deepEqual(Object.keys(JSON.parse(data.get(PREFERENCES_KEY)!) as object).sort(), ['color', 'nickname']);
    data.set(PREFERENCES_KEY, '{broken');
    assert.equal(readPreferences(), null);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage disabled'); } });
    assert.equal(readPreferences(), null);
    assert.equal(savePreferences(preferences), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

