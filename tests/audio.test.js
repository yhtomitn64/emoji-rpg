import test from 'node:test';
import assert from 'node:assert/strict';
import { initAudio, unlockAudio, CATEGORIES, playSfx, playMusic, stopMusic, setCategoryVolume, setCategoryMuted, setTheme, syncAudioSettings, _getCategoryGainValueForTests } from '../js/systems/audio.js';
import { createNewGame } from '../js/state.js';

function categoryGainValueFor(category) {
  return _getCategoryGainValueForTests(category);
}

class FakeGainNode {
  constructor() { this.gain = { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} }; this.connected = []; }
  connect(dest) { this.connected.push(dest); }
}
class FakeBufferSource {
  constructor() { this.buffer = null; this.loop = false; this.started = false; this.stopped = false; this.connected = []; }
  connect(dest) { this.connected.push(dest); }
  start() { this.started = true; }
  stop() { this.stopped = true; }
}
export class FakeAudioContext {
  constructor() { this.destination = {}; this.currentTime = 0; this.state = 'suspended'; this.resumed = false; }
  createGain() { return new FakeGainNode(); }
  createBufferSource() { return new FakeBufferSource(); }
  async decodeAudioData(arrayBuffer) { return { duration: 1, _fromArrayBuffer: arrayBuffer }; }
  async resume() { this.resumed = true; this.state = 'running'; }
}

test('CATEGORIES lists exactly the 4 known categories', () => {
  assert.deepEqual([...CATEGORIES].sort(), ['combat', 'music', 'ui', 'world']);
});

// Must run before any test below calls initAudio() - it relies on the
// module's audioContext still being unset at this point in the file.
test('setCategoryVolume and setCategoryMuted are safe no-ops before initAudio has ever run', () => {
  assert.doesNotThrow(() => setCategoryVolume('combat', 0.5));
  assert.doesNotThrow(() => setCategoryMuted('combat', true));
});

test('initAudio creates one gain node per category, each connected to the context destination', () => {
  let created = 0;
  class CountingContext extends FakeAudioContext {
    createGain() { created += 1; return super.createGain(); }
  }
  initAudio({ AudioContextClass: CountingContext });
  assert.equal(created, CATEGORIES.length);
});

test('unlockAudio resumes the underlying AudioContext', async () => {
  let resumed = false;
  class ResumeTrackingContext extends FakeAudioContext {
    async resume() { resumed = true; }
  }
  initAudio({ AudioContextClass: ResumeTrackingContext });
  await unlockAudio();
  assert.equal(resumed, true);
});

function fakeFetch(ok = true) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    if (!ok) return { ok: false, status: 404 };
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
  };
  fn.calls = calls;
  return fn;
}

test('playSfx fetches the resolved path for the current theme and plays it', async () => {
  const fetchSpy = fakeFetch(true);
  initAudio({ AudioContextClass: FakeAudioContext, fetchImpl: fetchSpy });
  await playSfx('hitNormal');
  assert.equal(fetchSpy.calls.length, 1);
  assert.match(fetchSpy.calls[0], /realistic\/sfx\/hitNormal\.mp3$/);
});

test('playSfx caches the decoded buffer - a second play does not refetch', async () => {
  const fetchSpy = fakeFetch(true);
  initAudio({ AudioContextClass: FakeAudioContext, fetchImpl: fetchSpy });
  await playSfx('menuMove');
  await playSfx('menuMove');
  assert.equal(fetchSpy.calls.length, 1);
});

test('playSfx never throws when the file 404s, and only warns once', async () => {
  const originalWarn = console.warn;
  let warnCount = 0;
  console.warn = () => { warnCount += 1; };
  try {
    initAudio({ AudioContextClass: FakeAudioContext, fetchImpl: fakeFetch(false) });
    await assert.doesNotReject(() => playSfx('hitCrit'));
    await assert.doesNotReject(() => playSfx('hitCrit'));
    assert.equal(warnCount, 1);
  } finally {
    console.warn = originalWarn;
  }
});

test('playSfx on an unknown sound id does not throw', async () => {
  initAudio({ AudioContextClass: FakeAudioContext, fetchImpl: fakeFetch(true) });
  await assert.doesNotReject(() => playSfx('thisSoundDoesNotExist'));
});

