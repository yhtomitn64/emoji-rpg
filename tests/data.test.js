import test from 'node:test';
import assert from 'node:assert/strict';
import { MONSTERS } from '../js/data/monsters.js';
import { ITEMS } from '../js/data/items.js';

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
