// Real DOM tests for js/screens/mechanicExplainerScreen.js, using jsdom (see
// tests/helpers/dom.js). Scope: DOM structure and event wiring, not
// pixel-level rendering - see battleScreenDom.test.js's own header for why
// this pattern exists. Mirrors changelogScreenDom.test.js, the closest
// existing analog (a dismissable overlay-panel screen).
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, click, keydown } from './helpers/dom.js';

const SAMPLE_SECTIONS = [
  { icon: '🗡️', title: 'Impale', text: 'A strong precise thrust.' },
  { icon: '🪓', title: 'Sever', text: 'Cuts into a second target too.' },
];

async function mountExplainer(props, callbacks) {
  const { mount } = await import('../js/screens/mechanicExplainerScreen.js');
  const root = createRoot();
  mount(root, { title: 'New Ability!', sections: SAMPLE_SECTIONS, ...props, callbacks });
  return root;
}

test('mechanicExplainerScreen DOM', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mechanicExplainerScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('renders the given title', async () => {
    const root = await mountExplainer({}, { onClose: () => {} });
    assert.ok(root.textContent.includes('New Ability!'));
  });

  await t.test('renders each section\'s icon, title, and text', async () => {
    const root = await mountExplainer({}, { onClose: () => {} });
    const text = root.textContent;
    assert.ok(text.includes('🗡️'));
    assert.ok(text.includes('Impale'));
    assert.ok(text.includes('A strong precise thrust.'));
    assert.ok(text.includes('🪓'));
    assert.ok(text.includes('Sever'));
    assert.ok(text.includes('Cuts into a second target too.'));
  });

  await t.test('close button calls onClose', async () => {
    let closed = false;
    const root = await mountExplainer({}, { onClose: () => { closed = true; } });
    root.querySelector('#btn-close-mechanic-explainer').click();
    assert.equal(closed, true);
  });

  await t.test('the X button calls onClose', async () => {
    let closed = false;
    const root = await mountExplainer({}, { onClose: () => { closed = true; } });
    click(root.querySelector('#btn-close-x'));
    assert.equal(closed, true);
  });

  await t.test('Escape calls onClose', async () => {
    let closed = false;
    await mountExplainer({}, { onClose: () => { closed = true; } });
    keydown('Escape');
    assert.equal(closed, true);
  });

  await t.test('clicking the backdrop (the mounted root itself) calls onClose', async () => {
    let closed = false;
    const root = await mountExplainer({}, { onClose: () => { closed = true; } });
    click(root);
    assert.equal(closed, true);
  });

  await t.test('clicking inside the dialog panel does not call onClose', async () => {
    let closed = false;
    const root = await mountExplainer({}, { onClose: () => { closed = true; } });
    click(root.querySelector('.mechanic-explainer-panel'));
    assert.equal(closed, false);
  });
});
