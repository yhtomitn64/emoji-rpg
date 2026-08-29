let rootEl = null;
let callbacks = null;

function renderEntry(entry) {
  const items = entry.highlights.map((highlight) => `<li>${highlight}</li>`).join('');
  return `<h3>v${entry.version} — ${entry.date}</h3><ul>${items}</ul>`;
}

function render(entries) {
  rootEl.innerHTML = `
    <div class="overlay-panel changelog-panel">
      <h2>What's New</h2>
      <div class="inventory-scroll-area">${entries.map(renderEntry).join('')}</div>
      <button id="btn-close-changelog">Close</button>
    </div>
  `;

  document.getElementById('btn-close-changelog').onclick = () => callbacks.onClose();
}

export function mount(root, props) {
  rootEl = root;
  callbacks = props.callbacks;
  render(props.entries);
}

export function unmount() {}
