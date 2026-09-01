// Real DOM tests for js/screens/mapScreen.js, using jsdom (see
// tests/helpers/dom.js). Scope: DOM structure driven by state, not pixel-
// level rendering - see battleScreenDom.test.js's own header for why this
// pattern exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, keydown } from './helpers/dom.js';
import { createNewGame } from '../js/state.js';
import { townMap } from '../js/maps/townMap.js';
import { buildWorldGrid } from '../js/systems/worldGrid.js';
import { isGateCleared } from '../js/systems/toolGates.js';

function baseState(overrides = {}) {
  return { ...createNewGame(), position: { ...townMap.startPosition }, ...overrides };
}

async function mountTown(state) {
  const { mount } = await import('../js/screens/mapScreen.js');
  const root = createRoot();
  const maps = { town: townMap };
  mount(root, { state, mapConfig: townMap, maps, worldGrid: buildWorldGrid(maps), callbacks: { onFirstVisit: () => {} } });
  return root;
}

test('mapScreen DOM - quest board glow', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('quest board tile has no glow class with no quests complete', async () => {
    const root = await mountTown(baseState());
    assert.equal(root.querySelector('.map-tile-quest-ready'), null);
  });

  await t.test('quest board tile gets the glow class once a quest is turn-in ready', async () => {
    const root = await mountTown(baseState({ questProgress: { boar: 3 } }));
    assert.ok(root.querySelector('.map-tile-quest-ready'), 'expected the quest board tile to carry the glow class');
  });

  await t.test('quest board tile loses the glow class once every ready quest is turned in', async () => {
    const root = await mountTown(baseState({ questProgress: { boar: 0 } }));
    assert.equal(root.querySelector('.map-tile-quest-ready'), null);
  });

  // jsdom's clientWidth/clientHeight always read 0 (no real layout engine),
  // so mapScreen.js falls back to DEFAULT_VIEWPORT_TILES_WIDE/TALL - every
  // one of those viewport cells must render its own .map-tile div, even the
  // ones landing outside town's real 8x6 extent (town is far smaller than
  // the fallback viewport, so most cells resolve to nothing and render
  // content-less - see render()'s `if (!resolved)` branch). A regression
  // here (e.g. skipping unresolved cells outright instead of rendering an
  // empty placeholder) previously let CSS grid auto-flow silently pack the
  // real cells into the wrong rows/columns without any test catching it.
  await t.test('every viewport cell renders its own .map-tile div, including ones outside the map itself', async () => {
    const root = await mountTown(baseState());
    const tileCount = root.querySelectorAll('.map-tile').length;
    assert.equal(tileCount, 21 * 13, 'expected one .map-tile per viewport cell (DEFAULT_VIEWPORT_TILES_WIDE x DEFAULT_VIEWPORT_TILES_TALL)');
  });
});

test('mapScreen DOM - portal tiles', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('origin portal tile renders (and no return tile yet) when state.portal exists with returnPending false', async () => {
    // originX/Y (2,2) deliberately differs from baseState()'s player
    // position (townMap.startPosition, 7,9) - a tile the player is
    // standing on renders the hero emoji instead of the tile's own (see
    // render()'s isPlayer branch), so testing at the player's own position
    // would hide the very thing this test checks for.
    const state = baseState({ portal: { originScreenId: 'town', originX: 2, originY: 2, returnPending: false } });
    const root = await mountTown(state);
    const originCell = root.querySelector('.map-tile-portal-origin');
    assert.ok(originCell, 'expected the origin portal tile to render');
    assert.ok(originCell.textContent.includes('🌌'), 'expected the portal emoji on the origin tile');
    assert.equal(root.querySelector('.map-tile-portal-return'), null, 'return portal should not render until returnPending is true');
  });

  await t.test('return portal tile renders at the fixed town spot once returnPending is true, origin tile is on a different screen so does not render here', async () => {
    const state = baseState({ portal: { originScreenId: 'north', originX: 3, originY: 3, returnPending: true } });
    const root = await mountTown(state);
    const returnCell = root.querySelector('.map-tile-portal-return');
    assert.ok(returnCell, 'expected the return portal tile to render');
    assert.ok(returnCell.textContent.includes('🌌'), 'expected the portal emoji on the return tile');
    assert.equal(root.querySelector('.map-tile-portal-origin'), null, "origin tile is on 'north', not 'town' - should not render in this mount");
  });

  await t.test('no portal tile anywhere when state.portal is null', async () => {
    const root = await mountTown(baseState({ portal: null }));
    assert.equal(root.querySelector('.map-tile-portal-origin'), null);
    assert.equal(root.querySelector('.map-tile-portal-return'), null);
  });
});

