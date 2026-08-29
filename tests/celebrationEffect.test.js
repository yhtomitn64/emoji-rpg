// Real DOM tests for js/screens/celebrationEffect.js, using jsdom (see
// tests/helpers/dom.js). Scope: the tool-pickup celebration's player-tile
// anchoring and its slowed-down orbit duration - not pixel-perfect rendering,
// see mapScreenDom.test.js's own header for why this pattern exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from './helpers/dom.js';

function buildCelebrationDom() {
  document.body.innerHTML = `
    <div id="flavor-banner"></div>
    <div id="celebration-burst"></div>
    <div id="celebration-big-text"></div>
    <div id="celebration-tool-callout"></div>
  `;
}

function addPlayerCell(rect) {
  const playerCell = document.createElement('div');
  playerCell.className = 'map-tile-player';
  playerCell.getBoundingClientRect = () => rect;
  document.body.appendChild(playerCell);
  return playerCell;
}

test('celebrationEffect', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(() => teardownDom());

  await t.test('playToolCelebration anchors the burst to the player tile when one exists', async () => {
    buildCelebrationDom();
    addPlayerCell({ left: 100, top: 200, width: 40, height: 40, right: 140, bottom: 240 });

    const { playToolCelebration } = await import('../js/screens/celebrationEffect.js');
    playToolCelebration('🪓', 'msg', 'capability');

    const burstEl = document.getElementById('celebration-burst');
    assert.equal(burstEl.style.left, '120px');
    assert.equal(burstEl.style.top, '220px');
  });

  await t.test('playToolCelebration falls back to the default center position when no player tile is in the DOM', async () => {
    buildCelebrationDom();

    const { playToolCelebration } = await import('../js/screens/celebrationEffect.js');
    playToolCelebration('🪓', 'msg', 'capability');

    const burstEl = document.getElementById('celebration-burst');
    assert.equal(burstEl.style.left, '');
    assert.equal(burstEl.style.top, '');
  });

  await t.test('playCelebration clears any leftover player-anchored position from a prior tool celebration', async () => {
    buildCelebrationDom();
    addPlayerCell({ left: 100, top: 200, width: 40, height: 40, right: 140, bottom: 240 });

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
