import { bindEscapeClose, bindBackdropClose } from './dialogChrome.js';

let rootEl = null;
let callbacks = null;
let unbindEscape = null;
let unbindBackdrop = null;

export function mount(root, props) {
  rootEl = root;
  callbacks = props.callbacks;

  rootEl.innerHTML = `
    <div class="overlay-panel">
      <button class="screen-close-x" id="btn-close-x" aria-label="Cancel">✕</button>
      <h2>Switch Character?</h2>
      <p>You'll return to the title screen. Your progress is already saved.</p>
      <button id="btn-logout-confirm">Switch Character</button>
      <button id="btn-logout-cancel">Cancel</button>
    </div>
  `;

  document.getElementById('btn-logout-confirm').onclick = () => callbacks.onConfirm();
  document.getElementById('btn-logout-cancel').onclick = () => callbacks.onCancel();
  document.getElementById('btn-close-x').onclick = () => callbacks.onCancel();
  document.getElementById('btn-logout-cancel').focus();
  unbindEscape = bindEscapeClose(() => callbacks.onCancel());
  unbindBackdrop = bindBackdropClose(rootEl, () => callbacks.onCancel());
}

export function unmount() {
  unbindEscape?.();
  unbindBackdrop?.();
}
