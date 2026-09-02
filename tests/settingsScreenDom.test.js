// Real DOM tests for js/screens/settingsScreen.js, using jsdom (see
// tests/helpers/dom.js). Scope: DOM structure and event wiring - see
// battleScreenDom.test.js's own header for why this pattern exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, click, keydown } from './helpers/dom.js';
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

  await t.test('the X button, Escape, and backdrop click all call onClose', async () => {
    let closed = 0;
    const root = await mountSettings(createNewGame(), { onChange: () => {}, onClose: () => { closed += 1; } });
    click(root.querySelector('#btn-close-x'));
    keydown('Escape');
    click(root);
    assert.equal(closed, 3);
  });

  await t.test('clicking inside the panel does not call onClose', async () => {
    let closed = false;
    const root = await mountSettings(createNewGame(), { onChange: () => {}, onClose: () => { closed = true; } });
    click(root.querySelector('.settings-panel'));
    assert.equal(closed, false);
  });

  await t.test('Copy Play Log copies buffered events via the Clipboard API when available', async () => {
    const { startSession, logEvent } = await import('../js/systems/telemetry.js');
    startSession();
    logEvent('level_up', { level: 2 });
    let copiedText = null;
    window.navigator.clipboard = { writeText: async (text) => { copiedText = text; } };
    const root = await mountSettings(createNewGame());
    click(root.querySelector('#btn-copy-play-log'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(copiedText.includes('"level":2'));
    assert.equal(root.querySelector('#play-log-fallback').hidden, true);
  });

  await t.test('Copy Play Log falls back to a visible textarea when the Clipboard API is unavailable', async () => {
    const { startSession, logEvent } = await import('../js/systems/telemetry.js');
    startSession();
    logEvent('tool_acquired', { toolId: 'axe' });
    // jsdom has no navigator.clipboard by default - exercises the fallback path.
    const root = await mountSettings(createNewGame());
    click(root.querySelector('#btn-copy-play-log'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const fallback = root.querySelector('#play-log-fallback');
    assert.equal(fallback.hidden, false);
    assert.ok(fallback.value.includes('"toolId":"axe"'));
  });
});