test('mapScreen DOM - portal hotkey', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('pressing P dispatches the usePortalTool action', async () => {
    const { mount } = await import('../js/screens/mapScreen.js');
    const root = createRoot();
    const maps = { town: townMap };
    const seenActions = [];
    mount(root, {
      state: baseState(),
      mapConfig: townMap,
      maps,
      worldGrid: buildWorldGrid(maps),
      callbacks: { onFirstVisit: () => {}, onAction: (action) => seenActions.push(action) },
    });
    keydown('p');
    assert.deepEqual(seenActions, ['usePortalTool']);
  });

  await t.test('pressing shift+P (uppercase P) also dispatches the usePortalTool action', async () => {
    const { mount } = await import('../js/screens/mapScreen.js');
    const root = createRoot();
    const maps = { town: townMap };
    const seenActions = [];
    mount(root, {
      state: baseState(),
      mapConfig: townMap,
      maps,
      worldGrid: buildWorldGrid(maps),
      callbacks: { onFirstVisit: () => {}, onAction: (action) => seenActions.push(action) },
    });
    keydown('P');
    assert.deepEqual(seenActions, ['usePortalTool']);
  });
});

// Old Safari-specific bug: a CSS Grid whose tracks size aspect-ratio
// children (.map-grid / .map-tile) didn't reliably re-run its track-sizing
// pass on a live window resize. The grid is fixed-pixel-sized now (not
// 1fr-stretched), and render() rebuilds the whole viewport/grid from
// scratch, so this now just confirms a resize triggers a fresh render
// rather than leaving the old grid element in place.
test('mapScreen DOM - resize triggers a fresh render', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('window resize replaces the mounted map grid element', async () => {
    const root = await mountTown(baseState());
    const gridBefore = root.querySelector('.map-grid');

    window.dispatchEvent(new Event('resize'));

    const gridAfter = root.querySelector('.map-grid');
    assert.ok(gridAfter, 'expected a .map-grid element to still exist after resize');
    assert.notEqual(gridBefore, gridAfter, 'expected resize to rebuild the map grid element');
  });
});

// Two tiny synthetic screens (same fakeScreen-style minimalism as
// worldGrid.test.js), linked west/east, with a tool-gated mountain sitting
// right on the shared boundary's far side. This exercises tryMove's real
// keyboard path end to end across a screen crossing - not just a hand-trace
// of the code - since nothing else in this file drives tryMove at all.
// Regresses the bug this task fixed: crossing a screen boundary onto a
// tool-gated tile used to teleport past tryMove's own passability check
// entirely (the old onEdgeTransition path), so a pick-in-hand player
// landing on a mountain never converted it to rubble.
test('mapScreen DOM - crossing a screen boundary onto a tool-gated tile', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('a single step across the boundary clears the mountain, same as any mid-screen step', async () => {
    const westScreen = {
      id: 'west',
      legend: { '.': 'grass' },
      rows: ['...', '...', '...'],
      neighbors: { east: 'east' },
      monsterTable: [],
      encounterChance: 0,
      cacheChance: 0,
    };
    // Left column is a mountain wall of 'M' tiles - x=0 is the tile
    // immediately across the shared boundary with `west`. Top/bottom rows
    // (y=0, y=2) are unused by this test but would render as mountainWall
    // regardless of legend content (isSealedWorldEdge - east has no
    // north/south neighbor), which is fine since the crossing happens on
    // the middle row (y=1).
    const eastScreen = {
      id: 'east',
      legend: { '.': 'grass', M: 'mountain' },
      rows: ['M..', 'M..', 'M..'],
      neighbors: { west: 'west' },
      monsterTable: [],
      encounterChance: 0,
      cacheChance: 0,
    };
    const maps = { west: westScreen, east: eastScreen };
    const worldGrid = buildWorldGrid(maps);
    // toolGateHintsShown is normally back-filled onto state by main.js's own
    // migration (see main.js), not part of createNewGame()'s defaults -
    // checkGateProximity (called at the end of every successful tryMove)
    // needs it present or it throws reading an undefined object.
    const state = baseState({
      position: { x: 2, y: 1 },
      inventory: [{ itemId: 'miningPick', quantity: 1 }],
      toolGateHintsShown: {},
    });

    const { mount } = await import('../js/screens/mapScreen.js');
    const root = createRoot();
    mount(root, {
      state,
      mapConfig: westScreen,
      maps,
      worldGrid,
      callbacks: {
        onFirstVisit: () => {},
        onMove: () => {},
        onToolGateCleared: () => {},
        onLockedGate: () => {},
        onToolGateNearby: () => {},
        onAction: () => {},
        onEnterMiniDungeon: () => {},
        onCacheFound: () => {},
        onGateReward: () => {},
        onEncounter: () => {},
      },
    });

    // west is 3 tiles wide (x: 0..2); starting at x=2, one step east
    // resolves past west's own local bounds and onto east's (0, 1) - the
    // mountain tile - via worldGrid, not a teleport.
    keydown('ArrowRight');

    assert.equal(state.map, 'east', 'expected the current screen to swap to east after crossing the boundary');
    assert.equal(
      isGateCleared(state.clearedGates, 'east', 0, 1),
      true,
      'expected the mountain tile crossed into from another screen to be marked cleared, same as a mid-screen tool-gate crossing',
    );
  });
});

