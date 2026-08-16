import { ITEMS } from '../data/items.js';
import { getItemStatDelta, equipItem, unequipItem } from '../systems/inventory.js';

const SLOTS = ['weapon', 'head', 'body', 'legs', 'accessory'];

let rootEl = null;
let state = null;
let callbacks = null;

function formatDelta(delta) {
  return Object.entries(delta)
    .filter(([, value]) => value !== 0)
    .map(([stat, value]) => `${stat} ${value > 0 ? '+' : ''}${value}`)
    .join(', ');
}

function renderEquippedRows() {
  return SLOTS.map((slot) => {
    const itemId = state.equipment[slot];
    if (!itemId) return `<div class="inventory-row">${slot}: (empty)</div>`;
    const item = ITEMS[itemId];
    const level = state.upgrades?.[itemId] || 0;
    return `<div class="inventory-row">
      <span>${slot}: ${item.emoji} ${item.name} +${level}</span>
      <button data-unequip="${slot}">Unequip</button>
    </div>`;
  }).join('');
}

function renderGearRows() {
  const gearEntries = state.inventory.filter((entry) => ITEMS[entry.itemId].slot);
  if (gearEntries.length === 0) return '<div class="inventory-empty">No unequipped gear.</div>';
  return gearEntries.map((entry) => {
    const item = ITEMS[entry.itemId];
    const delta = getItemStatDelta(state, entry.itemId);
    const deltaText = formatDelta(delta);
    const qtyText = entry.quantity > 1 ? ` x${entry.quantity}` : '';
    return `<div class="inventory-row">
      <span>${item.emoji} ${item.name}${qtyText}${deltaText ? ` (${deltaText})` : ''}</span>
      <button data-equip="${entry.itemId}">Equip</button>
    </div>`;
  }).join('');
}

function renderMaterialRows() {
  const materialEntries = state.inventory.filter((entry) => ITEMS[entry.itemId].type === 'material');
  if (materialEntries.length === 0) return '<div class="inventory-empty">No materials.</div>';
  return materialEntries.map((entry) => {
    const item = ITEMS[entry.itemId];
    return `<div class="inventory-row">${item.emoji} ${item.name} x${entry.quantity}</div>`;
  }).join('');
}

function renderConsumableRows() {
  const consumableEntries = state.inventory.filter((entry) => ITEMS[entry.itemId].type === 'consumable');
  if (consumableEntries.length === 0) return '<div class="inventory-empty">No potions.</div>';
  return consumableEntries.map((entry) => {
    const item = ITEMS[entry.itemId];
    return `<div class="inventory-row">${item.emoji} ${item.name} x${entry.quantity}</div>`;
  }).join('');
}

function render() {
  rootEl.innerHTML = `
    <div class="overlay-panel inventory-panel">
      <h2>Inventory</h2>
      <h3>Equipment</h3>
      ${renderEquippedRows()}
      <h3>Gear</h3>
      ${renderGearRows()}
      <h3>Materials</h3>
      ${renderMaterialRows()}
      <h3>Potions</h3>
      ${renderConsumableRows()}
      <button id="btn-close-inventory">Close</button>
    </div>
  `;

  rootEl.querySelectorAll('button[data-equip]').forEach((btn) => {
    btn.onclick = () => {
      const itemId = btn.dataset.equip;
      Object.assign(state, equipItem(state, itemId, ITEMS[itemId].slot));
      callbacks.onChange();
      render();
    };
  });
  rootEl.querySelectorAll('button[data-unequip]').forEach((btn) => {
    btn.onclick = () => {
      Object.assign(state, unequipItem(state, btn.dataset.unequip));
      callbacks.onChange();
      render();
    };
  });
  document.getElementById('btn-close-inventory').onclick = () => callbacks.onClose();
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  callbacks = props.callbacks;
  render();
}

export function unmount() {}
