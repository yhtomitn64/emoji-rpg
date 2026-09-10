import { DEFAULT_ITEM_MENU_AUTO_CLOSE_MS } from '../state.js';
import { getBufferAsJsonl } from '../systems/telemetry.js';
import { bindEscapeClose, bindBackdropClose } from './dialogChrome.js';
import { CATEGORIES } from '../systems/audio.js';
import { SOUND_THEMES } from '../data/soundManifest.js';
import {
  CODE_TRANSFER_TTL_SECONDS,
  isValidSaveCode,
  startCodeTransfer,
  loadByCode,
} from '../systems/cloudSave.js';

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
// The currently-live one-shot transfer code, if any - { code, expiresAtMs }
// or null. Reset whenever Settings mounts/unmounts (see mount/unmount
// below) rather than persisted, so a closed-and-reopened Settings panel
// always starts from "no active transfer" instead of showing a stale
// countdown for a code that may already be dead server-side.
let activeTransfer = null;
let transferIntervalId = null;

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

function flashStatus(elId, text) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.hidden = false;
  el.textContent = text;
}

function clearTransferInterval() {
  if (transferIntervalId) {
    clearInterval(transferIntervalId);
    transferIntervalId = null;
  }
}

// Redraws just the code/countdown display without a full render() - a full
// render() would rebuild the load-code text input too, discarding whatever
// the player was mid-typing into it every second.
function updateTransferCountdownUI() {
  const codeEl = document.getElementById('cloud-transfer-code');
  const countdownEl = document.getElementById('cloud-transfer-countdown');
  if (!codeEl || !countdownEl) return; // section not mounted (flag off)
  if (!activeTransfer) {
    codeEl.hidden = true;
    countdownEl.hidden = true;
    return;
  }
  const remainingMs = activeTransfer.expiresAtMs - Date.now();
  if (remainingMs <= 0) {
    activeTransfer = null;
    clearTransferInterval();
    codeEl.hidden = true;
    countdownEl.hidden = true;
    flashStatus('cloud-code-status', 'Code expired - start a new transfer.');
    return;
  }
  codeEl.hidden = false;
  countdownEl.hidden = false;
  codeEl.textContent = activeTransfer.code;
  countdownEl.textContent = `expires in ${Math.ceil(remainingMs / 1000)}s`;
}

async function handleStartTransfer() {
  document.getElementById('cloud-code-status').hidden = true;
  flashStatus('cloud-code-status', 'Starting transfer...');
  try {
    const { code, ok } = await startCodeTransfer(state);
    if (!ok) {
      flashStatus('cloud-code-status', 'Failed to start transfer - try again.');
      return;
    }
    document.getElementById('cloud-code-status').hidden = true;
    clearTransferInterval();
    activeTransfer = { code, expiresAtMs: Date.now() + CODE_TRANSFER_TTL_SECONDS * 1000 };
    updateTransferCountdownUI();
    transferIntervalId = setInterval(updateTransferCountdownUI, 1000);
  } catch {
    flashStatus('cloud-code-status', 'Failed to start transfer - check your connection.');
  }
}

