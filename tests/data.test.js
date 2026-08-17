import test from 'node:test';
import assert from 'node:assert/strict';
import { MONSTERS } from '../js/data/monsters.js';
import { ITEMS } from '../js/data/items.js';
import { QUEST_REQUIREMENTS } from '../js/systems/quests.js';

test('every monster has required fields and a valid drop table', () => {
  for (const [id, monster] of Object.entries(MONSTERS)) {
    assert.equal(monster.id, id);
    assert.ok(monster.hp > 0, `${id} hp`);
    assert.ok(Array.isArray(monster.goldRange) && monster.goldRange.length === 2);
    const totalChance = (monster.dropTable || []).reduce((sum, entry) => sum + entry.chance, 0);
    assert.ok(totalChance <= 1, `${id} drop table exceeds 100%`);
    for (const entry of monster.dropTable || []) {
      assert.ok(ITEMS[entry.itemId], `${id} references unknown item ${entry.itemId}`);
    }
    assert.ok(typeof monster.name === 'string' && monster.name.length > 0, `${id} name`);
    if (monster.flavorLines !== undefined) {
      assert.ok(Array.isArray(monster.flavorLines) && monster.flavorLines.length > 0, `${id} flavorLines must be a non-empty array`);
      for (const line of monster.flavorLines) {
        assert.ok(typeof line === 'string' && line.length > 0, `${id} has an empty flavor line`);
      }
    }
  }
});

test('regular and dungeon-tier monsters have the approved silly names, dragon does not', () => {
  const expectedNames = {
    boar: 'Snorty McPigface',
    bat: 'Spooky Pancake',
    snake: 'Slippery Breadstick',
    goblin: 'Mean Meatball',
    direWolf: 'Mega Muffin',
    spider: 'Eight-Leg Eggroll',
    orc: 'Super Mean Meatloaf',
    wraith: 'Ghost Apple Supreme',
    dragon: 'Dragon',
  };
  for (const [id, expectedName] of Object.entries(expectedNames)) {
    assert.equal(MONSTERS[id].name, expectedName, `${id} name`);
  }
});

test('every item has required fields', () => {
  for (const [id, item] of Object.entries(ITEMS)) {
    assert.equal(item.id, id);
    assert.ok(item.name);
    assert.ok(item.emoji);
  }
});

test('near-town, far-corner, dungeon, and dragon monsters have the savage-early-game stats', () => {
  const expectedStats = {
    boar: { hp: 77, attack: 10, defense: 1, speed: 4, xp: 16, goldRange: [4, 8] },
    bat: { hp: 55, attack: 9, defense: 0, speed: 7, xp: 11, goldRange: [2, 7] },
    snake: { hp: 60, attack: 10, defense: 1, speed: 5, xp: 16, goldRange: [4, 9] },
    goblin: { hp: 67, attack: 10, defense: 2, speed: 4, xp: 22, goldRange: [5, 13] },
    direWolf: { hp: 100, attack: 14, defense: 3, speed: 6, xp: 32, goldRange: [8, 15] },
    spider: { hp: 85, attack: 12, defense: 2, speed: 5, xp: 29, goldRange: [7, 14] },
    dragon: { hp: 150, attack: 34, defense: 12, speed: 11, xp: 200, goldRange: [65, 100] },
    orc: { hp: 180, attack: 32, defense: 8, speed: 8, xp: 60, goldRange: [18, 28] },
    wraith: { hp: 170, attack: 32, defense: 4, speed: 11, xp: 63, goldRange: [18, 30] },
  };
  for (const [id, expected] of Object.entries(expectedStats)) {
    const monster = MONSTERS[id];
    assert.equal(monster.hp, expected.hp, `${id} hp`);
    assert.equal(monster.attack, expected.attack, `${id} attack`);
    assert.equal(monster.defense, expected.defense, `${id} defense`);
    assert.equal(monster.speed, expected.speed, `${id} speed`);
    assert.equal(monster.xp, expected.xp, `${id} xp`);
    assert.deepEqual(monster.goldRange, expected.goldRange, `${id} goldRange`);
  }
});

test('every quest-eligible monster still has at least one material drop', () => {
  for (const monsterId of Object.keys(QUEST_REQUIREMENTS)) {
    const monster = MONSTERS[monsterId];
    const hasMaterial = (monster.dropTable || []).some((entry) => ITEMS[entry.itemId].type === 'material');
    assert.ok(hasMaterial, `${monsterId} has no material-type drop entry`);
  }
});
