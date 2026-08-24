import { ITEMS } from '../data/items.js';

export const GATE_REWARD_GOLD_MIN = 15;
export const GATE_REWARD_GOLD_RANGE = 11;

export function hasRequiredTool(tile, inventory) {
  if (!tile.requiresTool) return true;
  return inventory.some((entry) => entry.itemId === tile.requiresTool && entry.quantity > 0);
}

export function getLockedGateMessage(toolId) {
  const name = ITEMS[toolId].name;
  const article = /^[AEIOU]/.test(name) ? 'an' : 'a';
  return `You need ${article} ${name} to get through here.`;
}

const TOOL_CLEAR_VERBS = {
  axe: 'cut through the thicket',
  miningPick: 'clear the mountain',
  boat: 'paddle across the water',
};

export function getToolClearedMessage(toolId) {
  const name = ITEMS[toolId].name;
  const article = /^[AEIOU]/.test(name) ? 'an' : 'a';
  const verb = TOOL_CLEAR_VERBS[toolId] || 'clear the way';
  return `You ${verb} with ${article} ${name}!`;
}

export function getGateProximityMessage(toolId, hasTool) {
  const name = ITEMS[toolId].name;
  const article = /^[AEIOU]/.test(name) ? 'an' : 'a';
  if (hasTool) {
    return `You're right next to something you could clear with your ${name}.`;
  }
  return `Something here looks like it'd need ${article} ${name} to get through.`;
}

export function hasShownGateHint(toolGateHintsShown, screenId, x, y) {
  return Boolean(toolGateHintsShown[screenId] && toolGateHintsShown[screenId][`${x},${y}`]);
}

export function markGateHintShown(toolGateHintsShown, screenId, x, y) {
  const key = `${x},${y}`;
  const screenHints = { ...(toolGateHintsShown[screenId] || {}), [key]: true };
  return { ...toolGateHintsShown, [screenId]: screenHints };
}

export function isGateRewardCollected(gateRewards, screenId, x, y) {
  return Boolean(gateRewards[screenId] && gateRewards[screenId][`${x},${y}`]);
}

export function markGateRewardCollected(gateRewards, screenId, x, y) {
  const key = `${x},${y}`;
  const screenRewards = { ...(gateRewards[screenId] || {}), [key]: true };
  return { ...gateRewards, [screenId]: screenRewards };
}

export function rollGateReward(rng = Math.random) {
  const gold = GATE_REWARD_GOLD_MIN + Math.floor(rng() * GATE_REWARD_GOLD_RANGE);
  return { gold, item: 'potion' };
}
