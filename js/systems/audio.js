// js/systems/audio.js
import { SOUND_CATEGORY, DEFAULT_THEME, resolvePaths } from '../data/soundManifest.js';

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

export function initAudio({ AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext, fetchImpl: injectedFetch = globalThis.fetch } = {}) {
  try {
    audioContext = new AudioContextClass();
  } catch (err) {
    audioContext = null;
    console.warn(`[audio] Web Audio unavailable, running silent: ${err?.message}`);
    return;
  }
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
  lastVariant.clear();
  currentMusic = null;
}

export async function unlockAudio() {
  if (!audioContext) return;
  await audioContext.resume?.();
}

async function loadBuffer(soundId, variantIndex = 0) {
  // Variant index is part of the cache key - two takes of the same sound are
  // different files and each needs its own decoded buffer.
  const cacheKey = `${currentTheme}:${soundId}:${variantIndex}`;
  if (bufferCache.has(cacheKey)) return bufferCache.get(cacheKey);

  const path = resolvePaths(currentTheme, soundId)[variantIndex];
  if (!path) {
    warnOnce(cacheKey, `unknown sound id "${soundId}"`);
    const failed = Promise.resolve(null);
    bufferCache.set(cacheKey, failed);
    return failed;
  }
  const loadPromise = (async () => {
    try {
      const response = await fetchImpl(path);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      return await audioContext.decodeAudioData(arrayBuffer);
    } catch (err) {
      warnOnce(cacheKey, `failed to load "${soundId}" (theme "${currentTheme}"): ${err.message}`);
      return null;
    }
  })();
  bufferCache.set(cacheKey, loadPromise);
  return loadPromise;
}

function warnOnce(cacheKey, message) {
  if (warnedMissing.has(cacheKey)) return;
  warnedMissing.add(cacheKey);
  console.warn(`[audio] ${message}`);
}

// Last variant played per sound, so a rotation never repeats back-to-back -
// two identical hits in a row is the exact thing multiple takes exist to
// avoid, and pure random picks that often with only 2-3 takes.
const lastVariant = new Map();

function pickVariant(soundId, count, rng = Math.random) {
  if (count <= 1) return 0;
  const previous = lastVariant.get(soundId);
  let index = Math.floor(rng() * count);
  if (index === previous) index = (index + 1) % count;
  lastVariant.set(soundId, index);
  return index;
}

export async function playSfx(soundId, { rng = Math.random } = {}) {
  if (!audioContext) return;
  const category = SOUND_CATEGORY[soundId];
  const variantCount = resolvePaths(currentTheme, soundId).length;
  const buffer = await loadBuffer(soundId, pickVariant(soundId, variantCount, rng));
  if (!buffer || !category) return;
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  source.connect(categoryGains[category]);
  source.start();
}

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

function applyCategoryGain(category) {
  const { volume, muted } = categoryState[category];
  categoryGains[category].gain.value = muted ? 0 : volume;
}

export function setCategoryVolume(category, value) {
  if (!audioContext) return;
  categoryState[category].volume = Math.min(1, Math.max(0, value));
  applyCategoryGain(category);
}

export function setCategoryMuted(category, muted) {
  if (!audioContext) return;
  categoryState[category].muted = muted;
  applyCategoryGain(category);
}

export function setTheme(themeId) {
  if (themeId === currentTheme) return;
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

// Test-only, same rationale as above: variant rotation can't be exercised
// through playSfx until a sound actually declares multiple takes in
// SOUND_VARIANTS (and has the files on disk to match).
export function _pickVariantForTests(soundId, count, rng) {
  return pickVariant(soundId, count, rng);
}
