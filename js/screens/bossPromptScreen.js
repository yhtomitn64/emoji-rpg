let rootEl = null;
let callbacks = null;

function render(text) {
  rootEl.innerHTML = `
    <div class="overlay-panel boss-prompt-panel">
      <h2>The Dragon Returns</h2>
      <p>${text}</p>
      <button id="btn-boss-fight">Fight!</button>
      <button id="btn-boss-not-yet">Not yet</button>
    </div>
  `;

  document.getElementById('btn-boss-fight').onclick = () => callbacks.onAccept();
  document.getElementById('btn-boss-not-yet').onclick = () => callbacks.onDecline();
  document.getElementById('btn-boss-fight').focus();
}

export function mount(root, props) {
  rootEl = root;
  callbacks = props.callbacks;
  render(props.text);
}

export function unmount() {}
