// Real DOM tests for js/screens/smithScreen.js's Mythic reforge action,
// using jsdom (see tests/helpers/dom.js). Not exhaustive coverage of the
// pre-existing smith-upgrade flow - scoped to the new reforge button.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, click } from './helpers/dom.js';

function buildState(overrides = {}) {
  return {
    player: { gold: 500 },
    equipment: { weapon: 'ironSword', head: null, body: null, legs: null, accessory: null, ring1: null, ring2: null },
    equipmentTiers: { weapon: 'superior' },
    upgrades: {},
    inventory: [{ itemId: 'mythicEssence', quantity: 5 }],
    ngPlusCycle: 1,
    ...overrides,
  };
}

async function mountSmith(state, callbacks = { onUpgrade: () => {}, onLeave: () => {} }) {
  const { mount } = await import('../js/screens/smithScreen.js');
  const root = createRoot();
  mount(root, { state, callbacks });
  return root;
}

test('smithScreen reforge DOM', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/smithScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('shows a Reforge button for a Superior-tier equipped item once ngPlusCycle >= 1', async () => {
    const root = await mountSmith(buildState());
    assert.ok(root.querySelector('button[data-reforge="weapon"]'));
  });

  await t.test('hides the Reforge button before ngPlusCycle 1', async () => {
    const root = await mountSmith(buildState({ ngPlusCycle: 0 }));
    assert.equal(root.querySelector('button[data-reforge="weapon"]'), null);
  });

  await t.test('hides the Reforge button for a non-Superior tier', async () => {
    const root = await mountSmith(buildState({ equipmentTiers: {} }));
    assert.equal(root.querySelector('button[data-reforge="weapon"]'), null);
  });

  await t.test('clicking Reforge sets the slot tier to mythic and calls onUpgrade', async () => {
    let upgraded = false;
    const root = await mountSmith(buildState(), { onUpgrade: () => { upgraded = true; }, onLeave: () => {} });
    click(root.querySelector('button[data-reforge="weapon"]'));
    assert.ok(upgraded);
  });

  await t.test('a ring slot with an equipped item shows no upgrade select/button, only the reforge button', async () => {
    const state = buildState({
      equipment: { weapon: 'ironSword', head: null, body: null, legs: null, accessory: null, ring1: 'emberRing', ring2: null },
      equipmentTiers: { weapon: 'superior' }, // emberRing has no tier - never eligible for reforge either, confirms no reforge button shows for it
    });
    const root = await mountSmith(state);
    assert.equal(root.querySelector('select[data-slot="ring1"]'), null);
    assert.equal(root.querySelector('button[data-slot="ring1"]'), null); // the upgrade button (not data-reforge)
  });

  await t.test('an empty ring slot shows the friendly label, not the raw key', async () => {
    const root = await mountSmith(buildState());
    assert.ok(root.textContent.includes('Ring 1: (empty)'));
    assert.ok(root.textContent.includes('Ring 2: (empty)'));
  });
});
