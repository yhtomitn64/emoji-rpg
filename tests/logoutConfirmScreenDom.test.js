// Real DOM tests for js/screens/logoutConfirmScreen.js, using jsdom (see
// tests/helpers/dom.js). Scope: the close affordances added 2026-09-02 (X
// button, Escape, click-outside) - this screen had no prior DOM coverage.
// Escape/X/backdrop all map to the cancel path, never the destructive
// "Switch Character" confirm action.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, click, keydown } from './helpers/dom.js';

async function mountLogoutConfirm(callbacks = { onConfirm: () => {}, onCancel: () => {} }) {
  const { mount } = await import('../js/screens/logoutConfirmScreen.js');
  const root = createRoot();
  mount(root, { callbacks });
  return root;
}

test('logoutConfirmScreen DOM - close affordances', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/logoutConfirmScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('the X button, Escape, and backdrop click all call onCancel, never onConfirm', async () => {
    let cancelled = 0;
    let confirmed = false;
    const root = await mountLogoutConfirm({ onConfirm: () => { confirmed = true; }, onCancel: () => { cancelled += 1; } });
    click(root.querySelector('#btn-close-x'));
    keydown('Escape');
    click(root);
    assert.equal(cancelled, 3);
    assert.equal(confirmed, false);
  });

  await t.test('clicking inside the panel does not call onCancel', async () => {
    let cancelled = false;
    const root = await mountLogoutConfirm({ onConfirm: () => {}, onCancel: () => { cancelled = true; } });
    click(root.querySelector('.overlay-panel'));
    assert.equal(cancelled, false);
  });
});
