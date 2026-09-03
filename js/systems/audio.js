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
