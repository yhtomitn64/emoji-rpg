import { ITEMS } from '../data/items.js';
import { getItemSources } from '../systems/loot.js';

const SECTIONS = [
  { label: 'Gear', filter: (item) => Boolean(item.slot) },
  { label: 'Potions', filter: (item) => item.type === 'consumable' },
  { label: 'Materials', filter: (item) => item.type === 'material' },
  { label: 'Tools', filter: (item) => item.type === 'tool' },
];

let rootEl = null;
let state = null;
let callbacks = null;

function ownedQuantity(itemId) {
  const item = ITEMS[itemId];
  const inventoryQty = state.inventory
    .filter((entry) => entry.itemId === itemId)
    .reduce((sum, entry) => sum + entry.quantity, 0);
  const equippedQty = item.slot && state.equipment[item.slot] === itemId ? 1 : 0;
  return inventoryQty + equippedQty;
}

function renderSection(section) {
  const itemIds = Object.keys(ITEMS).filter((itemId) => section.filter(ITEMS[itemId]));
  const rows = itemIds.map((itemId) => {
    const item = ITEMS[itemId];
    const owned = ownedQuantity(itemId);
    const sources = getItemSources(itemId).join(', ') || 'Unknown source';
    return `<div class="inventory-row">
      <span>${item.emoji} ${item.name}${owned > 0 ? ` (own ${owned})` : ''}</span>
      <span class="loot-source">${sources}</span>
    </div>`;
  }).join('');
  return `<h3>${section.label}</h3>${rows}`;
}

function render() {
  const sections = SECTIONS.map(renderSection).join('');
  rootEl.innerHTML = `
    <div class="overlay-panel loot-reference-panel">
      <h2>Loot Reference</h2>
      <div class="inventory-scroll-area">${sections}</div>
      <button id="btn-close-loot-reference">Close</button>
    </div>
  `;

  document.getElementById('btn-close-loot-reference').onclick = () => callbacks.onClose();
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  callbacks = props.callbacks;
  render();
}

export function unmount() {}
