// Real DOM tests for js/screens/messageLogScreen.js, using jsdom (see
// tests/helpers/dom.js). Scope: the close affordances added 2026-09-02 (X
// button, Escape, click-outside) - this screen had no prior DOM coverage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, click, keydown } from './helpers/dom.js';

async function mountMessageLog(callbacks = { onClose: () => {} }) {
  const { mount } = await import('../js/screens/messageLogScreen.js');
  const root = createRoot();
  mount(root, { callbacks });
  return root;
}

test('messageLogScreen DOM - close affordances', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/messageLogScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('the X button, Escape, and backdrop click all call onClose', async () => {
    let closed = 0;
    const root = await mountMessageLog({ onClose: () => { closed += 1; } });
    click(root.querySelector('#btn-close-x'));
    keydown('Escape');
    click(root);
    assert.equal(closed, 3);
  });

  await t.test('clicking inside the panel does not call onClose', async () => {
    let closed = false;
    const root = await mountMessageLog({ onClose: () => { closed = true; } });
    click(root.querySelector('.message-log-panel'));
    assert.equal(closed, false);
  });

  await t.test('the existing Close button still calls onClose', async () => {
    let closed = false;
    const root = await mountMessageLog({ onClose: () => { closed = true; } });
    click(root.querySelector('#btn-close-message-log'));
    assert.equal(closed, true);
  });
});
