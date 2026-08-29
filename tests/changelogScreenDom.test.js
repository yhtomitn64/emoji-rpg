// Real DOM tests for js/screens/changelogScreen.js, using jsdom (see
// tests/helpers/dom.js). Scope: DOM structure and event wiring, not
// pixel-level rendering - see battleScreenDom.test.js's own header for why
// this pattern exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot } from './helpers/dom.js';

const SAMPLE_ENTRIES = [
  { version: '0.6.0', date: '2026-08-28', highlights: ['Added an in-game changelog'] },
  { version: '0.5.1', date: '2026-08-17', highlights: ['Battles now swirl in and out'] },
];

async function mountChangelog(entries, callbacks) {
  const { mount } = await import('../js/screens/changelogScreen.js');
  const root = createRoot();
  mount(root, { entries, callbacks });
  return root;
}

test('changelogScreen DOM', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/changelogScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('renders each entry\'s version/date heading', async () => {
    const root = await mountChangelog(SAMPLE_ENTRIES, { onClose: () => {} });
    const text = root.textContent;
    assert.ok(text.includes('0.6.0'));
    assert.ok(text.includes('0.5.1'));
    assert.ok(text.includes('2026-08-17'));
  });

  await t.test('renders each entry\'s highlight bullets', async () => {
    const root = await mountChangelog(SAMPLE_ENTRIES, { onClose: () => {} });
    assert.ok(root.textContent.includes('Added an in-game changelog'));
    assert.equal(root.querySelectorAll('li').length, 2);
  });

  await t.test('close button calls onClose', async () => {
    let closed = false;
    const root = await mountChangelog(SAMPLE_ENTRIES, { onClose: () => { closed = true; } });
    root.querySelector('#btn-close-changelog').click();
    assert.equal(closed, true);
  });
});
