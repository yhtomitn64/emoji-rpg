import { getMessageLog } from './flavorBanner.js';

let rootEl = null;
let callbacks = null;

function render() {
  const log = getMessageLog();
  const rows = [...log].reverse()
    .map((text) => `<div class="message-log-entry">${text}</div>`)
    .join('');

  rootEl.innerHTML = `
    <div class="overlay-panel message-log-panel">
      <h2>Status Log</h2>
      <div class="message-log-list">
        ${rows || '<div class="message-log-entry">Nothing has happened yet.</div>'}
      </div>
      <button id="btn-close-message-log">Close</button>
    </div>
  `;

  document.getElementById('btn-close-message-log').onclick = () => callbacks.onClose();
}

export function mount(root, props) {
  rootEl = root;
  callbacks = props.callbacks;
  render();
}

export function unmount() {}
