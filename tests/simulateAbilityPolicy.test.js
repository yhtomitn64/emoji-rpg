import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseAction } from '../scripts/simulateAbilityPolicy.js';

test('chooseAction attacks when nothing is unlocked yet (level 1)', () => {
  const action = chooseAction({ level: 1, cooldowns: {}, buffActive: false, attackOnCooldown: false });
  assert.deepEqual(action, { kind: 'attack' });
});

test('chooseAction uses Super Scream when unlocked, off cooldown, and not already active', () => {
  const action = chooseAction({ level: 10, cooldowns: {}, buffActive: false, attackOnCooldown: false });
  assert.deepEqual(action, { kind: 'ability', id: 'superScream' });
});

test('chooseAction does not re-trigger Super Scream while its buff is already active', () => {
  const action = chooseAction({ level: 10, cooldowns: {}, buffActive: true, attackOnCooldown: false });
  // Falls through to the best ready damage ability instead (sweep/Faultline is the highest-unlocked at level 10).
  assert.deepEqual(action, { kind: 'ability', id: 'sweep' });
});

test('chooseAction picks the highest-unlocked ready damage ability', () => {
  const action = chooseAction({ level: 6, cooldowns: {}, buffActive: false, attackOnCooldown: false });
  // Level 6 unlocks stab/chop/slash - slash has the highest unlockLevel.
  assert.deepEqual(action, { kind: 'ability', id: 'slash' });
});

test('chooseAction skips damage abilities that are on cooldown even if ready', () => {
  const action = chooseAction({ level: 6, cooldowns: { slash: 2000 }, buffActive: false, attackOnCooldown: false });
  // slash is excluded (on cooldown); of the remaining unlocked candidates (stab, chop), chop has the higher unlockLevel.
  assert.deepEqual(action, { kind: 'ability', id: 'chop' });
});

test('chooseAction attacks when ready but every unlocked ability is on cooldown', () => {
  const action = chooseAction({ level: 4, cooldowns: { stab: 1000, chop: 1000 }, buffActive: false, attackOnCooldown: false });
  assert.deepEqual(action, { kind: 'attack' });
});

test('chooseAction does nothing when every unlocked ability and Attack are all on cooldown', () => {
  const action = chooseAction({ level: 4, cooldowns: { stab: 1000, chop: 1000 }, buffActive: false, attackOnCooldown: true });
  assert.deepEqual(action, { kind: 'none' });
});
