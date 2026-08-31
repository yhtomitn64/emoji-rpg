export const STORAGE_KEY = 'emoji-rpg-save';

export const DEFAULT_HERO_EMOJI = '🧑';
export const HERO_EMOJI_OPTIONS = [
  '🧑', '🧙', '🥷', '🧝', '🦸', '🧛', '🤺', '🧟',
  '🦹', '🎅', '🤶', '👸', '🤴', '🤵', '👰', '👳', '🧕',
  '🧗', '🏃', '🚴', '🧑‍🚀', '🧑‍🎨', '🧑‍✈️',
];

// Verified by rendering each base emoji + each Fitzpatrick modifier and checking
// the glyph actually recolors, rather than leaving the modifier to render as its
// own separate color-swatch box next to an unchanged base emoji. Keep in sync
// with HERO_EMOJI_OPTIONS if that list changes.
const TONE_INCAPABLE_EMOJI = new Set(['🤺', '🧟']);

export function isToneCapableEmoji(emoji) {
  return !TONE_INCAPABLE_EMOJI.has(emoji);
}

export const SKIN_TONES = [
  { label: 'Default', modifier: '' },
  { label: '🏻', modifier: '\u{1F3FB}' },
  { label: '🏼', modifier: '\u{1F3FC}' },
  { label: '🏽', modifier: '\u{1F3FD}' },
  { label: '🏾', modifier: '\u{1F3FE}' },
  { label: '🏿', modifier: '\u{1F3FF}' },
];

export function applySkinTone(emoji, modifier) {
  if (!modifier || !isToneCapableEmoji(emoji)) return emoji;
  // Insert right after the first code point, not at the end - ZWJ sequences like
  // person+ZWJ+rocket need the modifier between the base person and the ZWJ, or
  // it renders as its own unstyled color swatch instead of recoloring the emoji.
  const codePoints = Array.from(emoji);
  return [codePoints[0], modifier, ...codePoints.slice(1)].join('');
}

// The single, fixed dungeon entrance location for every save (2026-08-24 -
// previously randomized per save among the 4 far corners; Timothy wanted to
// hand-place it instead). Update this to move the entrance: use the terrain
// painter tool's "Place Dungeon Entrance" mode to pick a spot and copy the
// exact { screenId, x, y } value here.
export const DEFAULT_DUNGEON_ENTRANCE_POSITION = { screenId: 'farNorthwest', x: 8, y: 7 };

export function createNewGame(heroEmoji = DEFAULT_HERO_EMOJI, dungeonEntrancePosition = DEFAULT_DUNGEON_ENTRANCE_POSITION) {
  return {
    player: { level: 1, xp: 0, hp: 20, maxHp: 20, attack: 5, defense: 3, speed: 5, gold: 20, emoji: heroEmoji },
    equipment: { weapon: 'starterSword', head: null, body: null, legs: null, accessory: null, ring1: null, ring2: null },
    upgrades: {},
    equipmentTiers: {},
    inventory: [{ itemId: 'potion', quantity: 2 }],
    map: 'center',
    position: null,
    flags: { dungeonBossDefeated: false, firstKillCelebrated: false },
    visited: {},
    seenScreens: {},
    caches: {},
    miniDungeons: {},
    activeMiniDungeon: null,
    bossTier: 0,
    ngPlusCycle: 0,
    questProgress: {
      boar: 0, bat: 0, snake: 0, goblin: 0,
      direWolf: 0, spider: 0, orc: 0, wraith: 0,
    },
    questLevel: {
      boar: 1, bat: 1, snake: 1, goblin: 1,
      direWolf: 1, spider: 1, orc: 1, wraith: 1,
    },
    monsterKillCounts: {
      boar: 0, bat: 0, snake: 0, goblin: 0,
      direWolf: 0, spider: 0, orc: 0, wraith: 0,
    },
    bestDamage: {},
    gateRewards: {},
    clearedGates: {},
    lossStreak: 0,
    encounterCooldown: 0,
    zone1Steps: 0,
    dungeonEntrancePosition,
  };
}

// One-time migration for saves from before ring slots existed - nothing
// carries over into them (no item has ever occupied a ring slot before this
// feature), this just adds the two empty keys so downstream code that reads
// state.equipment.ring1/ring2 directly never sees undefined vs. null drift.
//
// Also relocates a legacy-equipped Ember Ring out of the accessory slot: it
// was reclassified from slot:'accessory' to slot:'ring' after some saves
// already had it equipped there, so a save mid-migration can have
// equipment.accessory === 'emberRing' - left alone, that player keeps a
// de-facto third accessory slot with different upgrade rules than the same
// ring equipped normally (see the smith-screen ring-upgrade-suppression fix
// in the same commit as this migration change). Relocating it into ring1
// (guaranteed empty here, since ring1 has never existed before this
// migration runs) converges every player onto the same slot for the same
// item. The upgrade level carries automatically - upgradeKey is keyed by
// itemId+tier only, never by physical slot, so this move needs no upgrades
// bookkeeping of its own.
export function migrateRingSlots(state) {
  if ('ring1' in state.equipment && 'ring2' in state.equipment) return state;
  const equipment = { ring1: null, ring2: null, ...state.equipment };
  if (equipment.accessory === 'emberRing') {
    equipment.ring1 = 'emberRing';
    equipment.accessory = null;
  }
  return {
    ...state,
    equipment,
    equipmentTiers: { ...state.equipmentTiers },
  };
}

// One-time migration for saves from before per-move best-damage tracking
// existed ("New Max damage!" progression callout, added 2026-08-31) -
// nothing carries over (no move has ever recorded a best hit before this),
// this just adds the empty tracking object so downstream code that reads
// state.bestDamage[moveId] directly never sees undefined.
export function migrateBestDamage(state) {
  if ('bestDamage' in state) return state;
  return { ...state, bestDamage: {} };
}

export function serializeState(state) {
  return JSON.stringify(state);
}

export function deserializeState(json) {
  return JSON.parse(json);
}

export function slotSaveKey(slotId) {
  return `emoji-rpg-save-${slotId}`;
}

export function saveState(state, slotId, storage = globalThis.localStorage) {
  storage.setItem(slotSaveKey(slotId), serializeState(state));
}

export function loadState(slotId, storage = globalThis.localStorage) {
  const raw = storage.getItem(slotSaveKey(slotId));
  if (!raw) return null;
  return deserializeState(raw);
}
