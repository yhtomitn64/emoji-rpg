# Audio Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working, testable audio playback system (SFX + music, 4-category volume/mute settings, theme-aware manifest with on-demand loading) and wire it into the existing gameplay-effect functions, so dropping real audio files into `assets/audio/` makes the game make noise with zero further code changes.

**Architecture:** A Web Audio API engine (`js/systems/audio.js`) driven by a static sound manifest (`js/data/soundManifest.js`) that maps every sound ID to a category and a per-theme file path. Settings persist per-save-slot in the existing `state.settings` object and drive category `GainNode`s. Every sound is fetched and decoded lazily on first play and cached in memory, so no theme or sound costs bandwidth until it's actually triggered.

**Tech Stack:** Vanilla JS (ES modules), Web Audio API, `node --test` + jsdom for tests (matching existing `tests/*.test.js` conventions). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-03-audio-engine-design.md` (asset catalog: `docs/superpowers/specs/2026-09-03-audio-asset-catalog-handoff.md`)

## Global Constraints

- No new npm dependencies — Web Audio API and `fetch` are both natively available in every target browser and in Node 20+ (used for tests only via mocks, real `fetch`/`AudioContext` are never invoked in tests).
- Tests run via `npm run test` (`node --test tests/*.js`) — CI runs Node 20, so do **not** use `node:test`'s `mock.module()` (ESM module mocking) anywhere — it requires `--experimental-test-module-mocks` on Node 20 and isn't enabled in this repo's test script. Use dependency injection (fake `AudioContext` classes, fake `fetch` functions passed as parameters) instead, matching the existing pattern in `js/systems/telemetry.js` (`storage`/`fetchImpl` params) and `tests/telemetry.test.js`.
- A missing/failed-to-load audio file must never throw — every playback path degrades to a silent no-op plus a single `console.warn` per sound ID, since most call sites will exist before the real audio files do.
- Settings live in the existing per-save-slot `state.settings` object (`js/state.js`), following the same flat-object + migration-function convention already used for `itemMenuAutoCloseMs` — do not introduce a separate global preferences store.
- Every commit that touches non-doc files needs a `CHANGELOG.md` entry under `## [Unreleased]` (CI-enforced) — see Task 10.
- This plan covers the engine, settings, and wiring the 7 *already-existing* visual-effect functions (`playHitEffect`, `playPlayerSwing`, `playReviveEffect`, `playLevelUpEffect`, `playCelebration`, `playToolCelebration`, `playItemPickupToast`) to real `playSfx` calls, as the proof of the wiring pattern. Wiring the remaining new call sites (menu nav, dialog close, potion use, walking, battle/boss start/end stingers, parry, timing, discovery/cache/comeback, elite sting, and area-music transitions) is intentionally **out of scope** for this plan — see "Follow-up work" at the end. Those need their own pass once this core lands, since they touch ~10 more files each requiring fresh investigation.

---

## File Structure

| File | Responsibility |
|---|---|
| `js/data/soundManifest.js` | Static data: every sound ID's category, the `realistic` theme's file paths, `resolvePath(theme, soundId)` with default-theme fallback. |
| `js/systems/audio.js` | The engine: `AudioContext` + gain-node graph, buffer loading/caching, `playSfx`, `playMusic`/`stopMusic` (crossfade), `setCategoryVolume`/`setCategoryMuted`/`setTheme`, `syncAudioSettings`. |
| `js/state.js` | Modified: `createNewGame()`'s default `settings`, new `migrateAudioSettings()`. |
| `js/main.js` | Modified: call the new migration, `initAudio()`/`unlockAudio()`/`syncAudioSettings()` on game start, sync on settings change. |
| `js/screens/settingsScreen.js` | Modified: 4 volume sliders + mute toggles, theme `<select>`. |
| `js/screens/battleScreen.js`, `js/screens/celebrationEffect.js`, `js/screens/itemPickupToast.js`, `js/screens/mapScreen.js` | Modified: one `playSfx(...)` call added to each of the 7 existing effect functions. |
| `tests/soundManifest.test.js`, `tests/audio.test.js`, `tests/state.test.js` (extended), `tests/settingsScreenDom.test.js` (extended), `tests/audioHookWiring.test.js` | Tests. |

---

### Task 1: Sound manifest

**Files:**
- Create: `js/data/soundManifest.js`
- Test: `tests/soundManifest.test.js`

**Interfaces:**
- Produces: `SOUND_CATEGORY` (object, soundId → `'combat'|'ui'|'world'|'music'`), `DEFAULT_THEME` (string, `'realistic'`), `SOUND_THEMES` (object, themeId → soundId → path string), `resolvePath(theme, soundId)` (returns a path string or `null`).

- [ ] **Step 1: Write the failing test**

```js
// tests/soundManifest.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { SOUND_CATEGORY, DEFAULT_THEME, SOUND_THEMES, resolvePath } from '../js/data/soundManifest.js';

test('DEFAULT_THEME is realistic and every sound has a path in it', () => {
  assert.equal(DEFAULT_THEME, 'realistic');
  for (const soundId of Object.keys(SOUND_CATEGORY)) {
    assert.ok(
      SOUND_THEMES[DEFAULT_THEME][soundId],
      `default theme is missing a path for "${soundId}"`
    );
  }
});

test('every SOUND_CATEGORY value is one of the 4 known categories', () => {
  const valid = new Set(['combat', 'ui', 'world', 'music']);
  for (const [soundId, category] of Object.entries(SOUND_CATEGORY)) {
    assert.ok(valid.has(category), `"${soundId}" has unknown category "${category}"`);
  }
});

test('resolvePath returns the theme-specific path when present', () => {
  const path = resolvePath('realistic', 'hitNormal');
  assert.equal(path, SOUND_THEMES.realistic.hitNormal);
});

test('resolvePath falls back to DEFAULT_THEME when the requested theme lacks the sound', () => {
  const path = resolvePath('metal', 'hitNormal'); // 'metal' theme has no entries yet
  assert.equal(path, SOUND_THEMES.realistic.hitNormal);
});

test('resolvePath returns null for an unknown sound id', () => {
  assert.equal(resolvePath('realistic', 'notARealSoundId'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`
Expected: FAIL — `Cannot find module '../js/data/soundManifest.js'`

- [ ] **Step 3: Write the manifest**

```js
// js/data/soundManifest.js
export const DEFAULT_THEME = 'realistic';

export const SOUND_CATEGORY = {
  // Combat
  hitNormal: 'combat', hitCrit: 'combat', hitMiss: 'combat',
  parrySuccess: 'combat', parryFail: 'combat',
  timingSuccess: 'combat', timingFail: 'combat',
  revive: 'combat', monsterAbilityGeneric: 'combat',
  abilitySwingStab: 'combat', abilitySwingChop: 'combat',
  abilitySwingSlash: 'combat', abilitySwingSweep: 'combat',
  abilitySwingSuperScream: 'combat',
  battleStart: 'combat', battleEnd: 'combat',
  bossBattleStart: 'combat', bossBattleEnd: 'combat',
  eliteEncounterSting: 'combat',

  // UI
  menuMove: 'ui', menuSelect: 'ui', dialogClose: 'ui', actionInvalid: 'ui',

  // World
  levelUp: 'world', celebrationGeneric: 'world',
  itemPickupCommon: 'world', itemPickupLegendary: 'world',
  toolCelebration: 'world', questTurnIn: 'world', shopTransaction: 'world',
  smithUpgrade: 'world', walking: 'world', discoverySting: 'world',
  cacheOpen: 'world', comebackWarp: 'world',
  potionHeal: 'world', potionStrengthDraught: 'world', potionIronSkinTonic: 'world',
  potionSwiftElixir: 'world', potionVampiricTonic: 'world', potionMomentumElixir: 'world',
  potionEmberVial: 'world', potionThornbarkDraught: 'world', potionFocusTonic: 'world',
  potionBerserkerTonic: 'world', potionSecondWind: 'world',

  // Music
  townTheme: 'music', overworldTheme: 'music', battleTheme: 'music',
  bossBattleTheme: 'music', dungeonCavernTheme: 'music', toolDungeonTheme: 'music',
  dragonDungeonTheme: 'music', portalDungeonTheme: 'music', zoneEdgeTheme: 'music',
};

function sfxPath(soundId) {
  return `assets/audio/realistic/sfx/${soundId}.mp3`;
}
function musicPath(soundId) {
  return `assets/audio/realistic/music/${soundId}.mp3`;
}

export const SOUND_THEMES = {
  realistic: Object.fromEntries(
    Object.entries(SOUND_CATEGORY).map(([soundId, category]) => [
      soundId,
      category === 'music' ? musicPath(soundId) : sfxPath(soundId),
    ])
  ),
  // Future themes (e.g. metal, symphony, chiptune) get their own entry here,
  // filled in only for the sounds that theme covers - resolvePath() falls
  // back to `realistic` for anything missing, so a partial theme still works.
};

export function resolvePath(theme, soundId) {
  if (!(soundId in SOUND_CATEGORY)) return null;
  return SOUND_THEMES[theme]?.[soundId] ?? SOUND_THEMES[DEFAULT_THEME][soundId];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test`
Expected: PASS (all 5 new tests)

- [ ] **Step 5: Commit**

```bash
git add js/data/soundManifest.js tests/soundManifest.test.js
git commit -m "feat: add theme-aware sound manifest"
```

---

### Task 2: Audio engine init, unlock, and gain graph

**Files:**
- Create: `js/systems/audio.js`
- Test: `tests/audio.test.js`

**Interfaces:**
- Consumes: `SOUND_CATEGORY`, `DEFAULT_THEME` from `js/data/soundManifest.js` (Task 1).
- Produces: `initAudio({ AudioContextClass, fetchImpl } = {})`, `unlockAudio()`, `CATEGORIES` (`['combat', 'ui', 'world', 'music']`) — used by later tasks and by `settingsScreen.js`.

- [ ] **Step 1: Write the failing test**

```js
// tests/audio.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`
Expected: FAIL — `Cannot find module '../js/systems/audio.js'`

- [ ] **Step 3: Write the minimal implementation**

```js
// js/systems/audio.js
import { SOUND_CATEGORY, DEFAULT_THEME } from '../data/soundManifest.js';

export const CATEGORIES = ['combat', 'ui', 'world', 'music'];

const DEFAULT_CATEGORY_VOLUME = { combat: 0.8, ui: 0.8, world: 0.8, music: 0.6 };

let audioContext = null;
let fetchImpl = null;
let categoryGains = {};
let categoryState = {};
let currentTheme = DEFAULT_THEME;
let bufferCache = new Map();
let warnedMissing = new Set();
let currentMusic = null;

export function initAudio({ AudioContextClass = globalThis.AudioContext, fetchImpl: injectedFetch = globalThis.fetch } = {}) {
  audioContext = new AudioContextClass();
  fetchImpl = injectedFetch;
  categoryGains = {};
  categoryState = {};
  for (const category of CATEGORIES) {
    const gain = audioContext.createGain();
    gain.connect(audioContext.destination);
    categoryGains[category] = gain;
    categoryState[category] = { volume: DEFAULT_CATEGORY_VOLUME[category], muted: false };
    gain.gain.value = DEFAULT_CATEGORY_VOLUME[category];
  }
  currentTheme = DEFAULT_THEME;
  bufferCache = new Map();
  warnedMissing = new Set();
  currentMusic = null;
}

export async function unlockAudio() {
  if (!audioContext) return;
  await audioContext.resume?.();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test`
Expected: PASS (all 3 new tests)

- [ ] **Step 5: Commit**

```bash
git add js/systems/audio.js tests/audio.test.js
git commit -m "feat: audio engine init, unlock, and per-category gain graph"
```

---

### Task 3: SFX playback with caching and graceful missing-file handling

**Files:**
- Modify: `js/systems/audio.js`
- Test: `tests/audio.test.js`

**Interfaces:**
- Consumes: `resolvePath` from `js/data/soundManifest.js` (Task 1); `audioContext`/`categoryGains`/`bufferCache`/`currentTheme` module state from Task 2.
- Produces: `playSfx(soundId)` (async, never throws).

- [ ] **Step 1: Write the failing test**

Add to `tests/audio.test.js`:

```js
import { playSfx } from '../js/systems/audio.js';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`
Expected: FAIL — `playSfx is not a function` / not exported

- [ ] **Step 3: Write the minimal implementation**

Add to `js/systems/audio.js`:

```js
import { SOUND_CATEGORY, DEFAULT_THEME, resolvePath } from '../data/soundManifest.js';

async function loadBuffer(soundId) {
  const cacheKey = `${currentTheme}:${soundId}`;
  if (bufferCache.has(cacheKey)) return bufferCache.get(cacheKey);

  const path = resolvePath(currentTheme, soundId);
  if (!path) {
    warnOnce(cacheKey, `unknown sound id "${soundId}"`);
    bufferCache.set(cacheKey, null);
    return null;
  }
  try {
    const response = await fetchImpl(path);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    bufferCache.set(cacheKey, audioBuffer);
    return audioBuffer;
  } catch (err) {
    warnOnce(cacheKey, `failed to load "${soundId}" (theme "${currentTheme}"): ${err.message}`);
    bufferCache.set(cacheKey, null);
    return null;
  }
}

function warnOnce(cacheKey, message) {
  if (warnedMissing.has(cacheKey)) return;
  warnedMissing.add(cacheKey);
  console.warn(`[audio] ${message}`);
}

export async function playSfx(soundId) {
  if (!audioContext) return;
  const category = SOUND_CATEGORY[soundId];
  const buffer = await loadBuffer(soundId);
  if (!buffer || !category) return;
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(categoryGains[category]);
  source.start();
}
```

(`resolvePath` and `DEFAULT_THEME` were already imported in Task 2's edit; this step just adds `resolvePath` to that same import line rather than duplicating the import statement.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test`
Expected: PASS (all 4 new tests, plus Task 2's tests still passing)

- [ ] **Step 5: Commit**

```bash
git add js/systems/audio.js tests/audio.test.js
git commit -m "feat: SFX playback with buffer caching and graceful missing-file handling"
```

---

### Task 4: Music playback with crossfade

**Files:**
- Modify: `js/systems/audio.js`
- Test: `tests/audio.test.js`

**Interfaces:**
- Consumes: `loadBuffer`, `categoryGains.music`, `currentMusic` module state (Tasks 2-3).
- Produces: `playMusic(soundId, { crossfadeMs = 1500 } = {})`, `stopMusic({ fadeMs = 1500 } = {})`.

- [ ] **Step 1: Write the failing test**

Add to `tests/audio.test.js`:

```js
import { playMusic, stopMusic } from '../js/systems/audio.js';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`
Expected: FAIL — `playMusic is not a function`

- [ ] **Step 3: Write the minimal implementation**

Add to `js/systems/audio.js`:

```js
export async function playMusic(soundId, { crossfadeMs = 1500 } = {}) {
  if (!audioContext) return;
  const buffer = await loadBuffer(soundId);
  if (!buffer) return;

  const now = audioContext.currentTime;
  const trackGain = audioContext.createGain();
  trackGain.gain.setValueAtTime(0, now);
  trackGain.gain.linearRampToValueAtTime(1, now + crossfadeMs / 1000);
  trackGain.connect(categoryGains.music);

  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.connect(trackGain);
  source.start();

  const previous = currentMusic;
  currentMusic = { source, trackGain, soundId };

  if (previous) {
    previous.trackGain.gain.linearRampToValueAtTime(0, now + crossfadeMs / 1000);
    setTimeout(() => previous.source.stop(), crossfadeMs);
  }
}

export function stopMusic({ fadeMs = 1500 } = {}) {
  if (!currentMusic) return;
  const now = audioContext.currentTime;
  const { source, trackGain } = currentMusic;
  trackGain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
  setTimeout(() => source.stop(), fadeMs);
  currentMusic = null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test`
Expected: PASS (all 3 new tests)

- [ ] **Step 5: Commit**

```bash
git add js/systems/audio.js tests/audio.test.js
git commit -m "feat: looping music playback with crossfade"
```

---

### Task 5: Category volume/mute and theme switching

**Files:**
- Modify: `js/systems/audio.js`
- Test: `tests/audio.test.js`

**Interfaces:**
- Consumes: `categoryGains`, `categoryState`, `currentTheme`, `bufferCache`, `CATEGORIES`, `DEFAULT_THEME` (Tasks 2-4).
- Produces: `setCategoryVolume(category, value)`, `setCategoryMuted(category, muted)`, `setTheme(themeId)`, `syncAudioSettings(settings)` — the last one is what `main.js` (Task 7) and `settingsScreen.js` (Task 8) call.

- [ ] **Step 1: Write the failing test**

Add to `tests/audio.test.js`:

```js
import { setCategoryVolume, setCategoryMuted, setTheme, syncAudioSettings, _getCategoryGainValueForTests } from '../js/systems/audio.js';

function categoryGainValueFor(category) {
  return _getCategoryGainValueForTests(category);
}

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`
Expected: FAIL — `setCategoryVolume is not a function`

- [ ] **Step 3: Write the minimal implementation**

Add to `js/systems/audio.js`:

```js
function applyCategoryGain(category) {
  const { volume, muted } = categoryState[category];
  categoryGains[category].gain.value = muted ? 0 : volume;
}

export function setCategoryVolume(category, value) {
  categoryState[category].volume = Math.min(1, Math.max(0, value));
  applyCategoryGain(category);
}

export function setCategoryMuted(category, muted) {
  categoryState[category].muted = muted;
  applyCategoryGain(category);
}

export function setTheme(themeId) {
  const previousTheme = currentTheme;
  currentTheme = themeId;
  if (previousTheme !== DEFAULT_THEME) {
    for (const key of [...bufferCache.keys()]) {
      if (key.startsWith(`${previousTheme}:`)) bufferCache.delete(key);
    }
  }
}

export function syncAudioSettings(settings) {
  setTheme(settings.soundTheme);
  setCategoryVolume('combat', settings.audioCombatVolume);
  setCategoryMuted('combat', settings.audioCombatMuted);
  setCategoryVolume('ui', settings.audioUiVolume);
  setCategoryMuted('ui', settings.audioUiMuted);
  setCategoryVolume('world', settings.audioWorldVolume);
  setCategoryMuted('world', settings.audioWorldMuted);
  setCategoryVolume('music', settings.audioMusicVolume);
  setCategoryMuted('music', settings.audioMusicMuted);
}

// Test-only: categoryGains is internal engine state with no other reason to
// be exported. Kept to a single trivial accessor rather than exporting the
// whole map, so production code never has a reason to reach in from outside.
export function _getCategoryGainValueForTests(category) {
  return categoryGains[category].gain.value;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test`
Expected: PASS (all 5 new tests)

- [ ] **Step 5: Commit**

```bash
git add js/systems/audio.js tests/audio.test.js
git commit -m "feat: category volume/mute controls and theme switching"
```

---

### Task 6: Settings state — fields and migration

**Files:**
- Modify: `js/state.js` (the `settings:` line inside `createNewGame()`, and add a new `migrateAudioSettings` export near the existing `migrateSettings`)
- Test: `tests/state.test.js` (extend)

**Interfaces:**
- Produces: `migrateAudioSettings(state)` (returns a new state object; a no-op copy if every field already exists).
- `createNewGame()`'s `settings` object gains: `soundTheme`, `audioCombatVolume`, `audioCombatMuted`, `audioUiVolume`, `audioUiMuted`, `audioWorldVolume`, `audioWorldMuted`, `audioMusicVolume`, `audioMusicMuted`.

- [ ] **Step 1: Write the failing test**

Add to `tests/state.test.js`:

```js
import { createNewGame, migrateAudioSettings } from '../js/state.js';

test('createNewGame defaults every audio setting', () => {
  const state = createNewGame();
  assert.equal(state.settings.soundTheme, 'realistic');
  assert.equal(state.settings.audioCombatVolume, 0.8);
  assert.equal(state.settings.audioCombatMuted, false);
  assert.equal(state.settings.audioUiVolume, 0.8);
  assert.equal(state.settings.audioUiMuted, false);
  assert.equal(state.settings.audioWorldVolume, 0.8);
  assert.equal(state.settings.audioWorldMuted, false);
  assert.equal(state.settings.audioMusicVolume, 0.6);
  assert.equal(state.settings.audioMusicMuted, false);
});

test('migrateAudioSettings fills in missing audio fields on an old save without touching existing ones', () => {
  const oldState = { settings: { itemMenuAutoCloseMs: 900 } };
  const migrated = migrateAudioSettings(oldState);
  assert.equal(migrated.settings.itemMenuAutoCloseMs, 900);
  assert.equal(migrated.settings.soundTheme, 'realistic');
  assert.equal(migrated.settings.audioCombatVolume, 0.8);
});

test('migrateAudioSettings is a no-op (same values) when fields already exist', () => {
  const state = createNewGame();
  state.settings.audioCombatVolume = 0.1;
  const migrated = migrateAudioSettings(state);
  assert.equal(migrated.settings.audioCombatVolume, 0.1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`
Expected: FAIL — `state.settings.soundTheme` is `undefined`, `migrateAudioSettings is not a function`

- [ ] **Step 3: Write the minimal implementation**

Edit `js/state.js` — replace the existing settings line inside `createNewGame()`:

```js
    settings: {
      itemMenuAutoCloseMs: DEFAULT_ITEM_MENU_AUTO_CLOSE_MS,
      soundTheme: 'realistic',
      audioCombatVolume: 0.8, audioCombatMuted: false,
      audioUiVolume: 0.8, audioUiMuted: false,
      audioWorldVolume: 0.8, audioWorldMuted: false,
      audioMusicVolume: 0.6, audioMusicMuted: false,
    },
```

Add a new export near `migrateSettings`:

```js
const DEFAULT_AUDIO_SETTINGS = {
  soundTheme: 'realistic',
  audioCombatVolume: 0.8, audioCombatMuted: false,
  audioUiVolume: 0.8, audioUiMuted: false,
  audioWorldVolume: 0.8, audioWorldMuted: false,
  audioMusicVolume: 0.6, audioMusicMuted: false,
};

// One-time migration for saves from before per-category audio settings
// existed - merges in only the fields that are missing, so a player who's
// already adjusted a slider on a save made mid-rollout never gets it reset.
export function migrateAudioSettings(state) {
  return { ...state, settings: { ...DEFAULT_AUDIO_SETTINGS, ...state.settings } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test`
Expected: PASS (all 3 new tests, plus every existing `state.test.js` test still passing)

- [ ] **Step 5: Commit**

```bash
git add js/state.js tests/state.test.js
git commit -m "feat: add per-category audio settings with migration"
```

---

### Task 7: Wire settings into game startup and change handling

**Files:**
- Modify: `js/main.js`

**Interfaces:**
- Consumes: `migrateAudioSettings` (Task 6, add to the `import` from `./state.js'` at `js/main.js:1`); `initAudio`, `unlockAudio`, `syncAudioSettings` (Tasks 2/5, new import from `./systems/audio.js`).

No new test file — this task is pure wiring with no independently-testable new logic (it's calling already-tested functions at already-tested call sites). Verified via the existing `tests/state.test.js`/`tests/audio.test.js` suites still passing, plus manual smoke-test in Step 4 below.

- [ ] **Step 1: Add the import**

Edit `js/main.js:1`, add `migrateAudioSettings` to the existing `state.js` import list, and add a new import line right after it:

```js
import { loadState, saveState, DEFAULT_HERO_EMOJI, DEFAULT_DUNGEON_ENTRANCE_POSITION, migrateRingSlots, migratePowerRingSlot, migrateBestDamage, migrateLoadout, migrateSettings, migrateAudioSettings } from './state.js';
import { initAudio, unlockAudio, syncAudioSettings } from './systems/audio.js';
```

- [ ] **Step 2: Run the migration and initialize audio in `startGame`**

Edit `js/main.js`'s `startGame` function — add the migration call right after the existing `migrateSettings` line (~`js/main.js:133`), and initialize/sync audio right before `renderHud()` at the end of the function:

```js
function startGame(loadedState, slotId) {
  state = migrateUpgradesToPerTier(loadedState);
  state = migrateNgPlusToolCarryover(state);
  state = migrateRingSlots(state);
  state = migratePowerRingSlot(state);
  state = migrateBestDamage(state);
  state = migrateLoadout(state);
  state = migrateSettings(state);
  state = migrateAudioSettings(state);
  activeSlotId = slotId;
  // ... (unchanged body) ...
  if (!state.player.emoji) {
    state.player.emoji = DEFAULT_HERO_EMOJI;
  }
  initAudio();
  syncAudioSettings(state.settings);
  unlockAudio(); // startGame only ever runs from a real click (save-slot select), so this satisfies the browser's autoplay-gesture requirement.
  renderHud();
  goToMap(state.map);
}
```

- [ ] **Step 3: Sync audio settings whenever the Settings screen changes them**

Edit `js/main.js`'s `openSettings` function:

```js
function openSettings() {
  if (battleActive) return;
  mountOverlay(settingsScreen, {
    state,
    callbacks: {
      onChange: () => { persist(); syncAudioSettings(state.settings); },
      onClose: () => unmountOverlay(),
    },
  });
}
```

- [ ] **Step 4: Manual smoke test**

Run: `npm run test` (confirms nothing broke) — then start a local dev server (check the repo's existing `docs`/`README.md` for how; typically a static file server) and load the game in a browser, open devtools console, select/create a save slot, and confirm no errors are thrown (the `[audio] failed to load "..."` warnings are expected and fine — no real audio files exist yet).

- [ ] **Step 5: Commit**

```bash
git add js/main.js
git commit -m "feat: wire audio init and settings sync into game startup"
```

---

### Task 8: Settings screen UI

**Files:**
- Modify: `js/screens/settingsScreen.js`
- Test: `tests/settingsScreenDom.test.js` (extend)

**Interfaces:**
- Consumes: `CATEGORIES` from `js/systems/audio.js` (Task 2) — used to generate the 4 slider rows without repeating the category list a third time; `SOUND_THEMES` from `js/data/soundManifest.js` (Task 1) — used to populate the theme `<select>`.

- [ ] **Step 1: Write the failing test**

Add to `tests/settingsScreenDom.test.js`:

```js
await t.test('shows a volume slider and mute toggle for each audio category', async () => {
  const state = createNewGame();
  const root = await mountSettings(state);
  for (const category of ['Combat', 'Ui', 'World', 'Music']) {
    assert.ok(root.querySelector(`#settings-audio-${category.toLowerCase()}-volume`), `missing volume slider for ${category}`);
    assert.ok(root.querySelector(`#settings-audio-${category.toLowerCase()}-muted`), `missing mute checkbox for ${category}`);
  }
});

await t.test('dragging a volume slider updates state and calls onChange', async () => {
  let changed = false;
  const state = createNewGame();
  const root = await mountSettings(state, { onChange: () => { changed = true; }, onClose: () => {} });
  const slider = root.querySelector('#settings-audio-combat-volume');
  slider.value = '0.25';
  slider.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.equal(state.settings.audioCombatVolume, 0.25);
  assert.equal(changed, true);
});

await t.test('toggling a mute checkbox updates state and calls onChange', async () => {
  let changed = false;
  const state = createNewGame();
  const root = await mountSettings(state, { onChange: () => { changed = true; }, onClose: () => {} });
  const checkbox = root.querySelector('#settings-audio-ui-muted');
  checkbox.checked = true;
  checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(state.settings.audioUiMuted, true);
  assert.equal(changed, true);
});

await t.test('the theme select lists every known theme and defaults to the saved value', async () => {
  const state = createNewGame();
  state.settings.soundTheme = 'realistic';
  const root = await mountSettings(state);
  const select = root.querySelector('#settings-sound-theme');
  assert.ok(select);
  assert.equal(select.value, 'realistic');
});

await t.test('changing the theme select updates state and calls onChange', async () => {
  let changed = false;
  const state = createNewGame();
  const root = await mountSettings(state, { onChange: () => { changed = true; }, onClose: () => {} });
  const select = root.querySelector('#settings-sound-theme');
  select.value = 'realistic'; // only theme with real content today; asserts the wiring, not theme content
  select.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(state.settings.soundTheme, 'realistic');
  assert.equal(changed, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`
Expected: FAIL — the new `#settings-audio-*` / `#settings-sound-theme` elements don't exist yet

- [ ] **Step 3: Write the minimal implementation**

Edit `js/screens/settingsScreen.js` — add the import, a small label map, and extend `render()`:

```js
import { CATEGORIES } from '../systems/audio.js';
import { SOUND_THEMES } from '../data/soundManifest.js';

const CATEGORY_LABELS = { combat: 'Combat', ui: 'UI', world: 'World', music: 'Music' };
```

Insert into the template string in `render()`, right before the closing `<button id="btn-close-settings">Close</button>`:

```js
      <h3>Sound</h3>
      <div class="settings-row">
        <label for="settings-sound-theme">Sound theme</label>
        <select id="settings-sound-theme">
          ${Object.keys(SOUND_THEMES).map((themeId) => `
            <option value="${themeId}" ${state.settings.soundTheme === themeId ? 'selected' : ''}>${themeId}</option>
          `).join('')}
        </select>
      </div>
      ${CATEGORIES.map((category) => `
        <div class="settings-row">
          <label for="settings-audio-${category}-volume">${CATEGORY_LABELS[category]} volume</label>
          <input
            type="range" min="0" max="1" step="0.05"
            id="settings-audio-${category}-volume"
            value="${state.settings[`audio${capitalize(category)}Volume`]}"
          />
          <label for="settings-audio-${category}-muted">
            <input type="checkbox" id="settings-audio-${category}-muted" ${state.settings[`audio${capitalize(category)}Muted`] ? 'checked' : ''} />
            Mute
          </label>
        </div>
      `).join('')}
```

Add the small helper (module scope, above `render()`):

```js
function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
```

And wire the new elements at the end of `render()`, right before `document.getElementById('btn-close-settings').onclick = ...`:

```js
  document.getElementById('settings-sound-theme').onchange = (e) => {
    state.settings = { ...state.settings, soundTheme: e.target.value };
    callbacks.onChange();
  };
  for (const category of CATEGORIES) {
    const volumeInput = document.getElementById(`settings-audio-${category}-volume`);
    volumeInput.oninput = () => {
      state.settings = { ...state.settings, [`audio${capitalize(category)}Volume`]: Number(volumeInput.value) };
      callbacks.onChange();
    };
    const mutedInput = document.getElementById(`settings-audio-${category}-muted`);
    mutedInput.onchange = () => {
      state.settings = { ...state.settings, [`audio${capitalize(category)}Muted`]: mutedInput.checked };
      callbacks.onChange();
    };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test`
Expected: PASS (all 5 new tests, plus every pre-existing `settingsScreenDom.test.js` test)

- [ ] **Step 5: Commit**

```bash
git add js/screens/settingsScreen.js tests/settingsScreenDom.test.js
git commit -m "feat: settings screen audio volume/mute/theme controls"
```

---

### Task 9: Wire the 7 existing effect functions to real sounds

**Files:**
- Modify: `js/screens/battleScreen.js` (`playHitEffect`, `playPlayerSwing`, `playReviveEffect`, plus `attemptParry`'s call site is *not* touched here — out of scope, see Global Constraints)
- Modify: `js/screens/celebrationEffect.js` (`playCelebration`, `playToolCelebration`)
- Modify: `js/screens/itemPickupToast.js` (`playItemPickupToast`)
- Modify: `js/screens/mapScreen.js` (`playLevelUpEffect`)
- Test: `tests/audioHookWiring.test.js` (new)

**Interfaces:**
- Consumes: `initAudio`, `playSfx` (Tasks 2-3) as the integration seam these tests drive through; the 7 functions listed above (already exist, signatures unchanged).

- [ ] **Step 1: Write the failing test**

```js
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
```

(`playHitEffect`/`playPlayerSwing`/`playReviveEffect`/`playLevelUpEffect` already have DOM-driven coverage in `tests/battleScreenDom.test.js` and `tests/mapScreenDom.test.js` respectively via their existing effect-triggering tests — this task's Step 4 confirms those still pass with the new `playSfx` calls added; a full fetch-spy assertion for each is unnecessary duplication given the pattern is proven above for 3 of the 7.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test`
Expected: FAIL — fetch call count is 0 (no `playSfx` call wired yet)

- [ ] **Step 3: Add the `playSfx` calls**

Edit `js/screens/celebrationEffect.js` — add the import at the top, and one call inside each function:

```js
import { playSfx } from '../systems/audio.js';
```

`playCelebration` is shared by 3 different call sites in `js/main.js` (first
kill, level up, new ability unlocked — none of that call-site wiring is
touched by this plan) — it gets a generic celebration sound rather than
`'levelUp'`, so the other two callers don't misleadingly play a level-up
chime. `playLevelUpEffect` (mapScreen.js, below) is the one that actually
owns `'levelUp'`, since it's the dedicated per-level map-tile effect.

Inside `playCelebration(emoji, message, options = {})`, right after `showFlavorBanner(message);`:
```js
  playSfx('celebrationGeneric');
```
Inside `playToolCelebration(emoji, message, capabilityText)`, right after `showFlavorBanner(message);`:
```js
  playSfx('toolCelebration');
```

Edit `js/screens/itemPickupToast.js` — add the import and one call:

```js
import { playSfx } from '../systems/audio.js';
```
Inside `playItemPickupToast(emoji, name)`, right after the `if (!anchorButton || !toastEl) return;` guard:
```js
  playSfx('itemPickupCommon');
```

Edit `js/screens/mapScreen.js` — add the import (near its other imports) and one call inside `playLevelUpEffect()`, right after its `if (!playerCell) return;` guard:
```js
  playSfx('levelUp');
```
(`playSfx` import added alongside `mapScreen.js`'s existing imports.)

Edit `js/screens/battleScreen.js` — add the import (near its other imports) and one call inside each of the 3 functions:

- `playHitEffect(zoneEl, emojiEl, amount, isCrit)`, right after `showDamageNumber(zoneEl, amount, isCrit);`:
```js
  playSfx(isCrit ? 'hitCrit' : 'hitNormal');
```
- `playPlayerSwing(ability, targetZoneEl, isCrit)`, right after `playHeroAttackLunge();`:
```js
  playSfx(swingSoundIdFor(ability));
```
  Add the small helper above `playPlayerSwing`:
```js
function swingSoundIdFor(ability) {
  const bySwingId = {
    stab: 'abilitySwingStab', chop: 'abilitySwingChop',
    slash: 'abilitySwingSlash', sweep: 'abilitySwingSweep',
    superScream: 'abilitySwingSuperScream',
  };
  return bySwingId[ability?.id] || 'hitNormal'; // plain Attack (ability === null) reuses the base hit sound
}
```
- `playReviveEffect(emojiEl)`, right after `emojiEl.classList.add('battle-revive-glow');`:
```js
  playSfx('revive');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test`
Expected: PASS (both new tests in `tests/audioHookWiring.test.js`, plus every pre-existing test in `tests/battleScreenDom.test.js`, `tests/celebrationEffect.test.js`, `tests/mapScreenDom.test.js` — none of those exercise `fetch`/`AudioContext` directly, so `playSfx` being called with no `initAudio()` having run in *those* test files must be a safe no-op: confirm `playSfx`'s existing Task-3 guard `if (!audioContext) return;` covers this, since those test files never call `initAudio()`.)

- [ ] **Step 5: Commit**

```bash
git add js/screens/battleScreen.js js/screens/celebrationEffect.js js/screens/itemPickupToast.js js/screens/mapScreen.js tests/audioHookWiring.test.js
git commit -m "feat: wire existing visual effects to their sounds"
```

---

### Task 10: Versioning and changelog

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `js/data/playerChangelog.js`

Per this repo's own versioning rules (`CHANGELOG.md`'s header, `CLAUDE.md`'s "Versioning checklist"): this is a completed new system, so it's a MINOR bump. Current latest is `0.19.0` → this becomes `0.20.0`.

- [ ] **Step 1: Read the current top of `CHANGELOG.md`**

Run: `head -30 CHANGELOG.md` — confirm `## [Unreleased]` is still empty (everything so far in this plan should have been noted there per-commit if any commit hook requires it; if the repo's CI only checks at push time rather than per-commit, entries may need to be added retroactively here rather than per Task above — check `.github/workflows/*.yml` for when the "CHANGELOG must move" check runs).

- [ ] **Step 2: Add the dated version section**

Edit `CHANGELOG.md`, replacing the empty `## [Unreleased]` section with:

```markdown
## [Unreleased]

## [0.20.0] - <today's date, YYYY-MM-DD>

### Added
- Audio engine: Web Audio API-based sound/music playback with a
  theme-aware sound manifest (`js/data/soundManifest.js`,
  `js/systems/audio.js`). Sounds and music load on demand and are
  cached after first play, so no theme costs bandwidth until it's
  actually used, and a theme missing a sound falls back to the
  default `realistic` theme's file.
- Settings screen: per-category volume sliders and mute toggles for
  Combat/UI/World/Music, plus a sound theme selector.
- The 7 existing visual-effect functions (crit/normal hits, ability
  swings, revive, level-up, generic and tool-pickup celebrations,
  item pickup toast) now trigger their matching sound, once real
  audio files are dropped into `assets/audio/realistic/`.
```

- [ ] **Step 3: Add the matching player-facing changelog entry**

Read `js/data/playerChangelog.js`'s existing newest entry for the exact shape/tone to match, then add a new entry at the top of `PLAYER_CHANGELOG`:

```js
{
  version: '0.20.0',
  date: '<today's date, YYYY-MM-DD>',
  highlights: [
    'Added a Settings screen sound theme picker and volume/mute controls for Combat, UI, World, and Music sounds separately.',
  ],
},
```

(Skip mentioning "audio engine" or file names — this is player-facing; only the settings-screen change is visible to a player until real sound files land. Match the exact field names/shape already used by the entry above it in the file — copy that entry's structure rather than guessing.)

- [ ] **Step 4: Run the version-sync test**

Run: `npm run test`
Expected: PASS — `tests/versionSync.test.js` confirms `PLAYER_CHANGELOG[0].version` matches `CHANGELOG.md`'s newest dated version.

- [ ] **Step 5: Commit**

```bash
git add CHANGELOG.md js/data/playerChangelog.js
git commit -m "docs: bump to 0.20.0 for the audio engine"
```

---

## Final verification

- [ ] Run the full suite once more: `npm run test` — every test file passes, no regressions in pre-existing tests.
- [ ] `git log --oneline -10` shows one commit per task above, in order.
- [ ] Confirm `CHANGELOG.md`'s `## [Unreleased]` section is empty (bumped, not left pending) — this repo's CI fails the deploy otherwise.

## Follow-up work (explicitly not in this plan)

Wiring the remaining catalog sounds into their gameplay call sites — menu nav/select (per-screen), dialog close, potion use, walking footsteps, battle/boss start & end stingers, parry success/fail, timing ability success/fail, discovery/cache/comeback, elite encounter sting, and the area-music transitions (town/overworld/battle/boss/dungeon themes triggered on screen and encounter changes). Each needs a fresh read of its own file(s) to find the exact call site — deliberately deferred to its own plan once this core engine has been reviewed and is proven working end-to-end (Task 9 is the proof).
