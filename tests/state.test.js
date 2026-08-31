import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNewGame,
  serializeState,
  deserializeState,
  saveState,
  loadState,
  slotSaveKey,
  DEFAULT_HERO_EMOJI,
  DEFAULT_DUNGEON_ENTRANCE_POSITION,
  HERO_EMOJI_OPTIONS,
  SKIN_TONES,
  isToneCapableEmoji,
  applySkinTone,
  migrateRingSlots,
  migrateBestDamage,
} from '../js/state.js';

function createFakeStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
  };
}

test('createNewGame returns a fresh default state', () => {
  const state = createNewGame();
  assert.equal(state.player.level, 1);
  assert.equal(state.player.gold, 20);
  assert.equal(state.map, 'center');
  assert.equal(state.equipment.weapon, 'starterSword');
  assert.deepEqual(state.caches, {});
  assert.deepEqual(state.miniDungeons, {});
  assert.equal(state.activeMiniDungeon, null);
  assert.equal(state.bossTier, 0);
  assert.equal(state.ngPlusCycle, 0);
  assert.deepEqual(state.questProgress, {
    boar: 0, bat: 0, snake: 0, goblin: 0,
    direWolf: 0, spider: 0, orc: 0, wraith: 0,
  });
  assert.deepEqual(state.gateRewards, {});
  assert.equal(state.player.emoji, DEFAULT_HERO_EMOJI);
});

test('createNewGame includes a zero-initialized monsterKillCounts, independent of questProgress', () => {
  const state = createNewGame();
  assert.deepEqual(state.monsterKillCounts, {
    boar: 0, bat: 0, snake: 0, goblin: 0,
    direWolf: 0, spider: 0, orc: 0, wraith: 0,
  });
});

test('createNewGame starts zone1Steps at 0', () => {
  const state = createNewGame();
  assert.equal(state.zone1Steps, 0);
});

test('createNewGame uses the passed hero emoji instead of the default', () => {
  const state = createNewGame('🧙');
  assert.equal(state.player.emoji, '🧙');
});

test('createNewGame defaults dungeonEntrancePosition to DEFAULT_DUNGEON_ENTRANCE_POSITION', () => {
  // Not pinned to a specific historical value - DEFAULT_DUNGEON_ENTRANCE_POSITION
  // is a hand-placed, movable config value (see its own comment in state.js),
  // expected to change whenever Timothy repositions the dungeon via the
  // terrain painter tool. This only checks that createNewGame's default
  // actually flows from that constant, not any particular coordinate.
  const state = createNewGame();
  assert.deepEqual(state.dungeonEntrancePosition, DEFAULT_DUNGEON_ENTRANCE_POSITION);
});

test('createNewGame uses an explicit dungeonEntrancePosition when passed', () => {
  const custom = { screenId: 'northwest', x: 3, y: 7 };
  const state = createNewGame(DEFAULT_HERO_EMOJI, custom);
  assert.deepEqual(state.dungeonEntrancePosition, custom);
});

test('serializeState and deserializeState round-trip', () => {
  const state = createNewGame();
  const json = serializeState(state);
  const restored = deserializeState(json);
  assert.deepEqual(restored, state);
});

test('slotSaveKey builds a per-slot storage key', () => {
  assert.equal(slotSaveKey('abc123'), 'emoji-rpg-save-abc123');
});

test('saveState writes to a slot-specific key and loadState reads it back', () => {
  const storage = createFakeStorage();
  const state = createNewGame();
  state.player.gold = 42;
  saveState(state, 'slot-1', storage);
  const loaded = loadState('slot-1', storage);
  assert.equal(loaded.player.gold, 42);
});

test('saveState for one slot does not affect another slot', () => {
  const storage = createFakeStorage();
  const stateA = createNewGame();
  stateA.player.gold = 10;
  const stateB = createNewGame();
  stateB.player.gold = 20;
  saveState(stateA, 'slot-a', storage);
  saveState(stateB, 'slot-b', storage);
  assert.equal(loadState('slot-a', storage).player.gold, 10);
  assert.equal(loadState('slot-b', storage).player.gold, 20);
});

test('loadState returns null when nothing saved for that slot', () => {
  const storage = createFakeStorage();
  assert.equal(loadState('slot-1', storage), null);
});

