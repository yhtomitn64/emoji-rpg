// js/systems/audio.js
import { SOUND_CATEGORY, DEFAULT_THEME, resolvePath } from '../data/soundManifest.js';

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
