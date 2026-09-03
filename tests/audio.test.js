import test from 'node:test';
import assert from 'node:assert/strict';
import { initAudio, unlockAudio, CATEGORIES } from '../js/systems/audio.js';

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
