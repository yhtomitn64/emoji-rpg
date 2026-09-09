import { DEFAULT_DUNGEON_ENTRANCE_POSITION, DEFAULT_ITEM_MENU_AUTO_CLOSE_MS } from '../state.js';
import { upsertSlot } from './saveSlots.js';

// Hardcoded characters for local testing only, raised 2026-09-04 while
// verifying the battle-popup collision fix needed a level with every
// ability unlocked. Deliberately not a general character-editor/cheat
// system - just enough to name a fixed state and reach it via a URL
// param instead of hand-pasting a console script each time. Each one is
// a full js/state.js-shaped state object (every field createNewGame()
// would set), so it needs no migrations and works with every screen
// exactly like a real save - the only thing "fake" about it is how it
// was created.
const DEBUG_CHARACTERS = {
  // All 5 abilities unlock by level 10 (js/systems/abilities.js) - built
  // for exercising real battles (crits, ability rotations, group fights)
  // against the claimPopupColumn collision fix.
  level10: () => ({
    player: { level: 10, xp: 0, hp: 54, maxHp: 54, attack: 18, defense: 12, speed: 14, gold: 500, emoji: '🧙' },
    equipment: { weapon: 'ironSword', head: 'ironHelm', body: 'ironArmor', legs: 'ironGreaves', accessory: null, ring1: null, ring2: null },
    // +3 on every piece - the NG+0 upgrade cap (getMaxUpgradeLevel in
    // js/systems/inventory.js) - for meaningful, but not absurd, damage.
    upgrades: { 'ironSword:plain': 3, 'ironHelm:plain': 3, 'ironArmor:plain': 3, 'ironGreaves:plain': 3 },
    equipmentTiers: {},
    inventory: [
      { itemId: 'potion', quantity: 10 },
      { itemId: 'axe', quantity: 1 },
      { itemId: 'miningPick', quantity: 1 },
      { itemId: 'boat', quantity: 1 },
      { itemId: 'ironScrap', quantity: 5 },
    ],
    loadout: ['potion', null, null, null],
    map: 'center',
    position: null,
    flags: { dungeonBossDefeated: false, firstKillCelebrated: true },
    visited: {},
    seenScreens: {},
    caches: {},
    miniDungeons: {},
    activeMiniDungeon: null,
    portal: null,
    bossTier: 0,
    ngPlusCycle: 0,
    questProgress: { boar: 0, bat: 0, snake: 0, goblin: 0, direWolf: 0, spider: 0, orc: 0, wraith: 0 },
    questLevel: { boar: 1, bat: 1, snake: 1, goblin: 1, direWolf: 1, spider: 1, orc: 1, wraith: 1 },
    monsterKillCounts: { boar: 0, bat: 0, snake: 0, goblin: 0, direWolf: 0, spider: 0, orc: 0, wraith: 0 },
    // Starts empty on purpose - the first several hits will each beat the
    // (nonexistent) recorded best and pop a New Max! badge, which is
    // exactly the collision case this character exists to exercise.
    bestDamage: {},
    gateRewards: {},
    clearedGates: {},
    lossStreak: 0,
    encounterCooldown: 0,
    zone1Steps: 0,
    dungeonEntrancePosition: DEFAULT_DUNGEON_ENTRANCE_POSITION,
    settings: {
      itemMenuAutoCloseMs: DEFAULT_ITEM_MENU_AUTO_CLOSE_MS,
      soundTheme: 'realistic',
      audioCombatVolume: 0.8, audioCombatMuted: false,
      audioUiVolume: 0.8, audioUiMuted: false,
      audioWorldVolume: 0.8, audioWorldMuted: false,
      audioMusicVolume: 0.6, audioMusicMuted: false,
      featureFlags: { audioBeta: false, mechanicExplainersBeta: false },
    },
  }),
};

// Reads ?debug=<key> from the given query string (defaults to the real
// page's) and, if it names a known debug character, upserts a save slot
// for it - visible in the normal save-slot list like any other save,
// picked the normal way, deletable the normal way. A no-op for anyone who
// hasn't typed this param, so it carries no risk for a real player who
// just opens the site normally.
export function applyDebugCharacterFromUrl(search = globalThis.location?.search, storage = globalThis.localStorage) {
  const key = new URLSearchParams(search || '').get('debug');
  const factory = DEBUG_CHARACTERS[key];
  if (!factory) return null;
  const id = `debug-${key}`;
  const state = factory();
  upsertSlot(id, `[Debug] ${key}`, state, storage);
  return id;
}
