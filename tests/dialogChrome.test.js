import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, createRoot, click, keydown } from './helpers/dom.js';

test('dialogChrome', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(() => teardownDom());

  await t.test('bindEscapeClose fires onClose on Escape and not on other keys', async () => {
    const { bindEscapeClose } = await import('../js/screens/dialogChrome.js');
    let closed = 0;
    bindEscapeClose(() => { closed += 1; });

    keydown('a');
    assert.equal(closed, 0);
    keydown('Escape');
    assert.equal(closed, 1);
  });

  await t.test('bindEscapeClose unbind stops it from firing', async () => {
    const { bindEscapeClose } = await import('../js/screens/dialogChrome.js');
    let closed = 0;
    const unbind = bindEscapeClose(() => { closed += 1; });
    unbind();

    keydown('Escape');
    assert.equal(closed, 0);
  });

  await t.test('bindBackdropClose fires only when the click target is the root itself', async () => {
    const { bindBackdropClose } = await import('../js/screens/dialogChrome.js');
    const root = createRoot();
    const inner = document.createElement('div');
    root.appendChild(inner);
    let closed = 0;
    bindBackdropClose(root, () => { closed += 1; });

    click(inner);
    assert.equal(closed, 0, 'a click on a child of the backdrop should not close it');
    click(root);
    assert.equal(closed, 1);
  });

  await t.test('bindBackdropClose unbind stops it from firing', async () => {
    const { bindBackdropClose } = await import('../js/screens/dialogChrome.js');
    const root = createRoot();
    let closed = 0;
    const unbind = bindBackdropClose(root, () => { closed += 1; });
    unbind();

    click(root);
    assert.equal(closed, 0);
  });
});
