import { MONSTERS } from '../data/monsters.js';
import { ITEMS } from '../data/items.js';
import { addItem } from './inventory.js';

export const QUEST_REQUIREMENTS = {
  boar: 3,
  bat: 3,
  snake: 3,
  goblin: 3,
  direWolf: 2,
  spider: 2,
  orc: 2,
  wraith: 2,
};

export function getQuestRewardItemId(monsterId) {
  const entry = MONSTERS[monsterId].dropTable.find((e) => ITEMS[e.itemId].type === 'material');
  return entry.itemId;
}

export function incrementQuestProgress(state, monsterId) {
  if (!(monsterId in QUEST_REQUIREMENTS)) return state;
  const current = state.questProgress[monsterId] || 0;
  return { ...state, questProgress: { ...state.questProgress, [monsterId]: current + 1 } };
}

export function canTurnInQuest(state, monsterId) {
  return (state.questProgress[monsterId] || 0) >= QUEST_REQUIREMENTS[monsterId];
}

export function turnInQuest(state, monsterId) {
  if (!canTurnInQuest(state, monsterId)) throw new Error(`Quest for ${monsterId} is not complete`);
  const rewardItemId = getQuestRewardItemId(monsterId);
  let next = { ...state, questProgress: { ...state.questProgress, [monsterId]: 0 } };
  next = addItem(next, rewardItemId, 1);
  return next;
}