// Raised 2026-08-29: two random encounters back to back (fight, move one
// square, fight again) felt bad even though it's rare per-pair - nothing
// guaranteed a break after a fight ended. encounterChance: 1 below makes
// every eligible step fire if the cooldown isn't blocking it, isolating the
// cooldown's own on/off behavior from the underlying random roll.
test('mapScreen DOM - encounter cooldown blocks the next few steps after a random encounter', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('no repeat encounter for ENCOUNTER_COOLDOWN_STEPS steps, then rolls again', async () => {
    // 3 rows tall so the walked middle row (y=1) isn't itself a sealed
    // north/south world edge (isSealedWorldEdge treats a screen with no
    // neighbors as sealed on every side of its own bounding box); starting
    // at x=1 (not the sealed west edge) leaves x=2..5 as four movable,
    // non-edge interior steps for the four ArrowRight presses below.
    const plains = {
      id: 'plains',
      legend: { '.': 'grass' },
      rows: ['.......', '.......', '.......'],
      neighbors: {},
      monsterTable: ['boar'],
      encounterChance: 1,
      cacheChance: 0,
    };
    const maps = { plains };
    const worldGrid = buildWorldGrid(maps);
    const state = baseState({ position: { x: 1, y: 1 } });

    let encounterCount = 0;
    const { mount } = await import('../js/screens/mapScreen.js');
    const root = createRoot();
    mount(root, {
      state,
      mapConfig: plains,
      maps,
      worldGrid,
      callbacks: {
        onFirstVisit: () => {},
        onMove: () => {},
        onToolGateCleared: () => {},
        onLockedGate: () => {},
        onToolGateNearby: () => {},
        onAction: () => {},
        onEnterMiniDungeon: () => {},
        onCacheFound: () => {},
        onGateReward: () => {},
        onEncounter: () => { encounterCount += 1; },
      },
    });

    keydown('ArrowRight'); // move 1: fires, cooldown set to 2
    assert.equal(encounterCount, 1, 'expected the first step onto an always-fire tile to trigger an encounter');

    keydown('ArrowRight'); // move 2: cooldown 2 -> 1, blocked
    assert.equal(encounterCount, 1, 'expected the step right after an encounter to be blocked by the cooldown');

    keydown('ArrowRight'); // move 3: cooldown 1 -> 0, blocked
    assert.equal(encounterCount, 1, 'expected the second step after an encounter to still be blocked by the cooldown');

    keydown('ArrowRight'); // move 4: cooldown at 0, rolls again
    assert.equal(encounterCount, 2, 'expected the encounter roll to resume once the cooldown has fully counted down');
  });
});

