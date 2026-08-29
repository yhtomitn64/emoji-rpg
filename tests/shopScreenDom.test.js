// Real DOM tests for js/screens/shopScreen.js, using jsdom (see
// tests/helpers/dom.js). Scope: the Sell Duplicate Gear control only - this
// screen had no prior DOM coverage, so this isn't exhaustive of buy/sell/
// equip-prompt wiring, just the piece this task actually touched. Raised
// 2026-08-29: originally built into the inventory screen, then moved here
// per Timothy's own correction ("that should be a shop feature not
// something you can do all the time").
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, click } from './helpers/dom.js';
import { sellPrice } from '../js/systems/inventory.js';
import { ITEMS } from '../js/data/items.js';

function buildState(overrides = {}) {
  return {
    player: { gold: 100 },
    equipment: { weapon: null, head: null, body: null, legs: null, accessory: null },
    equipmentTiers: {},
    inventory: [],
    ...overrides,
  };
}

async function mountShop(state, callbacks = { onPurchase: () => {}, onLeave: () => {} }) {
  const { mount } = await import('../js/screens/shopScreen.js');
  const root = createRoot();
  mount(root, { state, callbacks });
  return root;
}

test('shopScreen DOM - Sell Duplicate Gear', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/shopScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('button is disabled when no gear entry has quantity > 1', async () => {
    const root = await mountShop(buildState({ inventory: [{ itemId: 'ironSword', quantity: 1 }] }));
    assert.equal(root.querySelector('#btn-sell-duplicates').disabled, true);
  });

  await t.test('clicking it keeps one copy, sells the rest at half price, and reports the result', async () => {
    const state = buildState({ inventory: [{ itemId: 'ironSword', quantity: 3 }] });
    let purchased = false;
    const root = await mountShop(state, { onPurchase: () => { purchased = true; }, onLeave: () => {} });

    const btn = root.querySelector('#btn-sell-duplicates');
    assert.equal(btn.disabled, false);
    click(btn);

    assert.equal(purchased, true, 'expected callbacks.onPurchase to fire so gold/HUD stay in sync');
    assert.equal(state.inventory.find((e) => e.itemId === 'ironSword').quantity, 1);
    assert.equal(state.player.gold, 100 + 2 * sellPrice(ITEMS.ironSword.price));
    assert.ok(root.querySelector('.shop-sell-duplicates-message').textContent.includes('Sold 2 duplicate items'));
  });

  await t.test('a unique boss-drop item (price 0, not in SHOP_CATALOG) still counts as a sellable duplicate', async () => {
    const state = buildState({ inventory: [{ itemId: 'dragonFang', quantity: 2 }] });
    const root = await mountShop(state);
    click(root.querySelector('#btn-sell-duplicates'));
    assert.equal(state.inventory.find((e) => e.itemId === 'dragonFang').quantity, 1);
  });

  await t.test('materials are left alone even at quantity > 1', async () => {
    const state = buildState({ inventory: [{ itemId: 'leatherScrap', quantity: 5 }] });
    const root = await mountShop(state);
    assert.equal(root.querySelector('#btn-sell-duplicates').disabled, true);
    assert.equal(state.inventory.find((e) => e.itemId === 'leatherScrap').quantity, 5);
  });
});
