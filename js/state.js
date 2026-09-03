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

export const DEFAULT_ITEM_MENU_AUTO_CLOSE_MS = 1000;

export function createNewGame(heroEmoji = DEFAULT_HERO_EMOJI, dungeonEntrancePosition = DEFAULT_DUNGEON_ENTRANCE_POSITION) {
  return {
    player: { level: 1, xp: 0, hp: 20, maxHp: 20, attack: 5, defense: 3, speed: 5, gold: 20, emoji: heroEmoji },
    equipment: { weapon: 'starterSword', head: null, body: null, legs: null, accessory: null, ring1: null, ring2: null },
    upgrades: {},
    equipmentTiers: {},
    inventory: [{ itemId: 'potion', quantity: 2 }],
    // The heal potion starts pre-loaded into slot 1 so the existing "press
    // i to heal" battle habit keeps working with zero setup - the other 3
    // slots are for the player to fill in from the Inventory screen's
    // Potions tab. See docs/superpowers/specs/2026-08-31-buff-potions-
    // design.md.
    loadout: ['potion', null, null, null],
    map: 'center',
    position: null,
    flags: { dungeonBossDefeated: false, firstKillCelebrated: false },
    visited: {},
    seenScreens: {},
    caches: {},
    miniDungeons: {},
    activeMiniDungeon: null,
    // The Circle of Ultimate Portaling's current drop, or null if none is
    // out. No migration function needed for existing saves: a save made
    // before this field existed simply lacks the key, and `undefined`
    // reads exactly like `null` everywhere this feature checks it.
    portal: null,
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
    // Per-save (not a single global browser setting) since different
    // people playing on the same device/save-slot list want their own
    // preference - raised live during testing: "a settings menu to adjust
    // this time for different users."
    settings: {
      itemMenuAutoCloseMs: DEFAULT_ITEM_MENU_AUTO_CLOSE_MS,
      soundTheme: 'realistic',
      audioCombatVolume: 0.8, audioCombatMuted: false,
      audioUiVolume: 0.8, audioUiMuted: false,
      audioWorldVolume: 0.8, audioWorldMuted: false,
      audioMusicVolume: 0.6, audioMusicMuted: false,
    },
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

// One-time migration for saves with Power Ring stuck in the accessory
// slot from before it was reclassified as a ring-slot item (2026-09-01
// bug fix, reported live: "when I equip power ring it goes in accessory
// slot and not rings"). Same "legacy item found in the wrong slot" fix
// migrateRingSlots above already does for Ember Ring, but not gated on
// ring1/ring2 existing yet - every save reaching this point already has
// them, since this bug is about this one item's own slot, not the
// ring-slot feature's rollout.
export function migratePowerRingSlot(state) {
  if (state.equipment.accessory !== 'powerRing') return state;
  const equipment = { ...state.equipment, accessory: null };
  if (!equipment.ring1) {
    equipment.ring1 = 'powerRing';
    return { ...state, equipment };
  }
  if (!equipment.ring2) {
    equipment.ring2 = 'powerRing';
    return { ...state, equipment };
  }
  // Both ring slots already taken by something else - can't equip it
  // anywhere, so return it to inventory instead of overwriting a ring the
  // player chose on purpose.
  const existing = state.inventory.find((entry) => entry.itemId === 'powerRing' && !entry.tier);
  const inventory = existing
    ? state.inventory.map((entry) => (entry === existing ? { ...entry, quantity: entry.quantity + 1 } : entry))
    : [...state.inventory, { itemId: 'powerRing', quantity: 1 }];
  return { ...state, equipment, inventory };
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

// One-time migration for saves from before the potion loadout existed -
// defaults to the same starting loadout createNewGame() gives a fresh
// save (heal potion in slot 1, rest empty), so an existing player's Item
// button keeps healing exactly as before with no extra setup needed.
export function migrateLoadout(state) {
  if ('loadout' in state) return state;
  return { ...state, loadout: ['potion', null, null, null] };
}

// One-time migration for saves from before per-save settings existed -
// same default createNewGame() gives a fresh save.
export function migrateSettings(state) {
  if ('settings' in state) return state;
  return { ...state, settings: { itemMenuAutoCloseMs: DEFAULT_ITEM_MENU_AUTO_CLOSE_MS } };
}

const DEFAULT_AUDIO_SETTINGS = {
  soundTheme: 'realistic',
  audioCombatVolume: 0.8, audioCombatMuted: false,
  audioUiVolume: 0.8, audioUiMuted: false,
  audioWorldVolume: 0.8, audioWorldMuted: false,
  audioMusicVolume: 0.6, audioMusicMuted: false,
};

// One-time migration for saves from before per-category audio settings
// existed - merges in only the fields that are missing, so a player who's
// already adjusted a slider on a save made mid-rollout never gets it reset.
export function migrateAudioSettings(state) {
  return { ...state, settings: { ...DEFAULT_AUDIO_SETTINGS, ...state.settings } };
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