test('mapScreen DOM - zone-1 step tracking', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('a step on a zone-1 wilderness screen increments state.zone1Steps', async () => {
    // 7 columns wide (not 3) so a single ArrowRight step from x=1 lands on
    // x=2, a genuine interior tile - a 3-wide row's x=2 is the sealed east
    // world edge (isSealedWorldEdge treats a screen with no neighbors as
    // sealed on every side of its own bounding box), which renders as an
    // impassable mountainWall and would silently block the move entirely
    // (same reasoning as the encounter-cooldown test's own `plains` fixture
    // above).
    const northScreen = {
      id: 'north',
      legend: { '.': 'grass' },
      rows: ['.......', '.......', '.......'],
      neighbors: {},
      monsterTable: [],
      encounterChance: 0,
      cacheChance: 0,
    };
    const maps = { north: northScreen };
    const worldGrid = buildWorldGrid(maps);
    // state.map must already match mapConfig.id here, same as it would in
    // real play (main.js keeps them in sync) - tryMove only re-syncs
    // state.map on an actual screen-boundary crossing, and this single-
    // screen synthetic map never crosses one, so without this override
    // state.map would stay stuck on createNewGame()'s 'center' default.
    const state = baseState({ position: { x: 1, y: 1 }, map: 'north' });
    const { mount } = await import('../js/screens/mapScreen.js');
    const root = createRoot();
    mount(root, {
      state, mapConfig: northScreen, maps, worldGrid,
      callbacks: {
        onFirstVisit: () => {}, onMove: () => {}, onToolGateCleared: () => {}, onLockedGate: () => {},
        onToolGateNearby: () => {}, onAction: () => {}, onEnterMiniDungeon: () => {}, onCacheFound: () => {},
        onGateReward: () => {}, onEncounter: () => {},
      },
    });
    assert.equal(state.zone1Steps, 0);
    keydown('ArrowRight');
    assert.equal(state.zone1Steps, 1);
  });

  await t.test('a step on the town screen does not increment state.zone1Steps', async () => {
    // Same 7-wide rationale as the zone-1 screen above - keeps this a real
    // step onto an interior tile rather than a move silently blocked by the
    // sealed world edge, so the assertion actually exercises "a real step on
    // town doesn't increment" rather than "a blocked non-step doesn't".
    const centerScreen = {
      id: 'center',
      legend: { '.': 'grass' },
      rows: ['.......', '.......', '.......'],
      neighbors: {},
      monsterTable: [],
      encounterChance: 0,
      cacheChance: 0,
    };
    const maps = { center: centerScreen };
    const worldGrid = buildWorldGrid(maps);
    // 'center' already matches createNewGame()'s default state.map, but set
    // it explicitly for symmetry with the zone-1 test above rather than
    // relying on that coincidence.
    const state = baseState({ position: { x: 1, y: 1 }, map: 'center' });
    const { mount } = await import('../js/screens/mapScreen.js');
    const root = createRoot();
    mount(root, {
      state, mapConfig: centerScreen, maps, worldGrid,
      callbacks: {
        onFirstVisit: () => {}, onMove: () => {}, onToolGateCleared: () => {}, onLockedGate: () => {},
        onToolGateNearby: () => {}, onAction: () => {}, onEnterMiniDungeon: () => {}, onCacheFound: () => {},
        onGateReward: () => {}, onEncounter: () => {},
      },
    });
    keydown('ArrowRight');
    assert.equal(state.zone1Steps, 0);
  });
});

