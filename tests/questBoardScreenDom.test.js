// Real DOM tests for js/screens/questBoardScreen.js, using jsdom (see
// tests/helpers/dom.js). Scope: the close affordances added 2026-09-02 (X
// button, Escape) - this screen had no prior DOM coverage. No backdrop-click
// test here - this is a full-page screen (mountScreen, not mountOverlay),
// so there's no backdrop to click.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, click, keydown } from './helpers/dom.js';
import { createNewGame } from '../js/state.js';

async function mountQuestBoard(state, callbacks = { onTurnIn: () => {}, onLeave: () => {} }) {
  const { mount } = await import('../js/screens/questBoardScreen.js');
  const root = createRoot();
  mount(root, { state, callbacks });
  return root;
}

test('questBoardScreen DOM - close affordances', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/questBoardScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('the X button calls onLeave', async () => {
    let left = false;
    const root = await mountQuestBoard(createNewGame(), { onTurnIn: () => {}, onLeave: () => { left = true; } });
    click(root.querySelector('#btn-close-x'));
    assert.equal(left, true);
  });

  await t.test('Escape calls onLeave', async () => {
    let left = false;
    await mountQuestBoard(createNewGame(), { onTurnIn: () => {}, onLeave: () => { left = true; } });
    keydown('Escape');
    assert.equal(left, true);
  });
});
