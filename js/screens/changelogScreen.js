import { bindEscapeClose, bindBackdropClose } from './dialogChrome.js';

let rootEl = null;
let callbacks = null;
let unbindEscape = null;
let unbindBackdrop = null;

function renderEntry(entry) {
  const items = entry.highlights.map((highlight) => `<li>${highlight}</li>`).join('');
  return `<h3>v${entry.version} — ${entry.date}</h3><ul>${items}</ul>`;
}

function render(entries) {
  rootEl.innerHTML = `
    <div class="overlay-panel changelog-panel">
      <button class="screen-close-x" id="btn-close-x" aria-label="Close">✕</button>
      <h2>What's New</h2>
      <div class="inventory-scroll-area">${entries.map(renderEntry).join('')}</div>
      <button id="btn-close-changelog">Close</button>
    </div>
  `;

  document.getElementById('btn-close-changelog').onclick = () => callbacks.onClose();
  document.getElementById('btn-close-x').onclick = () => callbacks.onClose();
}

export function mount(root, props) {
  rootEl = root;
  callbacks = props.callbacks;
  render(props.entries);
  unbindEscape = bindEscapeClose(() => callbacks.onClose());
  unbindBackdrop = bindBackdropClose(rootEl, () => callbacks.onClose());
}

export function unmount() {
  unbindEscape?.();
  unbindBackdrop?.();
}
