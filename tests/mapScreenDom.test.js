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
});

// Safari has a known bug where a CSS Grid whose tracks size aspect-ratio
// children (.map-grid / .map-tile) doesn't re-run its track-sizing pass on
// a live window resize, leaving the map visually stuck at its old, larger
// size until a full reload. jsdom has no real layout engine, so this can't
// prove the visual bug is fixed - it proves the workaround mechanism (a
// forced reflow on resize) actually fires, which is the class of thing this
// suite already scopes itself to (see the file header above).
test('mapScreen DOM - resize reflow workaround', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('window resize forces the map grid through a display toggle', async () => {
    const root = await mountTown(baseState());
    const grid = root.querySelector('.map-grid');
    const displayValues = [];
    Object.defineProperty(grid.style, 'display', {
      configurable: true,
      get() { return this._display || ''; },
      set(v) { this._display = v; displayValues.push(v); },
    });

    window.dispatchEvent(new Event('resize'));

    assert.deepEqual(displayValues, ['none', '']);
  });
});
