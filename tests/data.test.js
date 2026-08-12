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
  }
});

test('every item has required fields', () => {
  for (const [id, item] of Object.entries(ITEMS)) {
    assert.equal(item.id, id);
    assert.ok(item.name);
    assert.ok(item.emoji);
  }
});
