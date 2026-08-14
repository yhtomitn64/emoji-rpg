import test from 'node:test';
import assert from 'node:assert/strict';
import { markScreenSeen, hasSeenScreen } from '../js/systems/screenSeen.js';

test('markScreenSeen records a screen as seen, immutably', () => {
  const seenScreens = {};
  const next = markScreenSeen(seenScreens, 'north');
  assert.equal(hasSeenScreen(next, 'north'), true);
  assert.deepEqual(seenScreens, {});
});

test('hasSeenScreen returns false for an unseen screen', () => {
  const seenScreens = { north: true };
  assert.equal(hasSeenScreen(seenScreens, 'south'), false);
});

test('markScreenSeen preserves previously seen screens', () => {
  let seenScreens = markScreenSeen({}, 'north');
  seenScreens = markScreenSeen(seenScreens, 'south');
  assert.equal(hasSeenScreen(seenScreens, 'north'), true);
  assert.equal(hasSeenScreen(seenScreens, 'south'), true);
});
