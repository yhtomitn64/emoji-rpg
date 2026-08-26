import test from 'node:test';
import assert from 'node:assert/strict';
import { MONSTERS } from '../js/data/monsters.js';
import { ITEMS, SHOP_CATALOG } from '../js/data/items.js';
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

test('the frog/scorpion/skeleton roster additions have the expected names, stats, attack styles, and drops', () => {
  const expected = {
    frog: {
      name: 'Ribbity Ravioli', emoji: '🐸', hp: 58, attack: 9, defense: 1, speed: 6, xp: 13, goldRange: [3, 8],
      attackStyle: 'melee', dropItemId: 'frogSkin',
    },
    scorpion: {
      name: 'Spicy Skewer', emoji: '🦂', hp: 90, attack: 13, defense: 3, speed: 6, xp: 30, goldRange: [7, 15],
      attackStyle: 'melee', dropItemId: 'scorpionVenom',
    },
    skeleton: {
      name: 'Bone-in Biscuit', emoji: '💀', hp: 175, attack: 32, defense: 6, speed: 9, xp: 61, goldRange: [18, 29],
      attackStyle: 'ranged', projectileEmoji: '🦴', dropItemId: 'boneFragment',
    },
  };
  for (const [id, exp] of Object.entries(expected)) {
    const monster = MONSTERS[id];
    assert.equal(monster.name, exp.name, `${id} name`);
    assert.equal(monster.emoji, exp.emoji, `${id} emoji`);
    assert.equal(monster.hp, exp.hp, `${id} hp`);
    assert.equal(monster.attack, exp.attack, `${id} attack`);
    assert.equal(monster.defense, exp.defense, `${id} defense`);
    assert.equal(monster.speed, exp.speed, `${id} speed`);
    assert.equal(monster.xp, exp.xp, `${id} xp`);
    assert.deepEqual(monster.goldRange, exp.goldRange, `${id} goldRange`);
    assert.equal(monster.attackStyle, exp.attackStyle, `${id} attackStyle`);
    if (exp.projectileEmoji) assert.equal(monster.projectileEmoji, exp.projectileEmoji, `${id} projectileEmoji`);
    assert.ok(monster.dropTable.some((entry) => entry.itemId === exp.dropItemId), `${id} drops ${exp.dropItemId}`);
  }
  assert.ok(Array.isArray(MONSTERS.skeleton.flavorLines) && MONSTERS.skeleton.flavorLines.length > 0, 'skeleton has dungeon-tier flavorLines');
});

test('the rare elite (jurassicJerky) has near-dragon stats, is not a boss, and drops the unique Fossil Fang', () => {
  const elite = MONSTERS.jurassicJerky;
  assert.equal(elite.name, 'Jurassic Jerky');
  assert.equal(elite.emoji, '🦖');
  assert.equal(elite.hp, 132);
  assert.equal(elite.attack, 30);
  assert.equal(elite.defense, 11);
  assert.equal(elite.speed, 10);
  assert.equal(elite.xp, 160);
  assert.deepEqual(elite.goldRange, [55, 90]);
  assert.equal(elite.attackStyle, 'ranged');
  assert.ok(elite.projectileEmoji);
  assert.equal(elite.isElite, true);
  assert.notEqual(elite.isBoss, true);
  assert.ok(elite.dropTable.some((entry) => entry.itemId === 'fossilFang'), 'jurassicJerky drops fossilFang');

  const fang = ITEMS.fossilFang;
  assert.equal(fang.name, 'Fossil Fang');
  assert.equal(fang.slot, 'weapon');
  assert.equal(fang.price, 0);
  assert.equal(fang.stats.attack, 12);
});

test('the three v1 Unique-effect items have the documented slots, prices, and effect stats', () => {
  const vampiricFang = ITEMS.vampiricFang;
  assert.equal(vampiricFang.name, 'Vampiric Fang');
  assert.equal(vampiricFang.slot, 'weapon');
  assert.equal(vampiricFang.price, 0);
  assert.equal(vampiricFang.stats.attack, 7);
  assert.equal(vampiricFang.stats.lifestealPercent, 15);

  const swiftStrikeCharm = ITEMS.swiftStrikeCharm;
  assert.equal(swiftStrikeCharm.name, 'Swift Strike Charm');
  assert.equal(swiftStrikeCharm.slot, 'accessory');
  assert.equal(swiftStrikeCharm.price, 0);
  assert.equal(swiftStrikeCharm.stats.extraSwingChance, 10);

  const emberRing = ITEMS.emberRing;
  assert.equal(emberRing.name, 'Ember Ring');
  assert.equal(emberRing.slot, 'accessory');
  assert.equal(emberRing.price, 0);
  assert.equal(emberRing.stats.elementalProcChance, 20);
  assert.equal(emberRing.stats.elementalProcDamage, 6);

  for (const id of ['vampiricFang', 'swiftStrikeCharm', 'emberRing']) {
    assert.ok(!SHOP_CATALOG.includes(id), `${id} must not be shop-purchasable`);
  }
});

test('every monster has a valid attackStyle, and ranged monsters have a projectileEmoji', () => {
  for (const [id, monster] of Object.entries(MONSTERS)) {
    assert.ok(['melee', 'ranged'].includes(monster.attackStyle), `${id} attackStyle`);
    if (monster.attackStyle === 'ranged') {
      assert.ok(typeof monster.projectileEmoji === 'string' && monster.projectileEmoji.length > 0, `${id} projectileEmoji`);
    }
  }
});

test('every quest-eligible monster still has at least one material drop', () => {
  for (const monsterId of Object.keys(QUEST_REQUIREMENTS)) {
    const monster = MONSTERS[monsterId];
    const hasMaterial = (monster.dropTable || []).some((entry) => ITEMS[entry.itemId].type === 'material');
    assert.ok(hasMaterial, `${monsterId} has no material-type drop entry`);
  }
});

test('orc drops a mining pick and wraith drops an axe, alongside their existing material drop', () => {
  const orcTools = MONSTERS.orc.dropTable.filter((entry) => ITEMS[entry.itemId].type === 'tool');
  assert.equal(orcTools.length, 1);
  assert.equal(orcTools[0].itemId, 'miningPick');
  assert.equal(orcTools[0].chance, 0.25);

  const wraithTools = MONSTERS.wraith.dropTable.filter((entry) => ITEMS[entry.itemId].type === 'tool');
  assert.equal(wraithTools.length, 1);
  assert.equal(wraithTools[0].itemId, 'axe');
  assert.equal(wraithTools[0].chance, 0.25);

  assert.equal(ITEMS.miningPick.type, 'tool');
  assert.equal(ITEMS.miningPick.price, 0);
  assert.equal(ITEMS.axe.type, 'tool');
  assert.equal(ITEMS.axe.price, 0);
});
