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
  migratePowerRingSlot,
  migrateBestDamage,
  migrateLoadout,
  migrateSettings,
  DEFAULT_ITEM_MENU_AUTO_CLOSE_MS,
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

test('migratePowerRingSlot relocates an accessory-equipped Power Ring into ring1', () => {
  const legacy = createNewGame();
  legacy.equipment.accessory = 'powerRing';
  const migrated = migratePowerRingSlot(legacy);
  assert.equal(migrated.equipment.ring1, 'powerRing');
  assert.equal(migrated.equipment.accessory, null);
});

test('migratePowerRingSlot uses ring2 when ring1 is already occupied', () => {
  const legacy = createNewGame();
  legacy.equipment.accessory = 'powerRing';
  legacy.equipment.ring1 = 'emberRing';
  const migrated = migratePowerRingSlot(legacy);
  assert.equal(migrated.equipment.ring1, 'emberRing');
  assert.equal(migrated.equipment.ring2, 'powerRing');
  assert.equal(migrated.equipment.accessory, null);
});

test('migratePowerRingSlot returns Power Ring to inventory when both ring slots are already taken', () => {
  const legacy = createNewGame();
  legacy.equipment.accessory = 'powerRing';
  legacy.equipment.ring1 = 'emberRing';
  legacy.equipment.ring2 = 'windfuryRing';
  const migrated = migratePowerRingSlot(legacy);
  assert.equal(migrated.equipment.accessory, null);
  assert.equal(migrated.equipment.ring1, 'emberRing');
  assert.equal(migrated.equipment.ring2, 'windfuryRing');
  assert.equal(migrated.inventory.find((entry) => entry.itemId === 'powerRing')?.quantity, 1);
});

test('migratePowerRingSlot stacks onto an existing Power Ring inventory entry rather than duplicating it', () => {
  const legacy = createNewGame();
  legacy.equipment.accessory = 'powerRing';
  legacy.equipment.ring1 = 'emberRing';
  legacy.equipment.ring2 = 'windfuryRing';
  legacy.inventory.push({ itemId: 'powerRing', quantity: 1 });
  const migrated = migratePowerRingSlot(legacy);
  const entries = migrated.inventory.filter((entry) => entry.itemId === 'powerRing');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].quantity, 2);
});

test('migratePowerRingSlot is a no-op when Power Ring is not in the accessory slot', () => {
  const state = createNewGame();
  state.equipment.accessory = 'luckyCharm';
  const migrated = migratePowerRingSlot(state);
  assert.equal(migrated.equipment.accessory, 'luckyCharm');
  assert.equal(migrated, state);
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

test('createNewGame starts with the heal potion loaded into loadout slot 1', () => {
  const state = createNewGame();
  assert.deepEqual(state.loadout, ['potion', null, null, null]);
});

test('migrateLoadout adds the default loadout to a save from before it existed', () => {
  const legacy = createNewGame();
  delete legacy.loadout;
  const migrated = migrateLoadout(legacy);
  assert.deepEqual(migrated.loadout, ['potion', null, null, null]);
});

test('migrateLoadout is a no-op once loadout already exists', () => {
  const state = { ...createNewGame(), loadout: ['strengthDraught', null, null, null] };
  const migrated = migrateLoadout(state);
  assert.deepEqual(migrated.loadout, ['strengthDraught', null, null, null]);
});

test('createNewGame defaults itemMenuAutoCloseMs to DEFAULT_ITEM_MENU_AUTO_CLOSE_MS', () => {
  const state = createNewGame();
  assert.equal(state.settings.itemMenuAutoCloseMs, DEFAULT_ITEM_MENU_AUTO_CLOSE_MS);
});

test('migrateSettings adds the default settings to a save from before they existed', () => {
  const legacy = createNewGame();
  delete legacy.settings;
  const migrated = migrateSettings(legacy);
  assert.deepEqual(migrated.settings, { itemMenuAutoCloseMs: DEFAULT_ITEM_MENU_AUTO_CLOSE_MS });
});

test('migrateSettings is a no-op once settings already exist', () => {
  const state = { ...createNewGame(), settings: { itemMenuAutoCloseMs: 2500 } };
  const migrated = migrateSettings(state);
  assert.deepEqual(migrated.settings, { itemMenuAutoCloseMs: 2500 });
});
