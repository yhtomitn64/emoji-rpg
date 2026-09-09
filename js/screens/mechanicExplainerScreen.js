// Overlay for combat mechanic/ability explainers (js/main.js's ability-
// unlock trigger, mounted via screenManager's mountOverlay). Mirrors
// changelogScreen.js's structure - the closest existing analog, a
// dismissable overlay-panel screen - down to the same close/Escape/backdrop
// affordances (see the "Escape + backdrop-click also count" design
// decision). js/screens/battleScreen.js reuses renderSectionsHtml directly
// for its own inline falloff-explainer panel, since that panel can't go
// through screenManager (battleScreen itself already occupies the overlay
// slot mid-battle) but still wants identical section markup.

import { bindEscapeClose, bindBackdropClose } from './dialogChrome.js';

let rootEl = null;
let callbacks = null;
let unbindEscape = null;
let unbindBackdrop = null;

function renderSection(section) {
  const heading = section.icon ? `${section.icon} ${section.title}` : section.title;
  return `<div class="mechanic-explainer-section"><h3>${heading}</h3><p>${section.text}</p></div>`;
}

export function renderSectionsHtml(sections) {
  return sections.map(renderSection).join('');
}

function render(title, sections) {
  rootEl.innerHTML = `
    <div class="overlay-panel mechanic-explainer-panel">
      <button class="screen-close-x" id="btn-close-x" aria-label="Close">✕</button>
      <h2>${title}</h2>
      <div class="inventory-scroll-area">${renderSectionsHtml(sections)}</div>
      <button id="btn-close-mechanic-explainer">Got it</button>
    </div>
  `;

  document.getElementById('btn-close-mechanic-explainer').onclick = () => callbacks.onClose();
  document.getElementById('btn-close-x').onclick = () => callbacks.onClose();
}

export function mount(root, props) {
  rootEl = root;
  callbacks = props.callbacks;
  render(props.title, props.sections);
  unbindEscape = bindEscapeClose(() => callbacks.onClose());
  unbindBackdrop = bindBackdropClose(rootEl, () => callbacks.onClose());
}

export function unmount() {
  unbindEscape?.();
  unbindBackdrop?.();
}
