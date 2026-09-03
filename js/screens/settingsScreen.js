import { DEFAULT_ITEM_MENU_AUTO_CLOSE_MS } from '../state.js';
import { getBufferAsJsonl } from '../systems/telemetry.js';
import { bindEscapeClose, bindBackdropClose } from './dialogChrome.js';
import { CATEGORIES } from '../systems/audio.js';
import { SOUND_THEMES } from '../data/soundManifest.js';

const ITEM_MENU_AUTO_CLOSE_MIN_MS = 250;
const ITEM_MENU_AUTO_CLOSE_MAX_MS = 5000;

const CATEGORY_LABELS = { combat: 'Combat', ui: 'UI', world: 'World', music: 'Music' };

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

let rootEl = null;
let state = null;
let callbacks = null;
let unbindEscape = null;
let unbindBackdrop = null;

async function copyPlayLog() {
  const jsonl = getBufferAsJsonl();
  const statusEl = document.getElementById('play-log-status');
  const fallbackEl = document.getElementById('play-log-fallback');
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(jsonl);
      fallbackEl.hidden = true;
      statusEl.hidden = false;
      statusEl.textContent = 'Copied!';
      return;
    } catch {
      // Fall through to the textarea fallback below - denied permission
      // behaves the same as no Clipboard API at all.
    }
  }
  fallbackEl.value = jsonl;
  fallbackEl.hidden = false;
  fallbackEl.select();
  statusEl.hidden = true;
}

function render() {
  rootEl.innerHTML = `
    <div class="overlay-panel settings-panel">
      <button class="screen-close-x" id="btn-close-x" aria-label="Close">✕</button>
      <h2>Settings</h2>
      <div class="settings-row">
        <label for="settings-item-menu-auto-close">
          Battle item menu auto-close (ms)
        </label>
        <input
          type="number"
          id="settings-item-menu-auto-close"
          min="${ITEM_MENU_AUTO_CLOSE_MIN_MS}"
          max="${ITEM_MENU_AUTO_CLOSE_MAX_MS}"
          step="50"
          value="${state.settings.itemMenuAutoCloseMs}"
        />
      </div>
      <div class="settings-row settings-play-log">
        <span>Play Log</span>
        <button id="btn-copy-play-log">Copy Play Log</button>
        <span id="play-log-status" hidden></span>
      </div>
      <textarea id="play-log-fallback" readonly hidden></textarea>
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
      <button id="btn-close-settings">Close</button>
    </div>
  `;

  const input = document.getElementById('settings-item-menu-auto-close');
  input.onchange = () => {
    // `Number(input.value) || DEFAULT` would be wrong here - 0 is a valid
    // (if useless) numeric value and is falsy, so that pattern would
    // silently reset it to the default instead of clamping it to the min.
    const raw = Number(input.value);
    const numeric = Number.isNaN(raw) ? DEFAULT_ITEM_MENU_AUTO_CLOSE_MS : raw;
    const clamped = Math.min(ITEM_MENU_AUTO_CLOSE_MAX_MS, Math.max(ITEM_MENU_AUTO_CLOSE_MIN_MS, numeric));
    input.value = clamped;
    state.settings = { ...state.settings, itemMenuAutoCloseMs: clamped };
    callbacks.onChange();
  };
  document.getElementById('btn-copy-play-log').onclick = () => copyPlayLog();
  document.getElementById('settings-sound-theme').onchange = (e) => {
    state.settings = { ...state.settings, soundTheme: e.target.value };
    callbacks.onChange();
  };
  for (const category of CATEGORIES) {
    const volumeInput = document.getElementById(`settings-audio-${category}-volume`);
    volumeInput.onchange = () => {
      state.settings = { ...state.settings, [`audio${capitalize(category)}Volume`]: Number(volumeInput.value) };
      callbacks.onChange();
    };
    const mutedInput = document.getElementById(`settings-audio-${category}-muted`);
    mutedInput.onchange = () => {
      state.settings = { ...state.settings, [`audio${capitalize(category)}Muted`]: mutedInput.checked };
      callbacks.onChange();
    };
  }
  document.getElementById('btn-close-settings').onclick = () => callbacks.onClose();
  document.getElementById('btn-close-x').onclick = () => callbacks.onClose();
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  callbacks = props.callbacks;
  render();
  unbindEscape = bindEscapeClose(() => callbacks.onClose());
  unbindBackdrop = bindBackdropClose(rootEl, () => callbacks.onClose());
}

export function unmount() {
  unbindEscape?.();
  unbindBackdrop?.();
}
