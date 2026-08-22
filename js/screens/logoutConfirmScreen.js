let rootEl = null;
let callbacks = null;

export function mount(root, props) {
  rootEl = root;
  callbacks = props.callbacks;

  rootEl.innerHTML = `
    <div class="overlay-panel">
      <h2>Switch Character?</h2>
      <p>You'll return to the title screen. Your progress is already saved.</p>
      <button id="btn-logout-confirm">Switch Character</button>
      <button id="btn-logout-cancel">Cancel</button>
    </div>
  `;

  document.getElementById('btn-logout-confirm').onclick = () => callbacks.onConfirm();
  document.getElementById('btn-logout-cancel').onclick = () => callbacks.onCancel();
  document.getElementById('btn-logout-cancel').focus();
}

export function unmount() {}
