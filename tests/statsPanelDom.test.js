// Real DOM tests for js/screens/statsPanel.js, using jsdom (see
// tests/helpers/dom.js). Scope: the close affordances added 2026-09-02 (X
// button, Escape, click-outside) - this screen had no prior DOM coverage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, click, keydown } from './helpers/dom.js';
import { createNewGame } from '../js/state.js';

async function mountStats(state, callbacks = { onClose: () => {} }) {
  const { mount } = await import('../js/screens/statsPanel.js');
  const root = createRoot();
  mount(root, { state, callbacks });
  return root;
}

test('statsPanel DOM - close affordances', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/statsPanel.js');
    unmount();
    teardownDom();
  });

  await t.test('the X button, Escape, and backdrop click all call onClose', async () => {
    let closed = 0;
    const root = await mountStats(createNewGame(), { onClose: () => { closed += 1; } });
    click(root.querySelector('#btn-close-x'));
    keydown('Escape');
    click(root);
    assert.equal(closed, 3);
  });

  await t.test('clicking inside the panel does not call onClose', async () => {
    let closed = false;
    const root = await mountStats(createNewGame(), { onClose: () => { closed = true; } });
    click(root.querySelector('.stats-panel'));
    assert.equal(closed, false);
  });

  await t.test('the existing Close button still calls onClose', async () => {
    let closed = false;
    const root = await mountStats(createNewGame(), { onClose: () => { closed = true; } });
    click(root.querySelector('#btn-close-stats'));
    assert.equal(closed, true);
  });

  // Raised alongside the superboss pass: parryWindowBonusPercent
  // (parryMasterRing) and debuffDurationPercent (unshakenCharm) were added
  // as real stat keys but had no effectRows line, so equipping either item
  // showed no feedback anywhere in the stats panel.
  await t.test('parryWindowBonusPercent and debuffDurationPercent render their own effect rows when equipped', async () => {
    const state = createNewGame();
    state.equipment = { ...state.equipment, ring1: 'parryMasterRing', accessory: 'unshakenCharm' };
    const root = await mountStats(state);
    assert.match(root.innerHTML, /Parry Window: \+15%/);
    assert.match(root.innerHTML, /Debuff Resist: 40%/);
  });
});
