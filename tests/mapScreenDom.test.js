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
