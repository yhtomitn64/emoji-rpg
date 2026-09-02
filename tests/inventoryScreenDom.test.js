// Real DOM tests for js/screens/inventoryScreen.js, using jsdom (see
// tests/helpers/dom.js). Scope: the tabbed layout and per-tab sorting added
// 2026-08-29, plus a smoke test that equip/unequip/use wiring survived the
// refactor - not exhaustive coverage of every row-rendering branch (that
// predates this change and isn't being touched).
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, click, keydown } from './helpers/dom.js';

function buildState() {
  return {
    player: { hp: 20, maxHp: 20, gold: 0 },
    equipment: { weapon: null, head: null, body: null, legs: null, accessory: null, ring1: null, ring2: null },
    equipmentTiers: {},
    upgrades: {},
    loadout: [null, null, null, null],
    inventory: [
      { itemId: 'ironSword', quantity: 1 },
      { itemId: 'clothCap', quantity: 1, tier: 'superior' },
      { itemId: 'clothTunic', quantity: 1, tier: 'fine' },
      { itemId: 'leatherScrap', quantity: 5 },
      { itemId: 'ironScrap', quantity: 2 },
      { itemId: 'batWing', quantity: 9 },
      { itemId: 'potion', quantity: 3 },
      { itemId: 'strengthDraught', quantity: 2 },
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

  await t.test('equipping a ring-slot item with one empty ring slot targets that slot directly', async () => {
    const state = buildState();
    state.inventory.push({ itemId: 'emberRing', quantity: 1 });
    const root = await mountInventory(state);
    const equipBtn = root.querySelector('button[data-equip="emberRing"]');
    assert.ok(equipBtn);
    assert.equal(equipBtn.dataset.slot, 'ring1');
    click(equipBtn);
    assert.equal(state.equipment.ring1, 'emberRing');
  });

  await t.test('equipping a ring-slot item with both rings full offers a choice of which to replace', async () => {
    const state = buildState();
    state.equipment.ring1 = 'emberRing';
    state.equipment.ring2 = 'windfuryRing';
    state.inventory.push({ itemId: 'emberRing', quantity: 1 }); // a second copy, in the bag
    const root = await mountInventory(state);
    const ring1Btn = root.querySelector('button[data-equip="emberRing"][data-slot="ring1"]');
    const ring2Btn = root.querySelector('button[data-equip="emberRing"][data-slot="ring2"]');
    assert.ok(ring1Btn);
    assert.ok(ring2Btn);
    click(ring2Btn);
    assert.equal(state.equipment.ring2, 'emberRing');
  });

  await t.test('Potions tab rows show 4 loadout toggle buttons, and only the heal potion shows a Use button', async () => {
    const root = await mountInventory(buildState());
    click(root.querySelector('[data-tab="consumable"]'));
    const rows = [...root.querySelectorAll('.inventory-tab-content .inventory-row')];
    const potionRow = rows.find((row) => row.textContent.includes('Potion'));
    const draughtRow = rows.find((row) => row.textContent.includes('Strength Draught'));
    assert.equal(potionRow.querySelectorAll('button[data-loadout-slot]').length, 4);
    assert.ok(potionRow.querySelector('button[data-use]'));
    assert.equal(draughtRow.querySelectorAll('button[data-loadout-slot]').length, 4);
    assert.equal(draughtRow.querySelector('button[data-use]'), null);
  });

  await t.test('clicking a loadout slot button assigns the item, bumping out any previous occupant', async () => {
    const state = buildState();
    const root = await mountInventory(state);
    click(root.querySelector('[data-tab="consumable"]'));
    const potionSlot1 = [...root.querySelectorAll('.inventory-row')]
      .find((row) => row.textContent.includes('Potion x'))
      .querySelector('button[data-loadout-slot="0"]');
    click(potionSlot1);
    assert.deepEqual(state.loadout, ['potion', null, null, null]);
    const draughtSlot1 = [...root.querySelectorAll('.inventory-row')]
      .find((row) => row.textContent.includes('Strength Draught'))
      .querySelector('button[data-loadout-slot="0"]');
    click(draughtSlot1);
    assert.deepEqual(state.loadout, ['strengthDraught', null, null, null]);
  });

  await t.test('clicking an already-assigned loadout slot button unassigns it', async () => {
    const state = { ...buildState(), loadout: ['potion', null, null, null] };
    const root = await mountInventory(state);
    click(root.querySelector('[data-tab="consumable"]'));
    const potionSlot1 = [...root.querySelectorAll('.inventory-row')]
      .find((row) => row.textContent.includes('Potion x'))
      .querySelector('button[data-loadout-slot="0"]');
    click(potionSlot1);
    assert.deepEqual(state.loadout, [null, null, null, null]);
  });

  await t.test('equipping gear logs a gear_equipped telemetry event', async () => {
    const { startSession, getBufferAsJsonl } = await import('../js/systems/telemetry.js');
    startSession();
    const root = await mountInventory(buildState());
    click(root.querySelector('button[data-equip="ironSword"]'));
    const events = getBufferAsJsonl().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    const equipEvent = events.find((e) => e.type === 'gear_equipped');
    assert.ok(equipEvent);
    assert.equal(equipEvent.itemId, 'ironSword');
    assert.equal(equipEvent.slot, 'weapon');
    assert.equal(equipEvent.replacedItemId, null);
  });

  await t.test('using the heal potion outside battle logs a potion_used event with inBattle false', async () => {
    const { startSession, getBufferAsJsonl } = await import('../js/systems/telemetry.js');
    startSession();
    const state = buildState();
    state.player.hp = 5; // below max, so the Use button isn't disabled
    const root = await mountInventory(state);
    click(root.querySelector('button[data-tab="consumable"]'));
    click(root.querySelector('button[data-use="potion"]'));
    const events = getBufferAsJsonl().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    const potionEvent = events.find((e) => e.type === 'potion_used');
    assert.ok(potionEvent);
    assert.equal(potionEvent.itemId, 'potion');
    assert.equal(potionEvent.inBattle, false);
  });

  await t.test('the X button, Escape, and backdrop click all call onClose', async () => {
    let closed = 0;
    const root = await mountInventory(buildState(), { onChange: () => {}, onClose: () => { closed += 1; } });
    click(root.querySelector('#btn-close-x'));
    keydown('Escape');
    click(root);
    assert.equal(closed, 3);
  });

  await t.test('clicking inside the panel does not call onClose', async () => {
    let closed = false;
    const root = await mountInventory(buildState(), { onChange: () => {}, onClose: () => { closed = true; } });
    click(root.querySelector('.inventory-panel'));
    assert.equal(closed, false);
  });
});
