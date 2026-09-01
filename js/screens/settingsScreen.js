import { DEFAULT_ITEM_MENU_AUTO_CLOSE_MS } from '../state.js';

const ITEM_MENU_AUTO_CLOSE_MIN_MS = 250;
const ITEM_MENU_AUTO_CLOSE_MAX_MS = 5000;

let rootEl = null;
let state = null;
let callbacks = null;

function render() {
  rootEl.innerHTML = `
    <div class="overlay-panel settings-panel">
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
  document.getElementById('btn-close-settings').onclick = () => callbacks.onClose();
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  callbacks = props.callbacks;
  render();
}

export function unmount() {}
