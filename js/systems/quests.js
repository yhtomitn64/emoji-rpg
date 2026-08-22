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

export function getQuestRequirement(monsterId, level) {
  return QUEST_REQUIREMENTS[monsterId] + (level - 1);
}

export function getQuestRewardQuantity(level) {
  return 1 + Math.floor(Math.log2(level));
}

export function incrementQuestProgress(state, monsterId) {
  if (!(monsterId in QUEST_REQUIREMENTS)) return state;
  const current = state.questProgress[monsterId] || 0;
  return { ...state, questProgress: { ...state.questProgress, [monsterId]: current + 1 } };
}

export function canTurnInQuest(state, monsterId) {
  const level = state.questLevel[monsterId] || 1;
  return (state.questProgress[monsterId] || 0) >= getQuestRequirement(monsterId, level);
}

export function turnInQuest(state, monsterId) {
  if (!canTurnInQuest(state, monsterId)) throw new Error(`Quest for ${monsterId} is not complete`);
  const level = state.questLevel[monsterId] || 1;
  const rewardItemId = getQuestRewardItemId(monsterId);
  const rewardQuantity = getQuestRewardQuantity(level);
  let next = {
    ...state,
    questProgress: { ...state.questProgress, [monsterId]: 0 },
    questLevel: { ...state.questLevel, [monsterId]: level + 1 },
  };
  next = addItem(next, rewardItemId, rewardQuantity);
  return next;
}
