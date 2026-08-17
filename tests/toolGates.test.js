import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GATE_REWARD_GOLD_MIN,
  GATE_REWARD_GOLD_RANGE,
  hasRequiredTool,
  getLockedGateMessage,
  getToolClearedMessage,
  isGateRewardCollected,
  markGateRewardCollected,
  rollGateReward,
} from '../js/systems/toolGates.js';

test('hasRequiredTool is true for a tile with no requiresTool field, regardless of inventory', () => {
  assert.equal(hasRequiredTool({}, []), true);
});

test('hasRequiredTool is false when the inventory lacks the required tool', () => {
  const tile = { requiresTool: 'miningPick' };
  assert.equal(hasRequiredTool(tile, []), false);
  assert.equal(hasRequiredTool(tile, [{ itemId: 'axe', quantity: 1 }]), false);
});

test('hasRequiredTool is true when the inventory has the required tool with quantity > 0', () => {
  const tile = { requiresTool: 'miningPick' };
  assert.equal(hasRequiredTool(tile, [{ itemId: 'miningPick', quantity: 1 }]), true);
});

test('hasRequiredTool is false when the inventory entry exists but has zero quantity', () => {
  const tile = { requiresTool: 'axe' };
  assert.equal(hasRequiredTool(tile, [{ itemId: 'axe', quantity: 0 }]), false);
});

test('getLockedGateMessage names the correct tool with correct a/an grammar', () => {
  assert.equal(getLockedGateMessage('miningPick'), 'You need a Mining Pick to get through here.');
  assert.equal(getLockedGateMessage('axe'), 'You need an Axe to get through here.');
});

test('getToolClearedMessage names the tool cleared and what it cut through', () => {
  assert.equal(getToolClearedMessage('axe'), 'You cut through the thicket with an Axe!');
  assert.equal(getToolClearedMessage('miningPick'), 'You clear the mountain with a Mining Pick!');
});

test('isGateRewardCollected/markGateRewardCollected round-trip, immutably', () => {
  const gateRewards = {};
  const next = markGateRewardCollected(gateRewards, 'northwest', 14, 4);
  assert.equal(isGateRewardCollected(next, 'northwest', 14, 4), true);
  assert.deepEqual(gateRewards, {});
});

test('isGateRewardCollected returns false for uncollected tiles and unknown screens', () => {
  const gateRewards = { northwest: { '14,4': true } };
  assert.equal(isGateRewardCollected(gateRewards, 'northwest', 1, 1), false);
  assert.equal(isGateRewardCollected(gateRewards, 'unknown', 14, 4), false);
});

test('markGateRewardCollected preserves previously recorded rewards on the same screen', () => {
  let gateRewards = markGateRewardCollected({}, 'north', 3, 15);
  gateRewards = markGateRewardCollected(gateRewards, 'north', 9, 9);
  assert.equal(isGateRewardCollected(gateRewards, 'north', 3, 15), true);
  assert.equal(isGateRewardCollected(gateRewards, 'north', 9, 9), true);
});

test('rollGateReward rolls gold in the 15-25 range and always grants a potion', () => {
  const low = rollGateReward(() => 0);
  assert.equal(low.gold, GATE_REWARD_GOLD_MIN);
  assert.equal(low.item, 'potion');
  const high = rollGateReward(() => 0.9999);
  assert.equal(high.gold, GATE_REWARD_GOLD_MIN + GATE_REWARD_GOLD_RANGE - 1);
  assert.equal(high.item, 'potion');
});
