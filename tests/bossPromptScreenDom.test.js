// Real DOM tests for js/screens/bossPromptScreen.js, using jsdom (see
// tests/helpers/dom.js). Scope: the close affordances added 2026-09-02 (X
// button, Escape, click-outside) - this screen had no prior DOM coverage.
// The screen has two sub-states (main tier-select, and the NG+ confirm step
// reachable from it) - close affordances back out one level at a time, not
// straight past both.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, click, keydown } from './helpers/dom.js';

function baseCallbacks(overrides = {}) {
  return { onFight: () => {}, onWalkAway: () => {}, onStartNgPlus: () => {}, ...overrides };
}

async function mountBossPrompt(props = {}, callbacks = baseCallbacks()) {
  const { mount } = await import('../js/screens/bossPromptScreen.js');
  const root = createRoot();
  mount(root, { text: 'The dragon awaits.', showNgPlus: false, clearedTiers: [], currentTier: 0, callbacks, ...props });
  return root;
}

test('bossPromptScreen DOM - close affordances', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/bossPromptScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('in the main tier-select state, the X button, Escape, and backdrop click all call onWalkAway', async () => {
    let walkedAway = 0;
    const root = await mountBossPrompt({}, baseCallbacks({ onWalkAway: () => { walkedAway += 1; } }));
    click(root.querySelector('#btn-close-x'));
    keydown('Escape');
    click(root);
    assert.equal(walkedAway, 3);
  });

  await t.test('clicking inside the panel does not call onWalkAway', async () => {
    let walkedAway = false;
    const root = await mountBossPrompt({}, baseCallbacks({ onWalkAway: () => { walkedAway = true; } }));
    click(root.querySelector('.boss-prompt-panel'));
    assert.equal(walkedAway, false);
  });

  await t.test('in the NG+ confirm sub-state, Escape returns to the main state instead of calling onWalkAway', async () => {
    let walkedAway = false;
    const root = await mountBossPrompt({ showNgPlus: true }, baseCallbacks({ onWalkAway: () => { walkedAway = true; } }));
    click(root.querySelector('#btn-boss-ngplus'));
    assert.ok(root.querySelector('#btn-ngplus-confirm'), 'expected the NG+ confirm sub-screen to be showing');

    keydown('Escape');
    assert.equal(walkedAway, false, 'Escape from the confirm step should back out to the main state, not exit the whole prompt');
    assert.ok(root.querySelector('#btn-boss-not-yet'), 'expected to be back on the main tier-select state');
  });

  await t.test('in the NG+ confirm sub-state, the X button also returns to the main state', async () => {
    const root = await mountBossPrompt({ showNgPlus: true });
    click(root.querySelector('#btn-boss-ngplus'));
    click(root.querySelector('#btn-close-x'));
    assert.ok(root.querySelector('#btn-boss-not-yet'), 'expected to be back on the main tier-select state');
  });
});
