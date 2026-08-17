import { getMessageLog } from './flavorBanner.js';

let rootEl = null;
let callbacks = null;

function render() {
  const log = getMessageLog();
  const entries = [...log].reverse();

  rootEl.innerHTML = `
    <div class="overlay-panel message-log-panel">
      <h2>Status Log</h2>
      <div class="message-log-list"></div>
      <button id="btn-close-message-log">Close</button>
    </div>
  `;

  const list = rootEl.querySelector('.message-log-list');
  const texts = entries.length > 0 ? entries : ['Nothing has happened yet.'];
  for (const text of texts) {
    const row = document.createElement('div');
    row.className = 'message-log-entry';
    row.textContent = text;
    list.appendChild(row);
  }

  document.getElementById('btn-close-message-log').onclick = () => callbacks.onClose();
}

export function mount(root, props) {
  rootEl = root;
  callbacks = props.callbacks;
  render();
}

export function unmount() {}
