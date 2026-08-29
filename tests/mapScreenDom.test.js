// Real DOM tests for js/screens/mapScreen.js, using jsdom (see
// tests/helpers/dom.js). Scope: DOM structure driven by state, not pixel-
// level rendering - see battleScreenDom.test.js's own header for why this
// pattern exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot } from './helpers/dom.js';
import { createNewGame } from '../js/state.js';
import { townMap } from '../js/maps/townMap.js';
import { buildWorldGrid } from '../js/systems/worldGrid.js';

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
