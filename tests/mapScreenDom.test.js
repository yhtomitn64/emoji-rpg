// Real DOM tests for js/screens/mapScreen.js, using jsdom (see
// tests/helpers/dom.js). Scope: DOM structure driven by state, not pixel-
// level rendering - see battleScreenDom.test.js's own header for why this
// pattern exists.
//
// Every mount() here passes `renderer: 'dom'` explicitly. The map's default
// renderer is canvas as of 2026-09-09 (see mapCanvasRenderer.js), and jsdom
// has no canvas implementation at all - getContext('2d') returns null there -
// so a canvas mount renders nothing this file could assert against. These
// tests keep guarding the DOM renderer for as long as `?renderer=dom` exists
// as a live A/B option; the canvas renderer's own equivalent coverage is in
// tests/mapDrawList.test.js and tests/mapTrail.test.js, which assert the
// draw list (pure data) rather than pixels.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, keydown, keyup } from './helpers/dom.js';
import { createNewGame } from '../js/state.js';
import { townMap } from '../js/maps/townMap.js';
import { buildWorldGrid } from '../js/systems/worldGrid.js';
import { isGateCleared } from '../js/systems/toolGates.js';
import { TOWN_PORTAL_POSITION } from '../js/systems/portal.js';
import { DEFAULT_VIEWPORT_TILES_WIDE, DEFAULT_VIEWPORT_TILES_TALL } from '../js/systems/mapRenderModel.js';

function baseState(overrides = {}) {
  return { ...createNewGame(), position: { ...townMap.startPosition }, ...overrides };
}

