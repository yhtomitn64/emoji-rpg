// Real DOM tests for js/screens/lootReferenceScreen.js, using jsdom (see
// tests/helpers/dom.js). Scope: the "own N" ownership marker, specifically
// the ring-slot bug where an item equipped in ring1/ring2 was never counted
// because the screen used to index state.equipment by item.slot ('ring'),
// which is never a real physical equipment key (see js/state.js's
// equipment shape: weapon/head/body/legs/accessory/ring1/ring2).
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, click, keydown } from './helpers/dom.js';
import { createNewGame } from '../js/state.js';

async function mountLootReference(state, callbacks = { onClose: () => {} }) {
  const { mount } = await import('../js/screens/lootReferenceScreen.js');
  const root = createRoot();
  mount(root, { state, callbacks });
  return root;
}

test('lootReferenceScreen DOM', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/lootReferenceScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('an equipped-only ring (zero copies in inventory) still shows as owned', async () => {
    const state = createNewGame();
    state.equipment.ring1 = 'emberRing';
    const root = await mountLootReference(state);
    const rows = [...root.querySelectorAll('.inventory-row')];
    const emberRow = rows.find((row) => row.textContent.includes('Ember Ring'));
    assert.ok(emberRow, 'expected an Ember Ring row to render');
    assert.ok(emberRow.textContent.includes('(own 1)'));
  });

  await t.test('the X button, Escape, and backdrop click all call onClose', async () => {
    let closed = 0;
    const state = createNewGame();
    const root = await mountLootReference(state, { onClose: () => { closed += 1; } });

    click(root.querySelector('#btn-close-x'));
    keydown('Escape');
    click(root);
    assert.equal(closed, 3);
  });

  await t.test('clicking inside the panel does not call onClose', async () => {
    let closed = false;
    const state = createNewGame();
    const root = await mountLootReference(state, { onClose: () => { closed = true; } });
    click(root.querySelector('.loot-reference-panel'));
    assert.equal(closed, false);
  });
});
