import test from 'node:test';
import assert from 'node:assert/strict';
import { QUEST_REQUIREMENTS, getQuestRewardItemId, incrementQuestProgress, canTurnInQuest, turnInQuest } from '../js/systems/quests.js';
import { createNewGame } from '../js/state.js';

function freshQuestState() {
  const state = createNewGame();
  state.questProgress = {
    boar: 0, bat: 0, snake: 0, goblin: 0,
    direWolf: 0, spider: 0, orc: 0, wraith: 0,
  };
  return state;
}

test('QUEST_REQUIREMENTS has exactly the 8 expected monsters with the expected kill counts', () => {
  assert.deepEqual(QUEST_REQUIREMENTS, {
    boar: 3, bat: 3, snake: 3, goblin: 3,
    direWolf: 2, spider: 2, orc: 2, wraith: 2,
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

test('turnInQuest resets the counter and grants exactly one reward material', () => {
  let state = freshQuestState();
  state.questProgress.boar = 3;
  state = turnInQuest(state, 'boar');
  assert.equal(state.questProgress.boar, 0);
  const entry = state.inventory.find((e) => e.itemId === 'leatherScrap');
  assert.equal(entry.quantity, 1);
});

test('turnInQuest throws if the requirement is not yet met', () => {
  const state = freshQuestState();
  assert.throws(() => turnInQuest(state, 'boar'));
});
