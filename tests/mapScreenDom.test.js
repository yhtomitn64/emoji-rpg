// Real DOM tests for js/screens/mapScreen.js, using jsdom (see
// tests/helpers/dom.js). Scope: DOM structure driven by state, not pixel-
// level rendering - see battleScreenDom.test.js's own header for why this
// pattern exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot } from './helpers/dom.js';
import { createNewGame } from '../js/state.js';
import { townMap } from '../js/maps/townMap.js';

function baseState(overrides = {}) {
  return { ...createNewGame(), position: { ...townMap.startPosition }, ...overrides };
}

async function mountTown(state) {
  const { mount } = await import('../js/screens/mapScreen.js');
  const root = createRoot();
  mount(root, { state, mapConfig: townMap, callbacks: { onFirstVisit: () => {} } });
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
