import { DEFAULT_DUNGEON_ENTRANCE_POSITION, DEFAULT_ITEM_MENU_AUTO_CLOSE_MS } from '../state.js';
import { upsertSlot } from './saveSlots.js';
import { QUEST_REQUIREMENTS, getQuestRequirement } from './quests.js';

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
    equipment: { weapon: 'ironSword', head: 'ironHelm', body: 'ironArmor', legs: 'ironGreaves', accessory1: null, accessory2: null, ring1: null, ring2: null },
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
  // Built 2026-09-10 at Timothy's request while visually checking the map's
  // static-layer cache: "make our super test character have walking lines
  // all over and different thickness to really stress the system", plus a
  // portal, full quests to turn in, and enough power to ignore anything that
  // wanders into the way. Every one of those is a thing the renderer has to
  // draw, so this is really a rendering stress fixture that happens to be a
  // character.
  stress: () => {
    const base = DEBUG_CHARACTERS.level10();
    return {
      ...base,
      player: { level: 20, xp: 0, hp: 400, maxHp: 400, attack: 120, defense: 90, speed: 40, gold: 99999, emoji: '🧙' },
      equipment: {
        weapon: 'ironSword', head: 'ironHelm', body: 'ironArmor', legs: 'ironGreaves',
        accessory1: null, accessory2: null, ring1: null, ring2: null,
      },
      inventory: [
        { itemId: 'potion', quantity: 99 },
        { itemId: 'axe', quantity: 1 },
        { itemId: 'miningPick', quantity: 1 },
        { itemId: 'boat', quantity: 1 },
        { itemId: 'ironScrap', quantity: 99 },
      ],
      // Every quest sitting at a turn-in-ready count, so the quest board
      // glows the moment the character loads rather than needing a grind
      // first - the glow is one of the things whose paint order moved.
      questProgress: Object.fromEntries(
        Object.keys(QUEST_REQUIREMENTS).map((id) => [id, getQuestRequirement(id, 1)]),
      ),
      // A placed return portal, so the portal marker, its outward-bleeding
      // shadow and its pull animation can all be looked at without first
      // finding and using a portal scroll.
      portal: { map: 'center', x: 10, y: 10 },
      visited: buildStressTrails(),
    };
  },
};

// Wall-to-wall worn path across the whole 5x5 wilderness cluster, at every
// wear level the trail supports.
//
// Deliberately not a uniform flood-fill: trail stroke width scales with visit
// count up to TRAIL_WEAR_CAP (js/systems/trail.js), and the widths of two
// adjacent tiles are averaged for the stroke between them, so a map where
// every tile has the same count exercises exactly one width and none of the
// blending. Banding the counts instead puts every width, every taper and
// every join on screen at once - which is the point of a stress fixture.
//
// `dirs` is what decides how many strokes a tile draws, so giving most tiles
// all four is the worst case on purpose: four gradient-stroked curves plus a
// hub per tile, which is what made the trail ~92% of all draw calls in the
// measurements behind docs/superpowers/plans/2026-09-10-static-layer-cache-plan.md.
function buildStressTrails() {
  const WILDERNESS = [
    'center', 'north', 'south', 'east', 'west',
    'northeast', 'northwest', 'southeast', 'southwest',
    'farNorthwest', 'northNorthwest', 'farNorth', 'northNortheast', 'farNortheast',
    'westNorthwest', 'farWest', 'westSouthwest',
    'eastNortheast', 'farEast', 'eastSoutheast',
    'southSouthwest', 'farSouth', 'southSoutheast',
    'farSouthwest', 'farSoutheast',
  ];
  const W = 30;
  const H = 22;

  // Wear count per tile. Banded rather than uniform: stroke width scales with
  // visit count up to TRAIL_WEAR_CAP, and two neighbours average their widths
  // for the stroke between them, so a flat fill would exercise exactly one
  // width and none of the blending.
  const countAt = (x, y) => 1 + ((x + y * 3) % 10);

  // Which edges are crossed, decided PER EDGE rather than per tile, so both
  // tiles sharing an edge always agree about it.
  //
  // This matters more than it looks. Real play can only ever produce symmetric
  // edges - a step calls markDirection on the tile being left and markVisited
  // with the opposite direction on the tile being entered, both halves of one
  // crossing (js/systems/exploration.js). The first version of this fixture
  // picked each tile's dirs from a hash independently, which let a tile reach
  // a stroke toward a neighbour that drew nothing back, so the stroke stopped
  // dead at the tile boundary. Timothy saw exactly that and reasonably read it
  // as a rendering bug: "path having square edge when dark/thick meets either
  // thin/light or non-existing path". A fixture that generates states the game
  // cannot produce costs more than it is worth.
  const hasEdge = (x, y, horizontal) => {
    const h = (x * 7919 + y * 104729 + (horizontal ? 1 : 0) * 15485863) % 97;
    return h > 12;   // ~87% of edges crossed: dense, with real dead ends in it
  };

  const visited = {};
  for (const screenId of WILDERNESS) {
    const tiles = {};
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dirs = [];
        // Each edge is asked about once, from whichever side; both tiles read
        // the same answer for it.
        if (y > 0 && hasEdge(x, y - 1, false)) dirs.push('n');
        if (y < H - 1 && hasEdge(x, y, false)) dirs.push('s');
        if (x > 0 && hasEdge(x - 1, y, true)) dirs.push('w');
        if (x < W - 1 && hasEdge(x, y, true)) dirs.push('e');
        tiles[`${x},${y}`] = { count: countAt(x, y), dirs };
      }
    }
    visited[screenId] = tiles;
  }
  return visited;
}


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

// Raised 2026-09-09 for local perf/manual testing (see BACKLOG.md's map
// render perf follow-up) - "?noEncounters=1" skips every random encounter
// roll (mapScreen.js's tryMove) so movement/panning can be exercised at
// speed without a fight interrupting every few steps. Deterministic
// tile-triggered fights (guardians, bosses) are untouched - those sit on a
// specific tile the player can just route around, not something in the way
// of testing movement itself. Combinable with ?debug=<key> above, e.g.
// "?debug=level10&noEncounters=1".
export function isNoEncountersDebugFlagSet(search = globalThis.location?.search) {
  return new URLSearchParams(search || '').get('noEncounters') === '1';
}
