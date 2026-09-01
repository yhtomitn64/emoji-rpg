// Real DOM tests for js/screens/settingsScreen.js, using jsdom (see
// tests/helpers/dom.js). Scope: DOM structure and event wiring - see
// battleScreenDom.test.js's own header for why this pattern exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, click } from './helpers/dom.js';
import { createNewGame } from '../js/state.js';

async function mountSettings(state, callbacks = { onChange: () => {}, onClose: () => {} }) {
  const { mount } = await import('../js/screens/settingsScreen.js');
  const root = createRoot();
  mount(root, { state, callbacks });
  return root;
}

test('settingsScreen DOM', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/settingsScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('shows the current itemMenuAutoCloseMs value', async () => {
    const state = { ...createNewGame(), settings: { itemMenuAutoCloseMs: 1500 } };
    const root = await mountSettings(state);
    assert.equal(root.querySelector('#settings-item-menu-auto-close').value, '1500');
  });

  await t.test('changing the input updates state and calls onChange', async () => {
    let changed = false;
    const state = createNewGame();
    const root = await mountSettings(state, { onChange: () => { changed = true; }, onClose: () => {} });
    const input = root.querySelector('#settings-item-menu-auto-close');
    input.value = '2000';
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(state.settings.itemMenuAutoCloseMs, 2000);
    assert.equal(changed, true);
  });

  await t.test('clamps the value to the min/max range', async () => {
    const state = createNewGame();
    const root = await mountSettings(state);
    const input = root.querySelector('#settings-item-menu-auto-close');
    input.value = '99999';
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(state.settings.itemMenuAutoCloseMs, 5000);
    input.value = '0';
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(state.settings.itemMenuAutoCloseMs, 250);
  });

  await t.test('Close calls onClose', async () => {
    let closed = false;
    const root = await mountSettings(createNewGame(), { onChange: () => {}, onClose: () => { closed = true; } });
    click(root.querySelector('#btn-close-settings'));
    assert.equal(closed, true);
  });
});