test('mapScreen DOM - group encounter roll passes monsterTable/ngPlusCycle/zone1Steps through', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('a forced encounter past the kill threshold can roll a mixed-species group', async () => {
    const originalRandom = Math.random;
    // Verified against a real run of this exact scenario (not just read from
    // source) - js/screens/mapScreen.js's tryMove makes/triggers Math.random()
    // calls in this exact order for one step onto a tile with tile.encounter
    // true: (1) js/systems/discovery.js's resolveStepDiscovery, mini-dungeon
    // check (mapConfig.miniDungeonChance is undefined below, so this always
    // misses regardless of the value rolled - still consumes one call), (2)
    // resolveStepDiscovery's cache check (cacheChance: 0 below, same deal -
    // always misses, still consumes one call), (3) the encounterChance roll
    // (must be < 1), (4) rollEliteEncounter's own roll
    // (js/systems/eliteEncounter.js, ELITE_ENCOUNTER_CHANCE = 0.05 - must
    // roll >= 0.05 to miss), (5) picking monsterId out of monsterTable
    // (floor(val * 3) into ['boar','bat','snake'] - 0.01 -> index 0, 'boar'),
    // then js/systems/groupEncounters.js's own rollEncounterGroup takes over:
    // (6) the group-spawn-chance roll (must be < 0.3 to hit), (7) the size
    // roll (0.99 -> the effective max, 4, since effectiveGroupSizeMax(0, 0)
    // = GROUP_SIZE_MAX_BASE = 4), then (8)-(10) one species pick per of the
    // 3 extra slots - 0.01/0.4/0.7 into the same 3-species table picks index
    // 0/1/2 ('boar'/'bat'/'snake'). Confirmed this sequence actually produces
    // ['boar', 'boar', 'bat', 'snake'] against Task 1 + this task's own
    // call-site change, both applied.
    const sequence = [0.5, 0.5, 0.01, 0.99, 0.01, 0.01, 0.99, 0.01, 0.4, 0.7];
    let i = 0;
    Math.random = () => sequence[Math.min(i++, sequence.length - 1)];
    try {
      const northScreen = {
        id: 'north',
        legend: { '.': 'grass' },
        rows: ['...', '...', '...'],
        neighbors: {},
        monsterTable: ['boar', 'bat', 'snake'],
        encounterChance: 1,
        cacheChance: 0,
      };
      const maps = { north: northScreen };
      const worldGrid = buildWorldGrid(maps);
      const state = baseState({
        position: { x: 0, y: 1 },
        monsterKillCounts: { boar: 10, bat: 10, snake: 10 },
      });
      const { mount } = await import('../js/screens/mapScreen.js');
      const root = createRoot();
      let encounteredIds = null;
      mount(root, {
        state, mapConfig: northScreen, maps, worldGrid,
        callbacks: {
          onFirstVisit: () => {}, onMove: () => {}, onToolGateCleared: () => {}, onLockedGate: () => {},
          onToolGateNearby: () => {}, onAction: () => {}, onEnterMiniDungeon: () => {}, onCacheFound: () => {},
          onGateReward: () => {}, onEncounter: (ids) => { encounteredIds = ids; },
        },
      });
      keydown('ArrowRight');
      assert.ok(encounteredIds, 'expected an encounter to fire');
      assert.ok(encounteredIds.length > 1, 'expected a group, not a solo encounter');
    } finally {
      Math.random = originalRandom;
    }
  });

  await t.test('ngPlusCycle and zone1Steps escalate the group size through to the real call site', async () => {
    const originalRandom = Math.random;
    // Verified by running this exact scenario against the real implementation.
    // Same call order as the "mixed-species group" test above:
    // (1) mini-dungeon check (always misses, miniDungeonChance undefined),
    // (2) cache check (always misses, cacheChance: 0), (3) encounterChance
    // (< 1), (4) elite roll (>= 0.05 to miss), (5) monsterId pick (0.01 ->
    // index 0, 'boar'), then rollEncounterGroup's own calls: (6) group-chance
    // roll (must be < groupSpawnChance(2) = 0.5), (7) size roll (0.99 ->
    // effectiveGroupSizeMax(2, 900) = min(6, 4 + 2 + floor(900/300)) = 6),
    // then (8)-(12) one species pick per of the 5 extra slots.
    const sequence = [0.5, 0.5, 0.01, 0.99, 0.01, 0.01, 0.99, 0.01, 0.4, 0.7, 0.2, 0.99];
    let i = 0;
    Math.random = () => sequence[Math.min(i++, sequence.length - 1)];
    try {
      const northScreen = {
        id: 'north',
        legend: { '.': 'grass' },
        rows: ['...', '...', '...'],
        neighbors: {},
        monsterTable: ['boar', 'bat', 'snake'],
        encounterChance: 1,
        cacheChance: 0,
      };
      const maps = { north: northScreen };
      const worldGrid = buildWorldGrid(maps);
      const state = baseState({
        position: { x: 0, y: 1 },
        monsterKillCounts: { boar: 10, bat: 10, snake: 10 },
        ngPlusCycle: 2,
        zone1Steps: 900,
      });
      const { mount } = await import('../js/screens/mapScreen.js');
      const root = createRoot();
      let encounteredIds = null;
      mount(root, {
        state, mapConfig: northScreen, maps, worldGrid,
        callbacks: {
          onFirstVisit: () => {}, onMove: () => {}, onToolGateCleared: () => {}, onLockedGate: () => {},
          onToolGateNearby: () => {}, onAction: () => {}, onEnterMiniDungeon: () => {}, onCacheFound: () => {},
          onGateReward: () => {}, onEncounter: (ids) => { encounteredIds = ids; },
        },
      });
      keydown('ArrowRight');
      assert.ok(encounteredIds, 'expected an encounter to fire');
      assert.equal(encounteredIds.length, 6, 'ngPlusCycle=2 + zone1Steps=900 should reach the effective max of 6, not the baseline of 4');
    } finally {
      Math.random = originalRandom;
    }
  });
});
