// Real DOM tests for js/screens/flavorBanner.js, using jsdom (see
// tests/helpers/dom.js). tests/flavorBanner.test.js already covers the
// message-log side effect with document stubbed out entirely - this file
// covers the actual rendered banner: text, the close button, and the
// hover-pauses-auto-hide behavior. jsdom has no real layout engine, so
// positioning is verified by behavior (does it read #hud's rect when
// present?) rather than asserting exact pixel values - see this file's own
// header convention in mapScreenDom.test.js/battleScreenDom.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom, click } from './helpers/dom.js';
import { showFlavorBanner } from '../js/screens/flavorBanner.js';

function buildHudAndBanner() {
  const hud = document.createElement('div');
  hud.id = 'hud';
  document.body.appendChild(hud);
  const banner = document.createElement('div');
  banner.id = 'flavor-banner';
  document.body.appendChild(banner);
  return { hud, banner };
}

test('flavorBanner DOM', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(() => teardownDom());

  await t.test('showFlavorBanner renders the text and becomes visible', () => {
    const { banner } = buildHudAndBanner();
    showFlavorBanner('hello there');
    assert.match(banner.textContent, /hello there/);
    assert.ok(banner.classList.contains('visible'));
  });

  await t.test('the banner has a close button that hides it', () => {
    const { banner } = buildHudAndBanner();
    showFlavorBanner('hello there', 20);
    const closeButton = banner.querySelector('.flavor-banner-close');
    assert.ok(closeButton, 'expected a close button inside the banner');
    click(closeButton);
    assert.equal(banner.classList.contains('visible'), false);
  });

  await t.test('hovering the banner pauses the auto-hide countdown; leaving restarts it', async () => {
    const { banner } = buildHudAndBanner();
    showFlavorBanner('hello there', 20);
    banner.dispatchEvent(new window.MouseEvent('mouseenter'));
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.ok(banner.classList.contains('visible'), 'expected the banner to still be visible while hovered, well past the un-hovered duration');
    banner.dispatchEvent(new window.MouseEvent('mouseleave'));
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(banner.classList.contains('visible'), false, 'expected the banner to auto-hide a fresh full duration after the mouse left');
  });

  await t.test('showFlavorBanner does not throw when #hud is missing', () => {
    const banner = document.createElement('div');
    banner.id = 'flavor-banner';
    document.body.appendChild(banner);
    assert.doesNotThrow(() => showFlavorBanner('no hud here'));
    assert.ok(banner.classList.contains('visible'));
  });

  await t.test('re-showing the banner in a freshly rebuilt DOM (new #flavor-banner element) still works', () => {
    // Regression guard for the self-healing check in ensureInitialized():
    // a naive one-time "already initialized" boolean would keep pointing at
    // a previous test's now-detached banner element instead of rebuilding
    // into this fresh one.
    const { banner } = buildHudAndBanner();
    showFlavorBanner('second verse');
    assert.match(banner.textContent, /second verse/);
    assert.ok(banner.querySelector('.flavor-banner-close'));
  });
});
