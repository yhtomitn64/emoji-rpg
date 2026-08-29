// Real DOM tests for js/screens/inventoryScreen.js, using jsdom (see
// tests/helpers/dom.js). Scope: the tabbed layout and per-tab sorting added
// 2026-08-29, plus a smoke test that equip/unequip/use wiring survived the
// refactor - not exhaustive coverage of every row-rendering branch (that
// predates this change and isn't being touched).
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, click } from './helpers/dom.js';

function buildState() {
  return {
    player: { hp: 20, maxHp: 20, gold: 0 },
    equipment: { weapon: null, head: null, body: null, legs: null, accessory: null },
    equipmentTiers: {},
    upgrades: {},
    inventory: [
      { itemId: 'ironSword', quantity: 1 },
      { itemId: 'clothCap', quantity: 1, tier: 'superior' },
      { itemId: 'clothTunic', quantity: 1, tier: 'fine' },
      { itemId: 'leatherScrap', quantity: 5 },
      { itemId: 'ironScrap', quantity: 2 },
      { itemId: 'batWing', quantity: 9 },
      { itemId: 'potion', quantity: 3 },
      { itemId: 'miningPick', quantity: 1 },
      { itemId: 'axe', quantity: 1 },
    ],
  };
}

async function mountInventory(state, callbacks = { onChange: () => {}, onClose: () => {} }) {
  const { mount } = await import('../js/screens/inventoryScreen.js');
  const root = createRoot();
  mount(root, { state, callbacks });
  return root;
}

function tabRowTexts(root) {
  return [...root.querySelectorAll('.inventory-tab-content .inventory-row')].map((row) => row.textContent);
}

test('inventoryScreen DOM', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/inventoryScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('defaults to the Gear tab, alphabetically sorted, with Equipment always visible above the tabs', async () => {
    const root = await mountInventory(buildState());
    assert.ok(root.querySelector('.inventory-tab-btn[data-tab="gear"]').classList.contains('active'));
    assert.ok(root.textContent.includes('Equipment'));
    const rows = tabRowTexts(root);
    assert.equal(rows.length, 3);
    assert.ok(rows[0].includes('Cloth Cap'));
    assert.ok(rows[1].includes('Cloth Tunic'));
    assert.ok(rows[2].includes('Iron Sword'));
  });

  await t.test('clicking a tab button switches which section is shown', async () => {
    const root = await mountInventory(buildState());
    click(root.querySelector('.inventory-tab-btn[data-tab="material"]'));
    assert.ok(root.querySelector('.inventory-tab-btn[data-tab="material"]').classList.contains('active'));
    const rows = tabRowTexts(root);
    assert.equal(rows.length, 3);
    assert.ok(rows.some((text) => text.includes('Leather Scrap')));
    assert.ok(!rows.some((text) => text.includes('Iron Sword')));
  });

  await t.test('switching sort to Quantity orders a tab by descending quantity', async () => {
    const root = await mountInventory(buildState());
    click(root.querySelector('.inventory-tab-btn[data-tab="material"]'));
    const select = root.querySelector('.inventory-sort-control select');
    select.value = 'quantity';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));

    const rows = tabRowTexts(root);
    assert.ok(rows[0].includes('Bat Wing'));    // qty 9
    assert.ok(rows[1].includes('Leather Scrap')); // qty 5
    assert.ok(rows[2].includes('Iron Scrap'));   // qty 2
  });

  await t.test('switching sort to Rarity on the Gear tab orders Superior > Fine > Plain', async () => {
    const root = await mountInventory(buildState());
    const select = root.querySelector('.inventory-sort-control select');
    select.value = 'tier';
    select.dispatchEvent(new window.Event('change', { bubbles: true }));

    const rows = tabRowTexts(root);
    assert.ok(rows[0].includes('Cloth Cap'));   // superior
    assert.ok(rows[1].includes('Cloth Tunic')); // fine
    assert.ok(rows[2].includes('Iron Sword'));  // plain
  });

  await t.test('the Materials tab sort control has no Rarity option (materials have no tier)', async () => {
    const root = await mountInventory(buildState());
    click(root.querySelector('.inventory-tab-btn[data-tab="material"]'));
    const select = root.querySelector('.inventory-sort-control select');
    const values = [...select.options].map((opt) => opt.value);
    assert.ok(!values.includes('tier'));
  });

  await t.test('equipping an item from the Gear tab still moves it into Equipment and calls onChange', async () => {
    let changed = false;
    const root = await mountInventory(buildState(), { onChange: () => { changed = true; }, onClose: () => {} });
    click(root.querySelector('button[data-equip="ironSword"]'));
    assert.equal(changed, true);
    assert.ok(!tabRowTexts(root).some((text) => text.includes('Iron Sword')));
  });

  await t.test('Sell Duplicate Gear button is disabled when no gear entry has quantity > 1', async () => {
    const root = await mountInventory(buildState());
    assert.equal(root.querySelector('#btn-sell-duplicates').disabled, true);
  });

  await t.test('clicking Sell Duplicate Gear keeps one copy, sells the rest, and reports the result', async () => {
    const state = buildState();
    state.inventory.find((e) => e.itemId === 'ironSword').quantity = 3;
    let changed = false;
    const root = await mountInventory(state, { onChange: () => { changed = true; }, onClose: () => {} });

    const btn = root.querySelector('#btn-sell-duplicates');
    assert.equal(btn.disabled, false);
    click(btn);

    assert.equal(changed, true);
    assert.equal(state.inventory.find((e) => e.itemId === 'ironSword').quantity, 1);
    assert.ok(state.player.gold > 0, 'expected gold to increase from the sale');
    assert.ok(root.querySelector('.inventory-sell-duplicates-message').textContent.includes('Sold 2 duplicate items'));
  });

  await t.test('the Sell Duplicate Gear message clears when switching tabs', async () => {
    const state = buildState();
    state.inventory.find((e) => e.itemId === 'ironSword').quantity = 2;
    const root = await mountInventory(state);
    click(root.querySelector('#btn-sell-duplicates'));
    assert.ok(root.querySelector('.inventory-sell-duplicates-message'));

    click(root.querySelector('.inventory-tab-btn[data-tab="material"]'));
    click(root.querySelector('.inventory-tab-btn[data-tab="gear"]'));
    assert.equal(root.querySelector('.inventory-sell-duplicates-message'), null);
  });
});
