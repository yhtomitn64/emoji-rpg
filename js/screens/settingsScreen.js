import { DEFAULT_ITEM_MENU_AUTO_CLOSE_MS } from '../state.js';
import { getBufferAsJsonl } from '../systems/telemetry.js';
import { bindEscapeClose, bindBackdropClose } from './dialogChrome.js';

const ITEM_MENU_AUTO_CLOSE_MIN_MS = 250;
const ITEM_MENU_AUTO_CLOSE_MAX_MS = 5000;

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
