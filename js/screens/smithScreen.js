import { ITEMS } from '../data/items.js';
import { upgradeCost, upgradeItem, MAX_UPGRADE_LEVEL } from '../systems/inventory.js';

const SLOTS = ['weapon', 'head', 'body', 'legs', 'accessory'];

let rootEl = null;
let state = null;
let callbacks = null;

function materialOptionsForSlot(slot) {
  return state.inventory.filter((entry) => {
    const item = ITEMS[entry.itemId];
    return item.type === 'material' && item.upgradeSlot === slot && entry.quantity > 0;
  });
}

function render() {
  const rows = SLOTS.map((slot) => {
    const itemId = state.equipment[slot];
    if (!itemId) return `<div class="smith-row">${slot}: (empty)</div>`;

    const item = ITEMS[itemId];
    const level = state.upgrades?.[itemId] || 0;

    if (level >= MAX_UPGRADE_LEVEL) {
      return `<div class="smith-row">
      <span>${item.emoji} ${item.name} +${level} (MAX)</span>
    </div>`;
    }

    const cost = upgradeCost(level);
    const materials = materialOptionsForSlot(slot);
    const options = materials
      .map((m) => `<option value="${m.itemId}">${ITEMS[m.itemId].name} (x${m.quantity})</option>`)
      .join('');

    return `<div class="smith-row">
      <span>${item.emoji} ${item.name} +${level}</span>
      <select data-slot="${slot}">${options}</select>
      <button data-slot="${slot}" ${materials.length === 0 ? 'disabled' : ''}>Upgrade (${cost}g)</button>
    </div>`;
  }).join('');

  rootEl.innerHTML = `
    <div class="smith-screen">
      <h2>Smith (Gold: ${state.player.gold})</h2>
      ${rows}
      <button id="btn-leave">Leave</button>
    </div>
  `;

  rootEl.querySelectorAll('button[data-slot]').forEach((btn) => {
    btn.onclick = () => tryUpgrade(btn.dataset.slot);
  });
  document.getElementById('btn-leave').onclick = () => callbacks.onLeave();
}

function tryUpgrade(slot) {
  const select = rootEl.querySelector(`select[data-slot="${slot}"]`);
  const materialId = select?.value;
  if (!materialId) return;

  const itemId = state.equipment[slot];
  const level = state.upgrades?.[itemId] || 0;
  const cost = upgradeCost(level);

  try {
    const next = upgradeItem(state, slot, materialId, cost);
    Object.assign(state, next);
    callbacks.onUpgrade();
  } catch {
    // Not enough gold or missing material — button availability already reflects this
  }
  render();
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  callbacks = props.callbacks;
  render();
}

export function unmount() {}
