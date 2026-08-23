import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUEST_REQUIREMENTS,
  getQuestRewardItemId,
  getQuestRequirement,
  getQuestRewardQuantity,
  incrementQuestProgress,
  canTurnInQuest,
  turnInQuest,
} from '../js/systems/quests.js';
import { createNewGame } from '../js/state.js';

function freshQuestState() {
  const state = createNewGame();
  state.questProgress = {
    boar: 0, bat: 0, snake: 0, goblin: 0,
    direWolf: 0, spider: 0, orc: 0, wraith: 0,
  };
  state.questLevel = {
    boar: 1, bat: 1, snake: 1, goblin: 1,
    direWolf: 1, spider: 1, orc: 1, wraith: 1,
  };
  return state;
}

test('QUEST_REQUIREMENTS has exactly the 11 expected monsters with the expected kill counts', () => {
  assert.deepEqual(QUEST_REQUIREMENTS, {
    boar: 3, bat: 3, snake: 3, goblin: 3, frog: 3,
    direWolf: 2, spider: 2, scorpion: 2, orc: 2, wraith: 2, skeleton: 2,
  });
});

test('getQuestRewardItemId returns the material drop for each quest monster', () => {
  assert.equal(getQuestRewardItemId('boar'), 'leatherScrap');
  assert.equal(getQuestRewardItemId('bat'), 'batWing');
  assert.equal(getQuestRewardItemId('snake'), 'snakeFang');
  assert.equal(getQuestRewardItemId('direWolf'), 'wolfPelt');
  assert.equal(getQuestRewardItemId('spider'), 'spiderSilk');
  assert.equal(getQuestRewardItemId('orc'), 'orcTusk');
  assert.equal(getQuestRewardItemId('wraith'), 'wraithEssence');
  assert.equal(getQuestRewardItemId('frog'), 'frogSkin');
  assert.equal(getQuestRewardItemId('scorpion'), 'scorpionVenom');
  assert.equal(getQuestRewardItemId('skeleton'), 'boneFragment');
});

test("getQuestRewardItemId skips goblin's non-material weapon drop and returns the material", () => {
  assert.equal(getQuestRewardItemId('goblin'), 'ironScrap');
});

test('incrementQuestProgress increments the matching monster counter only', () => {
  let state = freshQuestState();
  state = incrementQuestProgress(state, 'boar');
  assert.equal(state.questProgress.boar, 1);
  assert.equal(state.questProgress.bat, 0);
});

test('incrementQuestProgress is a no-op for a non-quest monster', () => {
  const state = freshQuestState();
  const next = incrementQuestProgress(state, 'dragon');
  assert.equal(next, state);
});

test('canTurnInQuest is false one kill below the requirement and true exactly at it', () => {
  let state = freshQuestState();
  state.questProgress.direWolf = 1;
  assert.equal(canTurnInQuest(state, 'direWolf'), false);
  state.questProgress.direWolf = 2;
  assert.equal(canTurnInQuest(state, 'direWolf'), true);
});

test('turnInQuest resets the counter, grants exactly one reward material at level 1, and advances the level', () => {
  let state = freshQuestState();
  state.questProgress.boar = 3;
  state = turnInQuest(state, 'boar');
  assert.equal(state.questProgress.boar, 0);
  assert.equal(state.questLevel.boar, 2);
  const entry = state.inventory.find((e) => e.itemId === 'leatherScrap');
  assert.equal(entry.quantity, 1);
});

test('turnInQuest throws if the requirement is not yet met', () => {
  const state = freshQuestState();
  assert.throws(() => turnInQuest(state, 'boar'));
});

test('getQuestRequirement adds one kill per level above the base requirement', () => {
  assert.equal(getQuestRequirement('boar', 1), 3);
  assert.equal(getQuestRequirement('boar', 2), 4);
  assert.equal(getQuestRequirement('boar', 5), 7);
  assert.equal(getQuestRequirement('direWolf', 1), 2);
  assert.equal(getQuestRequirement('direWolf', 3), 4);
});

test('getQuestRewardQuantity grows logarithmically with diminishing returns', () => {
  assert.equal(getQuestRewardQuantity(1), 1);
  assert.equal(getQuestRewardQuantity(2), 2);
  assert.equal(getQuestRewardQuantity(3), 2);
  assert.equal(getQuestRewardQuantity(4), 3);
  assert.equal(getQuestRewardQuantity(7), 3);
  assert.equal(getQuestRewardQuantity(8), 4);
});

test('canTurnInQuest uses the scaled requirement for the monster\'s current level', () => {
  let state = freshQuestState();
  state.questLevel.direWolf = 2; // requirement is now 3, not the base 2
  state.questProgress.direWolf = 2;
  assert.equal(canTurnInQuest(state, 'direWolf'), false);
  state.questProgress.direWolf = 3;
  assert.equal(canTurnInQuest(state, 'direWolf'), true);
});

test('turnInQuest grants a scaled reward quantity at a higher level', () => {
  let state = freshQuestState();
  state.questLevel.boar = 4; // requirement 6, reward quantity 3
  state.questProgress.boar = 6;
  state = turnInQuest(state, 'boar');
  assert.equal(state.questLevel.boar, 5);
  const entry = state.inventory.find((e) => e.itemId === 'leatherScrap');
  assert.equal(entry.quantity, 3);
});