// The overwrite-vs-new-slot decision (and any naming prompt) lives in
// callbacks.onCloudSaveImported (js/main.js) - shared with the Character
// Select entry point (js/screens/startScreen.js) so it isn't duplicated.
async function handleLoadFromCode() {
  const input = document.getElementById('cloud-code-load-input');
  const code = input.value.trim().toLowerCase();
  if (!isValidSaveCode(code)) {
    flashStatus('cloud-code-status', 'Enter the 4-character code shown on the other device.');
    return;
  }
  flashStatus('cloud-code-status', 'Loading...');
  try {
    const data = await loadByCode(code);
    if (data === null) {
      flashStatus('cloud-code-status', 'No live transfer for that code - it may have expired.');
      return;
    }
    const result = callbacks.onCloudSaveImported(data);
    flashStatus('cloud-code-status', result.imported
      ? (result.mode === 'overwrite' ? `Updated "${result.name}"!` : `Imported as "${result.name}"! Find it on the Character Select screen.`)
      : 'Import cancelled.');
    input.value = '';
  } catch {
    flashStatus('cloud-code-status', 'Load failed - check your connection.');
  }
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
      <h3>🚧 Feature Flags</h3>
      <div class="settings-row settings-feature-flag">
        <label for="settings-flag-audio-beta">
          Enable Audio (beta) — sound is a work in progress, expect missing
          or rough audio
        </label>
        <input
          type="checkbox"
          id="settings-flag-audio-beta"
          ${state.settings.featureFlags?.audioBeta ? 'checked' : ''}
        />
      </div>
      <div class="settings-row settings-feature-flag">
        <label for="settings-flag-mechanic-explainers-beta">
          Combat Explainers (beta) — in-battle popups for new abilities and
          mechanics as you unlock them, still being written
        </label>
        <input
          type="checkbox"
          id="settings-flag-mechanic-explainers-beta"
          ${state.settings.featureFlags?.mechanicExplainersBeta ? 'checked' : ''}
        />
      </div>
      <div class="settings-row settings-feature-flag">
        <label for="settings-flag-cloud-save-beta">
          Cloud Save (beta) — move your character to another computer
          without copy/pasting a save file
        </label>
        <input
          type="checkbox"
          id="settings-flag-cloud-save-beta"
          ${state.settings.featureFlags?.cloudSaveBeta ? 'checked' : ''}
        />
      </div>
      ${state.settings.featureFlags?.cloudSaveBeta ? `
        <h3>☁️ Cloud Save</h3>
        <p class="settings-hint">
          Loading a code adds it as a new character on this browser's
          Character Select screen - it never overwrites what's already
          here, so you can pull in as many characters from as many other
          browsers as you want.
        </p>
        <p class="settings-hint">
          Transfer codes are low-security and short-lived on purpose: a
          code is only usable for ${CODE_TRANSFER_TTL_SECONDS} seconds
          after you click Start Transfer, then it's gone - start a new one
          any time.
        </p>
        <div class="settings-row">
          <button id="btn-cloud-start-transfer">Start Transfer</button>
          <span id="cloud-transfer-code" class="cloud-save-code" hidden></span>
          <span id="cloud-transfer-countdown" hidden></span>
        </div>
        <div class="settings-row">
          <input type="text" id="cloud-code-load-input" maxlength="4" placeholder="code from another device" />
          <button id="btn-cloud-code-load">Load</button>
        </div>
        <div class="settings-row">
          <span id="cloud-code-status" hidden></span>
        </div>
      ` : ''}
      ${state.settings.featureFlags?.audioBeta ? `
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
      ` : ''}
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
  document.getElementById('settings-flag-audio-beta').onchange = (e) => {
    state.settings = {
      ...state.settings,
      featureFlags: { ...state.settings.featureFlags, audioBeta: e.target.checked },
    };
    callbacks.onChange();
    render(); // toggling the flag shows/hides the Sound section immediately
  };
  document.getElementById('settings-flag-mechanic-explainers-beta').onchange = (e) => {
    state.settings = {
      ...state.settings,
      featureFlags: { ...state.settings.featureFlags, mechanicExplainersBeta: e.target.checked },
    };
    callbacks.onChange();
  };
  document.getElementById('settings-flag-cloud-save-beta').onchange = (e) => {
    state.settings = {
      ...state.settings,
      featureFlags: { ...state.settings.featureFlags, cloudSaveBeta: e.target.checked },
    };
    callbacks.onChange();
    render(); // toggling the flag shows/hides the Cloud Save section immediately
  };
  if (state.settings.featureFlags?.cloudSaveBeta) {
    document.getElementById('btn-cloud-start-transfer').onclick = () => handleStartTransfer();
    document.getElementById('btn-cloud-code-load').onclick = () => handleLoadFromCode();
    updateTransferCountdownUI(); // restores an in-progress countdown across a re-render (e.g. toggling another flag)
  }
  const soundThemeSelect = document.getElementById('settings-sound-theme');
  if (soundThemeSelect) {
    soundThemeSelect.onchange = (e) => {
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
  }
  document.getElementById('btn-close-settings').onclick = () => callbacks.onClose();
  document.getElementById('btn-close-x').onclick = () => callbacks.onClose();
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  callbacks = props.callbacks;
  activeTransfer = null;
  clearTransferInterval();
  render();
  unbindEscape = bindEscapeClose(() => callbacks.onClose());
  unbindBackdrop = bindBackdropClose(rootEl, () => callbacks.onClose());
}

export function unmount() {
  unbindEscape?.();
  unbindBackdrop?.();
  clearTransferInterval();
  activeTransfer = null;
}
