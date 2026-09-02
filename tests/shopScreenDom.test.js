// Real DOM tests for js/screens/shopScreen.js, using jsdom (see
// tests/helpers/dom.js). Scope: the Sell Duplicate Gear control only - this
// screen had no prior DOM coverage, so this isn't exhaustive of buy/sell/
// equip-prompt wiring, just the piece this task actually touched. Raised
// 2026-08-29: originally built into the inventory screen, then moved here
// per Timothy's own correction ("that should be a shop feature not
// something you can do all the time").
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, click, keydown } from './helpers/dom.js';
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

// Raised 2026-08-28 (final review), fixed 2026-08-29: a single Fine/Superior
// copy of a gear item used to have no sell path at all - the shop only ever
// sold/bought the Plain stack.
test('shopScreen DOM - selling Fine/Superior tiered gear', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/shopScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('a single owned Fine copy renders its own sell row, separate from the (disabled) Plain row', async () => {
    const root = await mountShop(buildState({ inventory: [{ itemId: 'ironSword', quantity: 1, tier: 'fine' }] }));
    const sellButtons = [...root.querySelectorAll('button[data-sell="ironSword"]')];
    assert.equal(sellButtons.length, 2, 'the always-present Plain sell button, plus one for the owned Fine copy');
    const plainSellBtn = sellButtons.find((btn) => !btn.dataset.tier);
    assert.equal(plainSellBtn.disabled, true, 'no Plain copy is owned');
    const fineSellBtn = sellButtons.find((btn) => btn.dataset.tier === 'fine');
    assert.ok(fineSellBtn, 'expected a sell button for the owned Fine copy');
    const row = fineSellBtn.closest('.shop-row');
    assert.match(row.textContent, /Fine Iron Sword \(own 1\)/);
  });

  await t.test('owning Plain, Fine, and Superior copies renders three separate sell rows', async () => {
    const root = await mountShop(buildState({
      inventory: [
        { itemId: 'ironSword', quantity: 1 },
        { itemId: 'ironSword', quantity: 1, tier: 'fine' },
        { itemId: 'ironSword', quantity: 1, tier: 'superior' },
      ],
    }));
    const sellButtons = [...root.querySelectorAll('button[data-sell="ironSword"]')];
    assert.equal(sellButtons.length, 3);
    assert.deepEqual(sellButtons.map((btn) => btn.dataset.tier), [undefined, 'fine', 'superior']);
  });

  await t.test('clicking a tiered sell button sells one copy of that tier at half price and leaves the other tiers alone', async () => {
    const state = buildState({
      inventory: [
        { itemId: 'ironSword', quantity: 1, tier: 'fine' },
        { itemId: 'ironSword', quantity: 1, tier: 'superior' },
      ],
    });
    const root = await mountShop(state);
    const fineSellBtn = root.querySelector('button[data-sell="ironSword"][data-tier="fine"]');
    click(fineSellBtn);

    assert.equal(state.inventory.find((e) => e.itemId === 'ironSword' && e.tier === 'fine'), undefined);
    assert.ok(state.inventory.find((e) => e.itemId === 'ironSword' && e.tier === 'superior'), 'the Superior copy should be untouched');
    assert.equal(state.player.gold, 100 + sellPrice(ITEMS.ironSword.price));
  });

  await t.test('a non-gear item (e.g. a potion) never renders tiered sell rows', async () => {
    const root = await mountShop(buildState({ inventory: [{ itemId: 'potion', quantity: 2, tier: 'fine' }] }));
    assert.equal(root.querySelectorAll('button[data-sell="potion"][data-tier]').length, 0);
  });
});

// Raised 2026-08-29: "you never really need to buy more than 1 equipment
// item, the only thing that really needs multiples is the potions."
test('shopScreen DOM - buy quantity buttons', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/shopScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('a gear row (e.g. Iron Sword) only offers a single Buy button', async () => {
    const root = await mountShop(buildState());
    const swordRow = [...root.querySelectorAll('.shop-row')].find((row) => row.textContent.includes('Iron Sword'));
    const buyButtons = swordRow.querySelectorAll('button[data-item="ironSword"]');
    assert.equal(buyButtons.length, 1);
    assert.equal(buyButtons[0].dataset.qty, '1');
    assert.equal(buyButtons[0].textContent, 'Buy');
  });

  await t.test('the Potion row offers the full bulk-quantity set', async () => {
    const root = await mountShop(buildState({ player: { gold: 100000 } }));
    const potionRow = [...root.querySelectorAll('.shop-row')].find((row) => row.textContent.includes('Potion'));
    const quantities = [...potionRow.querySelectorAll('button[data-item="potion"]')].map((btn) => btn.dataset.qty);
    assert.deepEqual(quantities, ['1', '5', '10', '100']);
  });
});

// Raised in the playthrough-telemetry plan's final whole-branch review: the
// post-purchase equip prompt (accepted via "Equip") is a second equipItem()
// call site that Task 5 (inventoryScreen.js) never wired up for gear_equipped.
test('shopScreen DOM - equip prompt telemetry', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/shopScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('accepting the post-purchase equip prompt logs a gear_equipped telemetry event', async () => {
    const { startSession, getBufferAsJsonl } = await import('../js/systems/telemetry.js');
    startSession();
    const state = buildState();
    const root = await mountShop(state);

    const buyBtn = root.querySelector('button[data-item="ironSword"][data-qty="1"]');
    click(buyBtn);
    const equipYesBtn = root.querySelector('#btn-equip-prompt-yes');
    assert.ok(equipYesBtn, 'expected the equip prompt to appear after buying an unequipped gear item');
    click(equipYesBtn);

    assert.equal(state.equipment.weapon, 'ironSword');
    const events = getBufferAsJsonl().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    const equipEvent = events.find((e) => e.type === 'gear_equipped');
    assert.ok(equipEvent);
    assert.equal(equipEvent.itemId, 'ironSword');
    assert.equal(equipEvent.slot, 'weapon');
    assert.equal(equipEvent.tier, null);
    assert.equal(equipEvent.replacedItemId, null);
  });
});

test('shopScreen DOM - close affordances', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/shopScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('the X button calls onLeave', async () => {
    let left = false;
    const root = await mountShop(buildState(), { onPurchase: () => {}, onLeave: () => { left = true; } });
    click(root.querySelector('#btn-close-x'));
    assert.equal(left, true);
  });

  await t.test('Escape calls onLeave', async () => {
    let left = false;
    await mountShop(buildState(), { onPurchase: () => {}, onLeave: () => { left = true; } });
    keydown('Escape');
    assert.equal(left, true);
  });
});
