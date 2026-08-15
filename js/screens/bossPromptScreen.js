let rootEl = null;
let callbacks = null;
let text = null;
let showTierEscalation = false;
let showNgPlus = false;

function renderMain() {
  const fightButton = showTierEscalation ? '<button id="btn-boss-fight">Fight!</button>' : '';
  const ngPlusButton = showNgPlus ? '<button id="btn-boss-ngplus">Start New Game+</button>' : '';

  rootEl.innerHTML = `
    <div class="overlay-panel boss-prompt-panel">
      <h2>The Dragon Returns</h2>
      <p>${text}</p>
      ${fightButton}
      <button id="btn-boss-not-yet">Not yet</button>
      ${ngPlusButton}
    </div>
  `;

  if (showTierEscalation) {
    document.getElementById('btn-boss-fight').onclick = () => callbacks.onAccept();
  }
  document.getElementById('btn-boss-not-yet').onclick = () => callbacks.onDecline();
  if (showNgPlus) {
    document.getElementById('btn-boss-ngplus').onclick = renderConfirm;
  }

  const focusTarget = showTierEscalation ? 'btn-boss-fight' : 'btn-boss-not-yet';
  document.getElementById(focusTarget).focus();
}

function renderConfirm() {
  rootEl.innerHTML = `
    <div class="overlay-panel boss-prompt-panel">
      <h2>Start New Game+?</h2>
      <p>This resets your map progress. Your level, gear, and gold carry over.</p>
      <button id="btn-ngplus-confirm">Continue</button>
      <button id="btn-ngplus-cancel">Cancel</button>
    </div>
  `;

  document.getElementById('btn-ngplus-confirm').onclick = () => callbacks.onStartNgPlus();
  document.getElementById('btn-ngplus-cancel').onclick = renderMain;
  document.getElementById('btn-ngplus-confirm').focus();
}

export function mount(root, props) {
  rootEl = root;
  callbacks = props.callbacks;
  text = props.text;
  showTierEscalation = props.showTierEscalation;
  showNgPlus = props.showNgPlus;
  renderMain();
}

export function unmount() {}
