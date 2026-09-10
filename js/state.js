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

// How long the map camera takes to slide to a new position, in ms. Only
// meaningful under the canvas map renderer (js/screens/mapCanvasRenderer.js),
// whose camera is a real pixel offset it can interpolate - the old DOM
// renderer moved the camera a whole tile at a time by definition.
//
// 0 is a deliberately supported value, not a degenerate one: it reproduces
// the instant tile-snap the game had before the canvas rewrite exactly, so
// the slider spans "exactly how it used to feel" through to a visible glide
// rather than only offering degrees of a new behavior.
export const DEFAULT_CAMERA_SMOOTHING_MS = 80;
export const MAX_CAMERA_SMOOTHING_MS = 250;

const DEFAULT_AUDIO_SETTINGS = {
  soundTheme: 'realistic',
  audioCombatVolume: 0.8, audioCombatMuted: false,
  audioUiVolume: 0.8, audioUiMuted: false,
  audioWorldVolume: 0.8, audioWorldMuted: false,
  audioMusicVolume: 0.6, audioMusicMuted: false,
};

// Display preferences - plain on-by-default toggles, not feature flags:
// they're finished behavior a player might simply not want on screen, so
// they live above the "Feature Flags" section in Settings rather than
// inside it. showXpInHud puts the XP-to-next-level bar in the top HUD;
// the same numbers have always been on the Stats screen, this is the
// always-visible version (raised 2026-09-10: "I know it's in the stats
// screen but maybe something a bit more visible somewhere too").
const DEFAULT_HUD_SETTINGS = {
  showXpInHud: true,
};

// In-progress features gated behind a visible Settings toggle rather than a
// hidden unlock - this is a small personal project with a handful of known
// players, so "off by default, flip it on when you want to help test" is
// fine instead of needing a LaunchDarkly-style hidden rollout mechanism.
const DEFAULT_FEATURE_FLAGS = {
  audioBeta: false,
  mechanicExplainersBeta: false,
  cloudSaveBeta: false,
};

// Deliberately crypto.randomUUID(), not the Math.random()-based pattern
// generateSlotId (js/systems/saveSlots.js) and randomSessionId
// (js/systems/telemetry.js) use - createNewGame() runs inside plenty of
// existing tests that mock Math.random with an exact scripted sequence for
// deterministic RNG assertions (discovery rolls, encounter rolls, etc.);
// consuming one of those calls here shifted every roll after it by one and
// broke several unrelated-looking tests the first time this was tried.
// randomUUID() sidesteps that entirely by never touching Math.random.
// Available in both this project's runtime targets: Node 19+ (CI runs 22)
// and any real browser in a secure context, which https://rpg.burghertime.com
// and a localhost dev server both are.
function generateCharacterId() {
  return crypto.randomUUID();
}

export function createNewGame(heroEmoji = DEFAULT_HERO_EMOJI, dungeonEntrancePosition = DEFAULT_DUNGEON_ENTRANCE_POSITION) {
  return {
    // A stable identity that travels with the save through cloud-save
    // export/import (js/systems/cloudSave.js) - never regenerated once set,
    // unlike the slot id (js/systems/saveSlots.js), which is local to one
    // browser's save list. Lets a re-import of the same character be
    // recognized as an update to an existing local slot instead of always
    // creating a duplicate - see migrateCharacterId below and
    // findSlotByCharacterId in saveSlots.js.
    characterId: generateCharacterId(),
    player: { level: 1, xp: 0, hp: 20, maxHp: 20, attack: 5, defense: 3, speed: 5, gold: 20, emoji: heroEmoji },
    equipment: { weapon: 'starterSword', head: null, body: null, legs: null, accessory1: null, accessory2: null, ring1: null, ring2: null },
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
      cameraSmoothingMs: DEFAULT_CAMERA_SMOOTHING_MS,
      ...DEFAULT_AUDIO_SETTINGS,
      ...DEFAULT_HUD_SETTINGS,
      featureFlags: { ...DEFAULT_FEATURE_FLAGS },
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

// One-time migration for saves from before the second charm/accessory slot
// existed (2026-09-09, "we should have two charm slots") - same shape as
// migrateRingSlots above. Relocates whatever was sitting in the old single
// `accessory` physical key into `accessory1` (guaranteed empty, since it
// never existed before this migration runs) and adds the new `accessory2`
// key. Must run after migrateRingSlots/migratePowerRingSlot, which still
// read/write the legacy `accessory` key themselves (moving emberRing/
// powerRing out of it) - this is the one place that finally retires it.
// Also carries over equipmentTiers.accessory the same way, so a Fine/
// Superior charm doesn't silently revert to Plain mid-migration.
export function migrateAccessorySlots(state) {
  if ('accessory1' in state.equipment && 'accessory2' in state.equipment) return state;
  const { accessory, ...restEquipment } = state.equipment;
  const equipment = { ...restEquipment, accessory1: accessory ?? null, accessory2: null };
  const { accessory: accessoryTier, ...restTiers } = state.equipmentTiers || {};
  const equipmentTiers = accessoryTier !== undefined ? { ...restTiers, accessory1: accessoryTier } : { ...restTiers };
  return { ...state, equipment, equipmentTiers };
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

// One-time migration for saves from before per-category audio settings
// existed - merges in only the fields that are missing, so a player who's
// already adjusted a slider on a save made mid-rollout never gets it reset.
export function migrateAudioSettings(state) {
  return { ...state, settings: { ...DEFAULT_AUDIO_SETTINGS, ...state.settings } };
}

// One-time migration for saves from before the map camera could be smoothed
// (added 2026-09-09 with the canvas map renderer). Uses `in` rather than a
// falsy check because 0 is a real, deliberately-chosen value here - "snap
// instantly, exactly like the old renderer" - and `|| DEFAULT` would quietly
// overwrite it every single load.
export function migrateCameraSettings(state) {
  if (state.settings && 'cameraSmoothingMs' in state.settings) return state;
  return {
    ...state,
    settings: { ...state.settings, cameraSmoothingMs: DEFAULT_CAMERA_SMOOTHING_MS },
  };
}

// One-time migration for saves from before the HUD display toggles existed
// - merges in only missing keys, same shape as migrateAudioSettings, so a
// save where the player has already turned one off doesn't get it switched
// back on the next time they load.
export function migrateHudSettings(state) {
  return { ...state, settings: { ...DEFAULT_HUD_SETTINGS, ...state.settings } };
}

// One-time migration for saves from before feature flags existed - merges
// in only missing flags, so a save that already has one set (e.g. a
// friend's save with audioBeta already toggled on) keeps that value.
export function migrateFeatureFlags(state) {
  return {
    ...state,
    settings: {
      ...state.settings,
      featureFlags: { ...DEFAULT_FEATURE_FLAGS, ...state.settings.featureFlags },
    },
  };
}

// One-time migration for saves from before characterId existed (raised
// 2026-09-09 while building cloud-save import: "what if you import
// characters with the same name? how do we know it's the same character" -
// display names aren't reliable/unique, this id is). A save that predates
// this field gets one assigned the first time it's loaded; an exported
// save from before this migration ever ran simply has no characterId at
// all, so findSlotByCharacterId (saveSlots.js) never matches it against
// anything - it just imports as a new slot, same as it always did.
export function migrateCharacterId(state) {
  if (state.characterId) return state;
  return { ...state, characterId: generateCharacterId() };
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
