import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_FRAME_SECONDS, MOVEMENT_SPEED, ROOMS, WALK_BOUNDS, advancePosition, isRoomId } from '@mewting/shared';
import { readMovement } from '../frontend/src/game/keyboard.js';

test('cardinal and diagonal movement travel at the same speed', () => {
  const start = { x: 480, y: 400 };
  const horizontal = advancePosition(start, { x: 1, y: 0 }, 0.02);
  const diagonal = advancePosition(start, { x: 1, y: 1 }, 0.02);
  assert.ok(Math.abs(Math.hypot(diagonal.x - start.x, diagonal.y - start.y) - (horizontal.x - start.x)) < 0.00001);
  assert.ok(Math.abs(horizontal.x - start.x - MOVEMENT_SPEED * 0.02) < 0.00001);
});

test('movement is consistent across frame rates', () => {
  const simulate = (fps: number) => {
    let position = { x: 300, y: 350 };
    for (let i = 0; i < fps; i++) position = advancePosition(position, { x: 1, y: 0 }, 1 / fps);
    return position.x;
  };
  for (const fps of [30, 60, 144]) assert.ok(Math.abs(simulate(fps) - (300 + MOVEMENT_SPEED)) < 0.00001);
});

test('all four room boundaries contain the player under sustained input', () => {
  for (const input of [{ x: -1, y: -1 }, { x: 1, y: 1 }]) {
    let position = { x: 480, y: 400 };
    for (let i = 0; i < 1000; i++) position = advancePosition(position, input, 0.05);
    assert.deepEqual(position, input.x < 0 ? { x: WALK_BOUNDS.left, y: WALK_BOUNDS.top } : { x: WALK_BOUNDS.right, y: WALK_BOUNDS.bottom });
  }
});

test('stalls do not teleport the player and invalid numbers are rejected', () => {
  const start = { x: 480, y: 400 };
  assert.equal(advancePosition(start, { x: 1, y: 0 }, 30).x, start.x + MOVEMENT_SPEED * MAX_FRAME_SECONDS);
  assert.deepEqual(advancePosition(start, { x: 1, y: 0 }, -2), start);
  assert.throws(() => advancePosition(start, { x: Infinity, y: 0 }, 0.01), RangeError);
  assert.throws(() => advancePosition(start, { x: 0, y: 0 }, NaN), RangeError);
});

test('WASD and arrows combine without doubling speed; opposing keys cancel', () => {
  assert.deepEqual(readMovement(new Set(['KeyD', 'ArrowRight', 'KeyW'])), { x: 1, y: -1 });
  assert.deepEqual(readMovement(new Set(['KeyA', 'ArrowRight', 'ArrowUp', 'KeyS'])), { x: 0, y: 0 });
  assert.deepEqual(readMovement(new Set(['Space'])), { x: 0, y: 0 });
});

test('exactly five unique rooms have safe spawn points and invalid IDs are rejected', () => {
  assert.equal(ROOMS.length, 5);
  assert.equal(new Set(ROOMS.map((room) => room.id)).size, 5);
  for (const room of ROOMS) {
    assert.ok(isRoomId(room.id));
    assert.deepEqual(advancePosition(room.spawn, { x: 0, y: 0 }, 0), room.spawn);
  }
  for (const value of ['__proto__', 'unknown', '', null, 1]) assert.equal(isRoomId(value), false);
});

