import { ITEMS } from '../data/items.js';
import { getItemStatDelta, equipItem, unequipItem, removeItem, applyHeal, getEquipmentBonuses, describeItem } from '../systems/inventory.js';
import { tierLabel } from '../systems/itemQuality.js';

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
    const tier = state.equipmentTiers?.[slot];
    return `<div class="inventory-row">
      <span title="${describeItem(itemId, tier)}">${slot}: ${item.emoji} ${tierLabel(tier)}${item.name} +${level}</span>
      <button data-unequip="${slot}">Unequip</button>
    </div>`;
  }).join('');
}

function renderGearRows() {
  const gearEntries = state.inventory.filter((entry) => ITEMS[entry.itemId].slot);
  if (gearEntries.length === 0) return '<div class="inventory-empty">No unequipped gear.</div>';
  return gearEntries.map((entry) => {
    const item = ITEMS[entry.itemId];
    const delta = getItemStatDelta(state, entry.itemId, entry.tier);
    const deltaText = formatDelta(delta);
    const qtyText = entry.quantity > 1 ? ` x${entry.quantity}` : '';
    return `<div class="inventory-row">
      <span title="${describeItem(entry.itemId, entry.tier)}">${item.emoji} ${tierLabel(entry.tier)}${item.name}${qtyText}${deltaText ? ` (${deltaText})` : ''}</span>
      <button data-equip="${entry.itemId}" data-tier="${entry.tier || ''}">Equip</button>
    </div>`;
  }).join('');
}

function renderMaterialRows() {
  const materialEntries = state.inventory.filter((entry) => ITEMS[entry.itemId].type === 'material');
  if (materialEntries.length === 0) return '<div class="inventory-empty">No materials.</div>';
  return materialEntries.map((entry) => {
    const item = ITEMS[entry.itemId];
    return `<div class="inventory-row" title="${describeItem(entry.itemId)}">${item.emoji} ${item.name} x${entry.quantity}</div>`;
  }).join('');
}

function renderConsumableRows() {
  const consumableEntries = state.inventory.filter((entry) => ITEMS[entry.itemId].type === 'consumable');
  if (consumableEntries.length === 0) return '<div class="inventory-empty">No potions.</div>';
  const effectiveMaxHp = state.player.maxHp + getEquipmentBonuses(state).maxHp;
  const atFullHp = state.player.hp >= effectiveMaxHp;
  return consumableEntries.map((entry) => {
    const item = ITEMS[entry.itemId];
    return `<div class="inventory-row">
      <span title="${describeItem(entry.itemId)}">${item.emoji} ${item.name} x${entry.quantity}</span>
      <button data-use="${entry.itemId}" ${atFullHp ? 'disabled' : ''}>Use</button>
    </div>`;
  }).join('');
}

function renderToolRows() {
  const toolEntries = state.inventory.filter((entry) => ITEMS[entry.itemId].type === 'tool');
  if (toolEntries.length === 0) return '<div class="inventory-empty">No tools.</div>';
  return toolEntries.map((entry) => {
    const item = ITEMS[entry.itemId];
    return `<div class="inventory-row" title="${describeItem(entry.itemId)}">${item.emoji} ${item.name}</div>`;
  }).join('');
}

function render() {
  rootEl.innerHTML = `
    <div class="overlay-panel inventory-panel">
      <h2>Inventory</h2>
      <div class="inventory-scroll-area">
        <h3>Equipment</h3>
        ${renderEquippedRows()}
        <h3>Gear</h3>
        ${renderGearRows()}
        <h3>Materials</h3>
        ${renderMaterialRows()}
        <h3>Potions</h3>
        ${renderConsumableRows()}
        <h3>Tools</h3>
        ${renderToolRows()}
      </div>
      <button id="btn-close-inventory">Close</button>
    </div>
  `;

  rootEl.querySelectorAll('button[data-equip]').forEach((btn) => {
    btn.onclick = () => {
      const itemId = btn.dataset.equip;
      const tier = btn.dataset.tier || undefined;
      Object.assign(state, equipItem(state, itemId, ITEMS[itemId].slot, tier));
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
  rootEl.querySelectorAll('button[data-use]').forEach((btn) => {
    btn.onclick = () => {
      const itemId = btn.dataset.use;
      const item = ITEMS[itemId];
      const effectiveMaxHp = state.player.maxHp + getEquipmentBonuses(state).maxHp;
      Object.assign(state, removeItem(state, itemId, 1));
      state.player.hp = applyHeal(state.player.hp, effectiveMaxHp, item.heal);
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