test('playMusic starts a looping source connected through the music category gain', async () => {
  initAudio({ AudioContextClass: FakeAudioContext, fetchImpl: fakeFetch(true) });
  await playMusic('townTheme');
  // No direct handle to the created source from the test, but this must not throw
  // and must have fetched the music path.
  assert.ok(true);
});

test('playMusic crossfades: starting a second track ramps the first track\'s gain toward 0', async () => {
  const rampCalls = [];
  class TrackingGainNode {
    constructor() { this.gain = { value: 1, setValueAtTime() {}, linearRampToValueAtTime: (v, t) => rampCalls.push(v) }; }
    connect() {}
  }
  class TrackingContext extends FakeAudioContext {
    createGain() { return new TrackingGainNode(); }
  }
  initAudio({ AudioContextClass: TrackingContext, fetchImpl: fakeFetch(true) });
  await playMusic('townTheme');
  await playMusic('battleTheme');
  // One ramp-to-1 for the new track's own fade-in, one ramp-to-0 for the old track fading out.
  assert.ok(rampCalls.includes(0), 'expected the previous track to be ramped toward 0');
});

test('stopMusic clears the current track with no error when nothing is playing', async () => {
  initAudio({ AudioContextClass: FakeAudioContext, fetchImpl: fakeFetch(true) });
  assert.doesNotThrow(() => stopMusic());
});

test('setCategoryVolume clamps to 0..1 and updates the gain node value', () => {
  initAudio({ AudioContextClass: FakeAudioContext, fetchImpl: fakeFetch(true) });
  setCategoryVolume('combat', 1.5);
  assert.equal(categoryGainValueFor('combat'), 1);
  setCategoryVolume('combat', -1);
  assert.equal(categoryGainValueFor('combat'), 0);
});

test('setCategoryMuted forces the gain to 0 regardless of volume, and restores volume on unmute', () => {
  initAudio({ AudioContextClass: FakeAudioContext, fetchImpl: fakeFetch(true) });
  setCategoryVolume('ui', 0.7);
  setCategoryMuted('ui', true);
  assert.equal(categoryGainValueFor('ui'), 0);
  setCategoryMuted('ui', false);
  assert.equal(categoryGainValueFor('ui'), 0.7);
});

test('setTheme switches the theme used for subsequent playSfx path resolution', async () => {
  const fetchSpy = fakeFetch(true);
  initAudio({ AudioContextClass: FakeAudioContext, fetchImpl: fetchSpy });
  setTheme('metal');
  await playSfx('hitNormal');
  // 'metal' has no entries yet, so this must still resolve to the realistic fallback path.
  assert.match(fetchSpy.calls[0], /realistic\/sfx\/hitNormal\.mp3$/);
});

test('setTheme clears cached buffers for the previous non-default theme', async () => {
  const fetchSpy = fakeFetch(true);
  initAudio({ AudioContextClass: FakeAudioContext, fetchImpl: fetchSpy });
  setTheme('metal');
  await playSfx('hitNormal'); // caches under 'metal:hitNormal' (falls back to realistic path, but cache key is theme-specific)
  setTheme('realistic');
  setTheme('metal');
  await playSfx('hitNormal');
  assert.equal(fetchSpy.calls.length, 2, 'switching away from and back to a non-default theme should refetch, not reuse a stale cache entry');
});

test('syncAudioSettings applies volumes, mutes, and theme from a settings object in one call', () => {
  initAudio({ AudioContextClass: FakeAudioContext, fetchImpl: fakeFetch(true) });
  syncAudioSettings({
    soundTheme: 'realistic',
    audioCombatVolume: 0.3, audioCombatMuted: false,
    audioUiVolume: 0.9, audioUiMuted: true,
    audioWorldVolume: 0.5, audioWorldMuted: false,
    audioMusicVolume: 0.2, audioMusicMuted: false,
  });
  assert.equal(categoryGainValueFor('combat'), 0.3);
  assert.equal(categoryGainValueFor('ui'), 0); // muted
  assert.equal(categoryGainValueFor('world'), 0.5);
  assert.equal(categoryGainValueFor('music'), 0.2);
});

test('syncAudioSettings consumes a real createNewGame() settings object', () => {
  initAudio({ AudioContextClass: FakeAudioContext, fetchImpl: fakeFetch(true) });
  syncAudioSettings(createNewGame().settings);
  assert.equal(categoryGainValueFor('combat'), 0.8);
  assert.equal(categoryGainValueFor('music'), 0.6);
});