test('HERO_EMOJI_OPTIONS has no duplicate entries', () => {
  assert.equal(new Set(HERO_EMOJI_OPTIONS).size, HERO_EMOJI_OPTIONS.length);
});

test('SKIN_TONES starts with a no-op Default option', () => {
  assert.equal(SKIN_TONES[0].label, 'Default');
  assert.equal(SKIN_TONES[0].modifier, '');
});

test('isToneCapableEmoji is false only for the verified non-recoloring emoji', () => {
  assert.equal(isToneCapableEmoji('🤺'), false);
  assert.equal(isToneCapableEmoji('🧟'), false);
  assert.equal(isToneCapableEmoji('🧑'), true);
  assert.equal(isToneCapableEmoji('🧙'), true);
});

test('applySkinTone appends the modifier for a simple single-codepoint emoji', () => {
  assert.equal(applySkinTone('🧙', '\u{1F3FF}'), '🧙\u{1F3FF}');
});

test('applySkinTone inserts the modifier before the ZWJ in a ZWJ sequence', () => {
  assert.equal(applySkinTone('🧑‍🚀', '\u{1F3FB}'), '🧑\u{1F3FB}‍🚀');
});

test('applySkinTone is a no-op for tone-incapable emoji, even with a modifier passed', () => {
  assert.equal(applySkinTone('🧟', '\u{1F3FF}'), '🧟');
});

test('applySkinTone is a no-op for an empty/default modifier', () => {
  assert.equal(applySkinTone('🧑', ''), '🧑');
});

test('createNewGame includes empty ring1/ring2 equipment slots', () => {
  const state = createNewGame();
  assert.equal(state.equipment.ring1, null);
  assert.equal(state.equipment.ring2, null);
});

test('migrateRingSlots adds empty ring1/ring2 keys to a save that predates them', () => {
  const legacy = createNewGame();
  delete legacy.equipment.ring1;
  delete legacy.equipment.ring2;
  const migrated = migrateRingSlots(legacy);
  assert.equal(migrated.equipment.ring1, null);
  assert.equal(migrated.equipment.ring2, null);
});

test('migrateRingSlots is a no-op on a save that already has ring slots', () => {
  const state = createNewGame();
  state.equipment.ring1 = 'emberRing';
  const migrated = migrateRingSlots(state);
  assert.equal(migrated.equipment.ring1, 'emberRing');
});

test('migrateRingSlots never overwrites an already-equipped ring', () => {
  const legacy = createNewGame();
  legacy.equipment.ring1 = 'emberRing';
  delete legacy.equipment.ring2;
  const migrated = migrateRingSlots(legacy);
  assert.equal(migrated.equipment.ring1, 'emberRing');
  assert.equal(migrated.equipment.ring2, null);
});

test('migrateRingSlots relocates a legacy accessory-equipped Ember Ring into ring1', () => {
  const legacy = createNewGame();
  legacy.equipment.accessory = 'emberRing';
  delete legacy.equipment.ring1;
  delete legacy.equipment.ring2;
  const migrated = migrateRingSlots(legacy);
  assert.equal(migrated.equipment.ring1, 'emberRing');
  assert.equal(migrated.equipment.accessory, null);
  assert.equal(migrated.equipment.ring2, null);
});

test('migrateRingSlots leaves a non-Ember-Ring accessory item untouched', () => {
  const legacy = createNewGame();
  legacy.equipment.accessory = 'luckyCharm';
  delete legacy.equipment.ring1;
  delete legacy.equipment.ring2;
  const migrated = migrateRingSlots(legacy);
  assert.equal(migrated.equipment.accessory, 'luckyCharm');
  assert.equal(migrated.equipment.ring1, null);
});

test('createNewGame includes an empty bestDamage object', () => {
  const state = createNewGame();
  assert.deepEqual(state.bestDamage, {});
});

test('migrateBestDamage adds an empty bestDamage object to a save that predates it', () => {
  const legacy = createNewGame();
  delete legacy.bestDamage;
  const migrated = migrateBestDamage(legacy);
  assert.deepEqual(migrated.bestDamage, {});
});

test('migrateBestDamage is a no-op on a save that already has bestDamage', () => {
  const state = createNewGame();
  state.bestDamage = { attack: 12 };
  const migrated = migrateBestDamage(state);
  assert.deepEqual(migrated.bestDamage, { attack: 12 });
});