async function mountTown(state) {
  const { mount } = await import('../js/screens/mapScreen.js');
  const root = createRoot();
  const maps = { town: townMap };
  mount(root, { renderer: 'dom', state, mapConfig: townMap, maps, worldGrid: buildWorldGrid(maps), callbacks: { onFirstVisit: () => {} } });
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
  // ones landing outside town's real 20x14 extent (town is now close in
  // size to the 21x13 fallback viewport, so only a modest strip of cells
  // resolves to nothing and renders content-less - see render()'s
  // `if (!resolved)` branch). A regression here (e.g. skipping unresolved
  // cells outright instead of rendering an empty placeholder) previously
  // let CSS grid auto-flow silently pack the real cells into the wrong
  // rows/columns without any test catching it - still worth guarding even
  // with fewer unresolved cells today.
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

test('mapScreen DOM - portal pull effect delays the action', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('stepping onto the return portal plays the pull animation and delays enterPortalToOrigin, instead of firing it in the same tick', async () => {
    const { mount } = await import('../js/screens/mapScreen.js');
    const root = createRoot();
    const maps = { town: townMap };
    const seenActions = [];
    // One tile below the fixed return-portal spot - ArrowUp steps onto it.
    const state = baseState({
      position: { x: TOWN_PORTAL_POSITION.x, y: TOWN_PORTAL_POSITION.y + 1 },
      portal: { originScreenId: 'north', originX: 3, originY: 3, returnPending: true },
    });
    mount(root, {
      renderer: 'dom',
      state,
      mapConfig: townMap,
      maps,
      worldGrid: buildWorldGrid(maps),
      callbacks: { onFirstVisit: () => {}, onMove: () => {}, onAction: (action) => seenActions.push(action) },
    });

    keydown('ArrowUp');
    // Released before the wait below: a movement key counts as held until
    // keyup, and a held key keeps stepping on mapScreen's own walk timer.
    keyup('ArrowUp');
    assert.deepEqual(seenActions, [], 'expected enterPortalToOrigin to not fire in the same tick as the step');
    const marker = root.querySelector('.map-tile-player .map-tile-fullsize');
    assert.ok(marker?.classList.contains('map-tile-player-portal-pull'), 'expected the pull animation class on the player marker');

    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.deepEqual(seenActions, ['enterPortalToOrigin']);
  });

  await t.test('a keypress during the pull window is ignored (guards against a stale delayed action firing after the player moved again)', async () => {
    const { mount } = await import('../js/screens/mapScreen.js');
    const root = createRoot();
    const maps = { town: townMap };
    const seenActions = [];
    const state = baseState({
      position: { x: TOWN_PORTAL_POSITION.x, y: TOWN_PORTAL_POSITION.y + 1 },
      portal: { originScreenId: 'north', originX: 3, originY: 3, returnPending: true },
    });
    mount(root, {
      renderer: 'dom',
      state,
      mapConfig: townMap,
      maps,
      worldGrid: buildWorldGrid(maps),
      callbacks: { onFirstVisit: () => {}, onMove: () => {}, onAction: (action) => seenActions.push(action) },
    });

    keydown('ArrowUp');
    keydown('ArrowDown');
    assert.equal(state.position.y, TOWN_PORTAL_POSITION.y, 'expected the second keypress to be ignored while a portal transition is pending, position unchanged');

    // Both released before the wait - see the note on the previous test.
    keyup('ArrowUp');
    keyup('ArrowDown');
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.deepEqual(seenActions, ['enterPortalToOrigin'], 'expected exactly one delayed action, not a stale/duplicate fire');
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
      renderer: 'dom',
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
      renderer: 'dom',
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
// Root cause of the large-window hitching Timothy reported: render() used to
// do rootEl.innerHTML = '' + a full rebuild of every visible tile on every
// single step (tryMove -> render()), so a bigger window (more visible tiles)
// meant more DOM work per keypress with no ceiling. The fix keeps a
// persistent grid and only touches cells whose world content actually
// changed - see mapScreen.js's renderStep()/cellCache. This fixture map (7
// wide) is far smaller than jsdom's 21-wide fallback viewport, so per
// computeViewportOrigin (js/systems/world.js) the origin never pans as the
// player moves - every viewport cell maps to the exact same world tile
// before and after the step, so every .map-tile element (not just ones
// untouched by the step) should be the same DOM node reference, with only
// content mutated in place.
test('mapScreen DOM - render diffing reuses DOM elements across steps', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('a step does not replace any .map-tile element (world-to-screen mapping is unchanged)', async () => {
    const plains = {
      id: 'plains',
      legend: { '.': 'grass' },
      rows: ['.......', '.......', '.......'],
      neighbors: {},
      monsterTable: [],
      encounterChance: 0,
      cacheChance: 0,
    };
    const maps = { plains };
    const worldGrid = buildWorldGrid(maps);
    const state = baseState({ position: { x: 1, y: 1 }, map: 'plains' });

    const { mount } = await import('../js/screens/mapScreen.js');
    const root = createRoot();
    mount(root, {
      renderer: 'dom',
      state, mapConfig: plains, maps, worldGrid,
      callbacks: {
        onFirstVisit: () => {}, onMove: () => {}, onToolGateCleared: () => {}, onLockedGate: () => {},
        onToolGateNearby: () => {}, onAction: () => {}, onEnterMiniDungeon: () => {}, onCacheFound: () => {},
        onGateReward: () => {}, onEncounter: () => {}, onWornPathHint: () => {},
      },
    });

    const cellsBefore = [...root.querySelectorAll('.map-tile')];
    assert.equal(cellsBefore.length, 21 * 13, 'sanity check: fallback viewport size');

    keydown('ArrowRight');

    const cellsAfter = [...root.querySelectorAll('.map-tile')];
    assert.equal(cellsAfter.length, cellsBefore.length);
    for (let i = 0; i < cellsBefore.length; i++) {
      assert.equal(cellsAfter[i], cellsBefore[i], `expected .map-tile at index ${i} to be the same DOM element across a step`);
    }
  });
});

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
      renderer: 'dom',
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
        onWornPathHint: () => {},
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
      renderer: 'dom',
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
        onWornPathHint: () => {},
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
      renderer: 'dom',
      state, mapConfig: northScreen, maps, worldGrid,
      callbacks: {
        onFirstVisit: () => {}, onMove: () => {}, onToolGateCleared: () => {}, onLockedGate: () => {},
        onToolGateNearby: () => {}, onAction: () => {}, onEnterMiniDungeon: () => {}, onCacheFound: () => {},
        onGateReward: () => {}, onEncounter: () => {}, onWornPathHint: () => {},
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
      renderer: 'dom',
      state, mapConfig: centerScreen, maps, worldGrid,
      callbacks: {
        onFirstVisit: () => {}, onMove: () => {}, onToolGateCleared: () => {}, onLockedGate: () => {},
        onToolGateNearby: () => {}, onAction: () => {}, onEnterMiniDungeon: () => {}, onCacheFound: () => {},
        onGateReward: () => {}, onEncounter: () => {}, onWornPathHint: () => {},
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
    // call-site change, both applied. monsterKillCounts is 20, not the bare
    // threshold of 10 - killCountSizeCap (js/systems/groupEncounters.js,
    // added 2026-09-04) pins a species' very first eligible encounter to
    // GROUP_SIZE_MIN regardless of the size roll, only reaching this test's
    // intended max of 4 once 10 kills past the threshold have landed.
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
        monsterKillCounts: { boar: 20, bat: 20, snake: 20 },
      });
      const { mount } = await import('../js/screens/mapScreen.js');
      const root = createRoot();
      let encounteredIds = null;
      mount(root, {
      renderer: 'dom',
        state, mapConfig: northScreen, maps, worldGrid,
        callbacks: {
          onFirstVisit: () => {}, onMove: () => {}, onToolGateCleared: () => {}, onLockedGate: () => {},
          onToolGateNearby: () => {}, onAction: () => {}, onEnterMiniDungeon: () => {}, onCacheFound: () => {},
          onGateReward: () => {}, onEncounter: (ids) => { encounteredIds = ids; }, onWornPathHint: () => {},
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
    // monsterKillCounts is 30, not the bare threshold of 10 -
    // killCountSizeCap (js/systems/groupEncounters.js, added 2026-09-04)
    // only reaches this test's intended max of 6 once 20 kills past the
    // threshold have landed (see that function's own comment).
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
        monsterKillCounts: { boar: 30, bat: 30, snake: 30 },
        ngPlusCycle: 2,
        zone1Steps: 900,
      });
      const { mount } = await import('../js/screens/mapScreen.js');
      const root = createRoot();
      let encounteredIds = null;
      mount(root, {
      renderer: 'dom',
        state, mapConfig: northScreen, maps, worldGrid,
        callbacks: {
          onFirstVisit: () => {}, onMove: () => {}, onToolGateCleared: () => {}, onLockedGate: () => {},
          onToolGateNearby: () => {}, onAction: () => {}, onEnterMiniDungeon: () => {}, onCacheFound: () => {},
          onGateReward: () => {}, onEncounter: (ids) => { encounteredIds = ids; }, onWornPathHint: () => {},
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

// See docs/superpowers/specs/2026-09-12-worn-path-encounter-discount-design.md.
// Same Math.random call-order dependency as the mixed-species group test
// above: (1) mini-dungeon check (miniDungeonChance undefined, always misses,
// still consumes a call), (2) cache check (cacheChance: 0, same deal), (3)
// the encounterChance roll itself, then - only if that roll hits - (4) the
// elite roll and (5) the monsterTable pick. monsterKillCounts stays at 0 so
// rollEncounterGroup's own kills-threshold check short-circuits before ever
// calling rng() (js/systems/groupEncounters.js), consuming no further calls.
test('mapScreen DOM - worn-path discount reduces the wild-encounter roll', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  // 7 columns wide, moving right from x=1 to x=2 - both interior, non-edge
  // tiles (same shape as the encounter-cooldown fixture above), so the step
  // actually resolves. A narrower map's rightmost column is a sealed world
  // edge (isSealedWorldEdge) and silently blocks the move entirely - caught
  // live building this test, when a 3-wide version left position unchanged.
  function wornPlains() {
    return {
      id: 'plains',
      legend: { '.': 'grass' },
      rows: ['.......', '.......', '.......'],
      neighbors: {},
      monsterTable: ['boar'],
      encounterChance: 0.5,
      cacheChance: 0,
    };
  }

  await t.test('a fully-worn tile can turn a would-be encounter into a miss', async () => {
    const originalRandom = Math.random;
    // 0.3 sits between the discounted threshold (0.5 * 0.5 = 0.25, a miss)
    // and the undiscounted one (0.5, a hit) - the value that actually
    // distinguishes the two behaviors under test.
    const sequence = [0.5, 0.5, 0.3];
    let i = 0;
    Math.random = () => sequence[Math.min(i++, sequence.length - 1)];
    try {
      const plains = wornPlains();
      const maps = { plains };
      const worldGrid = buildWorldGrid(maps);
      const state = baseState({
        map: 'plains',
        position: { x: 1, y: 1 },
        // Pre-worn to TRAIL_WEAR_CAP - the tile being stepped onto (2, 1) has
        // already been walked 10 times before this step, not by this step.
        visited: { plains: { '2,1': { count: 10, dirs: [] } } },
      });
      let encountered = false;
      const { mount } = await import('../js/screens/mapScreen.js');
      const root = createRoot();
      mount(root, {
        renderer: 'dom',
        state, mapConfig: plains, maps, worldGrid,
        callbacks: {
          onFirstVisit: () => {}, onMove: () => {}, onToolGateCleared: () => {}, onLockedGate: () => {},
          onToolGateNearby: () => {}, onAction: () => {}, onEnterMiniDungeon: () => {}, onCacheFound: () => {},
          onGateReward: () => {}, onEncounter: () => { encountered = true; }, onWornPathHint: () => {},
        },
      });
      keydown('ArrowRight');
      assert.equal(encountered, false, 'expected the worn-path discount to turn this roll into a miss');
    } finally {
      Math.random = originalRandom;
    }
  });

  await t.test('disabling the setting restores the undiscounted chance on the same tile/roll', async () => {
    const originalRandom = Math.random;
    const sequence = [0.5, 0.5, 0.3, 0.99, 0.01];
    let i = 0;
    Math.random = () => sequence[Math.min(i++, sequence.length - 1)];
    try {
      const plains = wornPlains();
      const maps = { plains };
      const worldGrid = buildWorldGrid(maps);
      const state = baseState({
        map: 'plains',
        position: { x: 1, y: 1 },
        visited: { plains: { '2,1': { count: 10, dirs: [] } } },
      });
      state.settings = { ...state.settings, wornPathDiscountEnabled: false };
      let encountered = false;
      const { mount } = await import('../js/screens/mapScreen.js');
      const root = createRoot();
      mount(root, {
        renderer: 'dom',
        state, mapConfig: plains, maps, worldGrid,
        callbacks: {
          onFirstVisit: () => {}, onMove: () => {}, onToolGateCleared: () => {}, onLockedGate: () => {},
          onToolGateNearby: () => {}, onAction: () => {}, onEnterMiniDungeon: () => {}, onCacheFound: () => {},
          onGateReward: () => {}, onEncounter: () => { encountered = true; }, onWornPathHint: () => {},
        },
      });
      keydown('ArrowRight');
      assert.equal(encountered, true, 'expected the same roll to hit once the discount setting is off');
    } finally {
      Math.random = originalRandom;
    }
  });

  await t.test('fires the one-time hint banner callback the first time the discount actually applies, gated on the setting', async () => {
    const plains = wornPlains();
    const maps = { plains };
    const worldGrid = buildWorldGrid(maps);
    const state = baseState({
      map: 'plains',
      position: { x: 1, y: 1 },
      visited: { plains: { '2,1': { count: 10, dirs: [] } } },
    });
    let hintCount = 0;
    const { mount } = await import('../js/screens/mapScreen.js');
    const root = createRoot();
    mount(root, {
      renderer: 'dom',
      state, mapConfig: plains, maps, worldGrid,
      callbacks: {
        onFirstVisit: () => {}, onMove: () => {}, onToolGateCleared: () => {}, onLockedGate: () => {},
        onToolGateNearby: () => {}, onAction: () => {}, onEnterMiniDungeon: () => {}, onCacheFound: () => {},
        onGateReward: () => {}, onEncounter: () => {}, onWornPathHint: () => { hintCount += 1; },
      },
    });
    keydown('ArrowRight');
    assert.equal(hintCount, 1, 'expected the hint to fire once, stepping onto an already-worn tile');
    assert.equal(state.flags.wornPathHintShown, true);
  });

  await t.test('never fires the hint when the discount setting is off', async () => {
    const plains = wornPlains();
    const maps = { plains };
    const worldGrid = buildWorldGrid(maps);
    const state = baseState({
      map: 'plains',
      position: { x: 1, y: 1 },
      visited: { plains: { '2,1': { count: 10, dirs: [] } } },
    });
    state.settings = { ...state.settings, wornPathDiscountEnabled: false };
    let hintCount = 0;
    const { mount } = await import('../js/screens/mapScreen.js');
    const root = createRoot();
    mount(root, {
      renderer: 'dom',
      state, mapConfig: plains, maps, worldGrid,
      callbacks: {
        onFirstVisit: () => {}, onMove: () => {}, onToolGateCleared: () => {}, onLockedGate: () => {},
        onToolGateNearby: () => {}, onAction: () => {}, onEnterMiniDungeon: () => {}, onCacheFound: () => {},
        onGateReward: () => {}, onEncounter: () => {}, onWornPathHint: () => { hintCount += 1; },
      },
    });
    keydown('ArrowRight');
    assert.equal(hintCount, 0, 'expected no hint while the discount setting is off');
  });
});

test('mapScreen DOM - town exits and signage', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  async function mountTownWithActionCapture(position) {
    const { mount } = await import('../js/screens/mapScreen.js');
    const root = createRoot();
    const maps = { town: townMap };
    let capturedAction = null;
    mount(root, {
      renderer: 'dom',
      state: baseState({ position }),
      mapConfig: townMap,
      maps,
      worldGrid: buildWorldGrid(maps),
      callbacks: { onFirstVisit: () => {}, onMove: () => {}, onAction: (action) => { capturedAction = action; } },
    });
    return { root, getAction: () => capturedAction };
  }

  await t.test('walking onto the north gap fires exitTownNorth', async () => {
    const { getAction } = await mountTownWithActionCapture({ x: 10, y: 1 });
    keydown('ArrowUp');
    assert.equal(getAction(), 'exitTownNorth');
  });

  await t.test('walking onto the south gap fires exitTownSouth', async () => {
    const { getAction } = await mountTownWithActionCapture({ x: 10, y: 12 });
    keydown('ArrowDown');
    assert.equal(getAction(), 'exitTownSouth');
  });

  await t.test('walking onto the west gap fires exitTownWest', async () => {
    const { getAction } = await mountTownWithActionCapture({ x: 1, y: 7 });
    keydown('ArrowLeft');
    assert.equal(getAction(), 'exitTownWest');
  });

  await t.test('walking onto the east gap fires exitTownEast', async () => {
    const { getAction } = await mountTownWithActionCapture({ x: 18, y: 7 });
    keydown('ArrowRight');
    assert.equal(getAction(), 'exitTownEast');
  });

  await t.test('no door emoji renders anywhere in town', async () => {
    const root = await mountTown(baseState());
    assert.ok(!root.textContent.includes('🚪'), 'town should not render the door emoji anymore');
  });

  await t.test('all 4 town features get a signpost with the right label, and nothing else does', async () => {
    const root = await mountTown(baseState());
    const signposts = [...root.querySelectorAll('.map-tile-signpost')];
    const labels = signposts.map((el) => el.textContent).sort();
    assert.deepEqual(labels, ['Blacksmith', 'Quest Board', 'Shop', 'Well']);
  });
});

test('mapScreen DOM - tool dungeon guardian rendering', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  async function mountAxeDungeon() {
    const { axeDungeonMap } = await import('../js/maps/toolDungeons/axeDungeon.js');
    const { mount } = await import('../js/screens/mapScreen.js');
    const root = createRoot();
    const maps = { axeDungeon: axeDungeonMap };
    mount(root, {
      renderer: 'dom',
      state: baseState({ position: { ...axeDungeonMap.startPosition } }),
      mapConfig: axeDungeonMap,
      maps,
      worldGrid: buildWorldGrid(maps),
      callbacks: { onFirstVisit: () => {} },
    });
    return { root, axeDungeonMap };
  }

  // Raised 2026-09-07: the guardian tile fell through to .map-tile's bare
  // default background instead of grass - see GRASS_CONTEXT_MARKERS's own
  // comment in mapScreen.js for the established pattern this repeats
  // (portals/shop/smith/etc. hit the exact same bug before).
  await t.test('guardian tile gets the grass background class, not the bare default', async () => {
    const { root, axeDungeonMap } = await mountAxeDungeon();
    const { x, y } = findGuardianPosition(axeDungeonMap);
    const cell = tileAtViewportPosition(root, axeDungeonMap, x, y);
    assert.ok(cell.classList.contains('map-tile-grass'), 'expected the guardian tile to carry map-tile-grass');
  });

  // "Make the tool bosses take up like 4 tiles instead of 1 so they look
  // big and scary" - see GUARDIAN_PX's own comment in mapScreen.js.
  await t.test('guardian renders oversized (GUARDIAN_PX), not the plain FULL_SQUARE_PX landmark size', async () => {
    const { root, axeDungeonMap } = await mountAxeDungeon();
    const { x, y } = findGuardianPosition(axeDungeonMap);
    const cell = tileAtViewportPosition(root, axeDungeonMap, x, y);
    const marker = cell.querySelector('.map-tile-fullsize');
    assert.ok(marker, 'expected a .map-tile-fullsize marker on the guardian tile');
    assert.equal(marker.style.fontSize, '105.6px');
  });

  // Without this, an oversized sprite bleeding downward would be painted
  // over by the row below under the plain row-based z-index scheme - see
  // that line's own comment in mapScreen.js.
  await t.test('guardian tile gets the same always-on-top z-index boost as portals', async () => {
    const { root, axeDungeonMap } = await mountAxeDungeon();
    const { x, y } = findGuardianPosition(axeDungeonMap);
    const cell = tileAtViewportPosition(root, axeDungeonMap, x, y);
    assert.equal(cell.style.zIndex, String(y + 1000));
  });

  // "In the center of their map instead of the corner" - all four tool
  // dungeons share this exact layout (see axeDungeon.js's own comment).
  await t.test('guardian sits at the map center, not the old bottom-right corner', async () => {
    const { axeDungeonMap } = await import('../js/maps/toolDungeons/axeDungeon.js');
    const { x, y } = findGuardianPosition(axeDungeonMap);
    assert.deepEqual({ x, y }, { x: 10, y: 6 });
  });
});

// Raised 2026-09-12 with a screenshot: the dragon boss entrance rendered on
// a black square at plain size - it was the one landmark tile that never
// got the GRASS_CONTEXT_MARKERS/GUARDIAN_PX treatment every tool guardian
// and the superboss entrance/marker already had.
test('mapScreen DOM - dragon boss entrance rendering', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  async function mountDungeon() {
    const { dungeonMap } = await import('../js/maps/dungeonMap.js');
    const { mount } = await import('../js/screens/mapScreen.js');
    const root = createRoot();
    const maps = { dungeon: dungeonMap };
    mount(root, {
      renderer: 'dom',
      state: baseState({ position: { ...dungeonMap.startPosition } }),
      mapConfig: dungeonMap,
      maps,
      worldGrid: buildWorldGrid(maps),
      callbacks: { onFirstVisit: () => {} },
    });
    return { root, dungeonMap };
  }

  await t.test('boss tile gets the grass background class, not the bare default', async () => {
    const { root, dungeonMap } = await mountDungeon();
    const { viewportX, viewportY } = findBossPosition(dungeonMap);
    const cell = tileAtViewportPosition(root, dungeonMap, viewportX, viewportY);
    assert.ok(cell.classList.contains('map-tile-grass'), 'expected the boss tile to carry map-tile-grass');
  });

  await t.test('boss renders oversized (GUARDIAN_PX), not the plain FULL_SQUARE_PX landmark size', async () => {
    const { root, dungeonMap } = await mountDungeon();
    const { viewportX, viewportY } = findBossPosition(dungeonMap);
    const cell = tileAtViewportPosition(root, dungeonMap, viewportX, viewportY);
    const marker = cell.querySelector('.map-tile-fullsize');
    assert.ok(marker, 'expected a .map-tile-fullsize marker on the boss tile');
    assert.equal(marker.style.fontSize, '105.6px');
  });

  // The CSS row driving z-index is world-relative (gy - bounds.minGy, i.e.
  // the map's own y for a lone screen), which is NOT the same as the
  // viewport-scan row used above to find the cell in DOM order whenever the
  // map is smaller than the viewport and gets centered - see
  // findBossPosition's own comment.
  await t.test('boss tile gets the same always-on-top z-index boost as portals and guardians', async () => {
    const { root, dungeonMap } = await mountDungeon();
    const { worldY, viewportX, viewportY } = findBossPosition(dungeonMap);
    const cell = tileAtViewportPosition(root, dungeonMap, viewportX, viewportY);
    assert.equal(cell.style.zIndex, String(worldY + 1000));
  });
});

function findGuardianPosition(map) {
  for (let y = 0; y < map.rows.length; y++) {
    for (let x = 0; x < map.rows[y].length; x++) {
      if (map.legend[map.rows[y][x]] === 'guardian') return { x, y };
    }
  }
  throw new Error(`${map.id} has no guardian tile`);
}

// Unlike the tool dungeons (exactly DEFAULT_VIEWPORT_TILES_WIDE/TALL, so a
// map-local (x, y) needs no translation - see tileAtViewportPosition's own
// comment), dungeonMap is 20x11 - smaller than the 21x13 default viewport
// in both dimensions, so computeViewportOrigin (js/systems/world.js) centers
// it, giving a nonzero origin. Reproduces that same centering math to get
// both coordinate systems a caller might need: viewportX/Y (DOM append
// order, what tileAtViewportPosition expects) and worldY (what the DOM
// renderer's own z-index actually keys off - gy - bounds.minGy, i.e. the
// map's own y for a lone screen - see applyCellPosition's caller).
function findBossPosition(map) {
  for (let y = 0; y < map.rows.length; y++) {
    for (let x = 0; x < map.rows[y].length; x++) {
      if (map.legend[map.rows[y][x]] !== 'boss') continue;
      const worldWidth = map.rows[0].length;
      const worldHeight = map.rows.length;
      const originGx = -Math.floor((DEFAULT_VIEWPORT_TILES_WIDE - worldWidth) / 2);
      const originGy = -Math.floor((DEFAULT_VIEWPORT_TILES_TALL - worldHeight) / 2);
      return { worldX: x, worldY: y, viewportX: x - originGx, viewportY: y - originGy };
    }
  }
  throw new Error(`${map.id} has no boss tile`);
}

// The tool dungeons are now exactly DEFAULT_VIEWPORT_TILES_WIDE/TALL
// (21x13, jsdom's fallback viewport size) - computeViewportOrigin
// (js/systems/world.js) only centers/pans a cluster SMALLER than the
// viewport; a cluster exactly the viewport's own size gets origin ==
// bounds.min with zero offset, so a map-local (x, y) lands at that exact
// same viewport-cell index with no translation needed.
function tileAtViewportPosition(root, map, mapX, mapY) {
  const cells = root.querySelectorAll('.map-tile');
  return cells[mapY * 21 + mapX];
}
