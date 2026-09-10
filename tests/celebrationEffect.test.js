// Real DOM tests for js/screens/celebrationEffect.js, using jsdom (see
// tests/helpers/dom.js). Scope: the tool-pickup celebration's player-tile
// anchoring and its slowed-down orbit duration - not pixel-perfect rendering,
// see mapScreenDom.test.js's own header for why this pattern exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from './helpers/dom.js';
import { createNewGame } from '../js/state.js';
import { townMap } from '../js/maps/townMap.js';
import { buildWorldGrid } from '../js/systems/worldGrid.js';

function buildCelebrationDom() {
  document.body.innerHTML = `
    <div id="flavor-banner"></div>
    <div id="celebration-burst"></div>
    <div id="celebration-big-text"></div>
    <div id="celebration-tool-callout"></div>
  `;
}

// celebrationEffect.js used to find the hero by querying for a
// '.map-tile-player' element, which only the DOM renderer ever produced -
// the canvas renderer has no per-tile elements at all. It now asks
// mapScreen.getPlayerScreenRect() instead, so this mounts a real map and
// stubs the found cell's rect (jsdom has no layout engine, so a real
// getBoundingClientRect there is all zeros) rather than faking a loose
// element on document.body that nothing would actually consult.
async function mountMapWithPlayerRect(rect) {
  const { mount } = await import('../js/screens/mapScreen.js');
  const root = document.createElement('div');
  document.body.appendChild(root);
  const maps = { town: townMap };
  mount(root, {
    renderer: 'dom',
    state: { ...createNewGame(), position: { ...townMap.startPosition } },
    mapConfig: townMap,
    maps,
    worldGrid: buildWorldGrid(maps),
    callbacks: { onFirstVisit: () => {} },
  });
  const playerCell = root.querySelector('.map-tile-player');
  assert.ok(playerCell, 'expected the mounted map to render a player tile');
  playerCell.getBoundingClientRect = () => rect;
}

test('celebrationEffect', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(async () => {
    const { unmount } = await import('../js/screens/mapScreen.js');
    unmount();
    teardownDom();
  });

  await t.test('playToolCelebration anchors the burst to the player tile when one exists', async () => {
    buildCelebrationDom();
    await mountMapWithPlayerRect({ left: 100, top: 200, width: 40, height: 40, right: 140, bottom: 240 });

    const { playToolCelebration } = await import('../js/screens/celebrationEffect.js');
    playToolCelebration('🪓', 'msg', 'capability');

    const burstEl = document.getElementById('celebration-burst');
    assert.equal(burstEl.style.left, '120px');
    assert.equal(burstEl.style.top, '220px');
  });

  await t.test('playToolCelebration falls back to the default center position when no map is mounted', async () => {
    buildCelebrationDom();

    const { playToolCelebration } = await import('../js/screens/celebrationEffect.js');
    playToolCelebration('🪓', 'msg', 'capability');

    const burstEl = document.getElementById('celebration-burst');
    assert.equal(burstEl.style.left, '');
    assert.equal(burstEl.style.top, '');
  });

  await t.test('playCelebration clears any leftover player-anchored position from a prior tool celebration', async () => {
    buildCelebrationDom();
    await mountMapWithPlayerRect({ left: 100, top: 200, width: 40, height: 40, right: 140, bottom: 240 });

    const { playCelebration, playToolCelebration } = await import('../js/screens/celebrationEffect.js');
    playToolCelebration('🪓', 'msg', 'capability');
    playCelebration('🎉', 'other msg');

    const burstEl = document.getElementById('celebration-burst');
    assert.equal(burstEl.style.left, '');
    assert.equal(burstEl.style.top, '');
  });

  await t.test('the tool celebration orbit lasts roughly twice as long as before (past 1400ms, done by ~2900ms)', async () => {
    buildCelebrationDom();

    const { playToolCelebration } = await import('../js/screens/celebrationEffect.js');
    playToolCelebration('🪓', 'msg', 'capability');
    const burstEl = document.getElementById('celebration-burst');
    assert.ok(burstEl.classList.contains('celebration-burst-tool-play'));

    await new Promise((resolve) => setTimeout(resolve, 1500));
    assert.ok(burstEl.classList.contains('celebration-burst-tool-play'), 'still playing past the old 1400ms duration');

    await new Promise((resolve) => setTimeout(resolve, 1400));
    assert.equal(burstEl.classList.contains('celebration-burst-tool-play'), false, 'finished by ~2900ms total');
  });
});
