// Real DOM tests for js/screens/smithScreen.js's Mythic reforge action,
// using jsdom (see tests/helpers/dom.js). Not exhaustive coverage of the
// pre-existing smith-upgrade flow - scoped to the new reforge button.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, click, keydown } from './helpers/dom.js';

function buildState(overrides = {}) {
  return {
    player: { gold: 500 },
    equipment: { weapon: 'ironSword', head: null, body: null, legs: null, accessory1: null, accessory2: null, ring1: null, ring2: null },
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

  // Raised 2026-09-07: the upgrade cap shown on every slot is driven entirely
  // by ngPlusCycle, but nothing on this screen said what cycle was active.
  await t.test('shows the current NG+ cycle badge once past NG+0', async () => {
    const root = await mountSmith(buildState({ ngPlusCycle: 2 }));
    assert.match(root.querySelector('.ngplus-badge').textContent, /New Game\+2/);
  });

  await t.test('shows no NG+ badge at NG+0', async () => {
    const root = await mountSmith(buildState({ ngPlusCycle: 0 }));
    assert.equal(root.querySelector('.ngplus-badge'), null);
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

  await t.test('clicking Reforge logs an item_reforged telemetry event', async () => {
    const { startSession, getBufferAsJsonl } = await import('../js/systems/telemetry.js');
    startSession();
    const root = await mountSmith(buildState());
    click(root.querySelector('button[data-reforge="weapon"]'));
    const events = getBufferAsJsonl().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    const reforgeEvent = events.find((e) => e.type === 'item_reforged');
    assert.ok(reforgeEvent);
    assert.equal(reforgeEvent.itemId, 'ironSword');
    assert.equal(reforgeEvent.slot, 'weapon');
    assert.equal(reforgeEvent.newTier, 'mythic');
    assert.equal(reforgeEvent.ngPlusCycle, 1);
  });

  await t.test('a ring slot with an equipped item but no owned Moonstone Shard shows a disabled upgrade button, not the reforge button', async () => {
    const state = buildState({
      equipment: { weapon: 'ironSword', head: null, body: null, legs: null, accessory1: null, accessory2: null, ring1: 'emberRing', ring2: null },
      equipmentTiers: { weapon: 'superior' }, // emberRing has no tier - never eligible for reforge either, confirms no reforge button shows for it
    });
    const root = await mountSmith(state);
    assert.ok(root.querySelector('select[data-slot="ring1"]')); // Moonstone Shard exists as a ring-upgrade material, so the control renders...
    const button = root.querySelector('button[data-slot="ring1"]'); // ...but nothing owned yet, so the upgrade button stays disabled.
    assert.ok(button);
    assert.ok(button.disabled);
    assert.equal(root.querySelector('button[data-reforge="ring1"]'), null);
  });

  await t.test('a ring slot upgrades with an owned Moonstone Shard, the same as any other slot', async () => {
    const state = buildState({
      equipment: { weapon: 'ironSword', head: null, body: null, legs: null, accessory1: null, accessory2: null, ring1: 'emberRing', ring2: null },
      inventory: [{ itemId: 'moonstoneShard', quantity: 1 }],
    });
    const root = await mountSmith(state);
    const select = root.querySelector('select[data-slot="ring1"]');
    select.value = 'moonstoneShard';
    click(root.querySelector('button[data-slot="ring1"]'));
    assert.equal(state.upgrades['emberRing:plain'], 1);
  });

  await t.test('an empty ring slot shows the friendly label, not the raw key', async () => {
    const root = await mountSmith(buildState());
    assert.ok(root.textContent.includes('Ring 1: (empty)'));
    assert.ok(root.textContent.includes('Ring 2: (empty)'));
  });

  await t.test('a successful upgrade logs an upgrade_purchased telemetry event', async () => {
    const { startSession, getBufferAsJsonl } = await import('../js/systems/telemetry.js');
    startSession();
    const root = await mountSmith(buildState({ inventory: [{ itemId: 'ironScrap', quantity: 1 }] }));
    const select = root.querySelector('select[data-slot="weapon"]');
    select.value = 'ironScrap';
    click(root.querySelector('button[data-slot="weapon"]'));
    const events = getBufferAsJsonl().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    const upgradeEvent = events.find((e) => e.type === 'upgrade_purchased');
    assert.ok(upgradeEvent);
    assert.equal(upgradeEvent.itemId, 'ironSword');
    assert.equal(upgradeEvent.slot, 'weapon');
    assert.equal(upgradeEvent.newLevel, 1);
    assert.equal(upgradeEvent.goldSpent, 20);
    assert.equal(upgradeEvent.ngPlusCycle, 1);
  });

  await t.test('shows a disabled, maxed-out button once a slot hits its NG+ cycle upgrade cap', async () => {
    // buildState defaults to ngPlusCycle: 1, whose cap is MAX_UPGRADE_LEVEL (3) + 2 = 5.
    const root = await mountSmith(buildState({
      upgrades: { 'ironSword:superior': 5 },
      inventory: [{ itemId: 'ironScrap', quantity: 1 }],
    }));
    const button = root.querySelector('button[data-slot="weapon"]');
    assert.ok(button.disabled);
    assert.ok(button.textContent.includes('Maxed for NG+1'));
  });

  await t.test('clicking a maxed-out upgrade button is a no-op (disabled, but confirms no state change even if clicked)', async () => {
    let upgraded = false;
    const state = buildState({
      upgrades: { 'ironSword:superior': 5 },
      inventory: [{ itemId: 'ironScrap', quantity: 1 }],
    });
    const root = await mountSmith(state, { onUpgrade: () => { upgraded = true; }, onLeave: () => {} });
    click(root.querySelector('button[data-slot="weapon"]'));
    assert.equal(upgraded, false);
    assert.equal(state.upgrades['ironSword:superior'], 5);
  });

  await t.test('the X button calls onLeave', async () => {
    let left = false;
    const root = await mountSmith(buildState(), { onUpgrade: () => {}, onLeave: () => { left = true; } });
    click(root.querySelector('#btn-close-x'));
    assert.equal(left, true);
  });

  await t.test('Escape calls onLeave', async () => {
    let left = false;
    await mountSmith(buildState(), { onUpgrade: () => {}, onLeave: () => { left = true; } });
    keydown('Escape');
    assert.equal(left, true);
  });
});
