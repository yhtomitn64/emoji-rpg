// tests/audioHookWiring.test.js
//
// Verifies each existing visual-effect function also triggers the right
// sound, by injecting a fake fetch into the real audio engine and checking
// which path it requested - not by mocking the audio module (node:test's
// ESM module mocking needs a flag this repo's CI doesn't set on Node 20).
// Uses the shared jsdom harness (tests/helpers/dom.js), same as
// celebrationEffect.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom, teardownDom } from './helpers/dom.js';
import { initAudio } from '../js/systems/audio.js';

class FakeGainNode { constructor() { this.gain = { value: 1, setValueAtTime(){}, linearRampToValueAtTime(){} }; } connect(){} }
class FakeBufferSource { connect(){} start(){} stop(){} }
class FakeAudioContext {
  constructor() { this.destination = {}; this.currentTime = 0; }
  createGain() { return new FakeGainNode(); }
  createBufferSource() { return new FakeBufferSource(); }
  async decodeAudioData() { return {}; }
  async resume() {}
}

function fakeFetch() {
  const calls = [];
  const fn = async (url) => { calls.push(url); return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) }; };
  fn.calls = calls;
  return fn;
}

test('audio hook wiring', async (t) => {
  t.beforeEach(() => setupDom());
  t.afterEach(() => teardownDom());

  await t.test('playCelebration and playToolCelebration play their sounds', async () => {
    document.body.innerHTML = `
      <div id="flavor-banner"></div>
      <div id="celebration-burst"></div>
      <div id="celebration-big-text"></div>
      <div id="celebration-tool-callout"></div>
    `;
    const fetchSpy = fakeFetch();
    initAudio({ AudioContextClass: FakeAudioContext, fetchImpl: fetchSpy });
    const { playCelebration, playToolCelebration } = await import('../js/screens/celebrationEffect.js');
    playCelebration('🎉', 'Nice!');
    playToolCelebration('🪓', 'Got the axe!', 'Chop trees now');
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(fetchSpy.calls.length, 2);
    assert.match(fetchSpy.calls[0], /celebrationGeneric/);
    assert.match(fetchSpy.calls[1], /toolCelebration/);
  });

  await t.test('playItemPickupToast plays a sound', async () => {
    document.body.innerHTML = `
      <button id="btn-open-inventory"></button>
      <div id="item-pickup-toast"></div>
    `;
    const fetchSpy = fakeFetch();
    initAudio({ AudioContextClass: FakeAudioContext, fetchImpl: fetchSpy });
    const { playItemPickupToast } = await import('../js/screens/itemPickupToast.js');
    playItemPickupToast('🧪', 'Potion');
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(fetchSpy.calls.length, 1);
    assert.match(fetchSpy.calls[0], /itemPickupCommon/);
  });
});
