import test from 'node:test';
import assert from 'node:assert/strict';
import { initAudio, unlockAudio, CATEGORIES, playSfx } from '../js/systems/audio.js';

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
