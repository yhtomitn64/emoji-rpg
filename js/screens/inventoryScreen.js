import { ITEMS } from '../data/items.js';
import {
  getItemStatDelta, equipItem, unequipItem, removeItem, applyHeal, getEquipmentBonuses,
  describeItem, getUpgradeLevel, resolveRingEquipSlot, formatStatDelta,
} from '../systems/inventory.js';
import { tierLabel } from '../systems/itemQuality.js';
import { LOADOUT_SIZE, setLoadoutSlot, clearLoadoutSlot } from '../systems/loadout.js';

const SLOTS = ['weapon', 'head', 'body', 'legs', 'accessory', 'ring1', 'ring2'];
const SLOT_LABELS = { ring1: 'Ring 1', ring2: 'Ring 2' };

// Raised 2026-08-29: "our inventory screen should have tabs for the
// different stuff instead of endless list and maybe some sorting" - split
// the growable lists (Gear/Materials/Potions/Tools) into switchable tabs.
// Equipment stays outside the tab set entirely - it's a fixed 5-slot status
// view, not a list that grows long. Rarity/tier sort is only offered on
// Gear since it's the only tab whose entries ever carry a tier.
const TABS = [
  { id: 'gear', label: 'Gear', predicate: (entry) => Boolean(ITEMS[entry.itemId].slot), sortOptions: ['alpha', 'quantity', 'tier'], render: renderGearRows, emptyText: 'No unequipped gear.' },
  { id: 'material', label: 'Materials', predicate: (entry) => ITEMS[entry.itemId].type === 'material', sortOptions: ['alpha', 'quantity'], render: renderMaterialRows, emptyText: 'No materials.' },
  { id: 'consumable', label: 'Potions', predicate: (entry) => ITEMS[entry.itemId].type === 'consumable', sortOptions: ['alpha', 'quantity'], render: renderConsumableRows, emptyText: 'No potions.' },
  { id: 'tool', label: 'Tools', predicate: (entry) => ITEMS[entry.itemId].type === 'tool', sortOptions: ['alpha', 'quantity'], render: renderToolRows, emptyText: 'No tools.' },
];
const SORT_LABELS = { alpha: 'A-Z', quantity: 'Qty', tier: 'Rarity' };
const TIER_RANK = { mythic: 3, superior: 2, fine: 1 };

let rootEl = null;
let state = null;
let callbacks = null;
let activeTabId = 'gear';
let sortOrderByTab = null;

function defaultSortOrderByTab() {
  return Object.fromEntries(TABS.map((tab) => [tab.id, 'alpha']));
}

function sortEntries(entries, sortOrder) {
  const byName = (a, b) => ITEMS[a.itemId].name.localeCompare(ITEMS[b.itemId].name);
  const sorted = [...entries];
  if (sortOrder === 'quantity') {
    sorted.sort((a, b) => b.quantity - a.quantity || byName(a, b));
  } else if (sortOrder === 'tier') {
    sorted.sort((a, b) => (TIER_RANK[b.tier] || 0) - (TIER_RANK[a.tier] || 0) || byName(a, b));
  } else {
    sorted.sort(byName);
  }
  return sorted;
}

function renderEquippedRows() {
  return SLOTS.map((slot) => {
    const itemId = state.equipment[slot];
    const label = SLOT_LABELS[slot] || slot;
    if (!itemId) return `<div class="inventory-row">${label}: (empty)</div>`;
    const item = ITEMS[itemId];
    const tier = state.equipmentTiers?.[slot];
    const level = getUpgradeLevel(state, itemId, tier);
    return `<div class="inventory-row">
      <span title="${describeItem(state, itemId, tier)}">${label}: ${item.emoji} ${tierLabel(tier)}${item.name} +${level}</span>
      <button data-unequip="${slot}">Unequip</button>
    </div>`;
  }).join('');
}

function equipButtonsFor(entry, item) {
  if (item.slot !== 'ring') {
    return `<button data-equip="${entry.itemId}" data-tier="${entry.tier || ''}" data-slot="${item.slot}">Equip</button>`;
  }
  const resolvedSlot = resolveRingEquipSlot(state);
  if (resolvedSlot) {
    return `<button data-equip="${entry.itemId}" data-tier="${entry.tier || ''}" data-slot="${resolvedSlot}">Equip</button>`;
  }
  return `<button data-equip="${entry.itemId}" data-tier="${entry.tier || ''}" data-slot="ring1">→ Ring 1</button>
    <button data-equip="${entry.itemId}" data-tier="${entry.tier || ''}" data-slot="ring2">→ Ring 2</button>`;
}

function renderGearRows(entries) {
  if (entries.length === 0) return '<div class="inventory-empty">No unequipped gear.</div>';
  return entries.map((entry) => {
    const item = ITEMS[entry.itemId];
    const delta = getItemStatDelta(state, entry.itemId, entry.tier);
    const deltaText = formatStatDelta(delta);
    const qtyText = entry.quantity > 1 ? ` x${entry.quantity}` : '';
    return `<div class="inventory-row">
      <span title="${describeItem(state, entry.itemId, entry.tier)}">${item.emoji} ${tierLabel(entry.tier)}${item.name}${qtyText}${deltaText ? ` (${deltaText})` : ''}</span>
      ${equipButtonsFor(entry, item)}
    </div>`;
  }).join('');
}

function renderMaterialRows(entries) {
  if (entries.length === 0) return '<div class="inventory-empty">No materials.</div>';
  return entries.map((entry) => {
    const item = ITEMS[entry.itemId];
    return `<div class="inventory-row" title="${describeItem(state, entry.itemId)}">${item.emoji} ${item.name} x${entry.quantity}</div>`;
  }).join('');
}

function loadoutToggleButtonsHtml(itemId) {
  return Array.from({ length: LOADOUT_SIZE }, (_, index) => {
    const active = state.loadout[index] === itemId;
    return `<button class="inventory-loadout-slot-btn${active ? ' active' : ''}" data-loadout-slot="${index}" data-loadout-item="${itemId}" title="Loadout slot ${index + 1}">${index + 1}</button>`;
  }).join('');
}

function renderConsumableRows(entries) {
  if (entries.length === 0) return '<div class="inventory-empty">No potions.</div>';
  const effectiveMaxHp = state.player.maxHp + getEquipmentBonuses(state).maxHp;
  const atFullHp = state.player.hp >= effectiveMaxHp;
  return entries.map((entry) => {
    const item = ITEMS[entry.itemId];
    // Only the heal potion has a `heal` field - the Use button drinks it
    // outside of battle. The 10 buff potions are battle-only (see the
    // loadout + item quick-select menu in battleScreen.js) - rendering a
    // Use button for one of those used to call applyHeal() with an
    // undefined heal amount, corrupting player HP to NaN.
    const useButton = item.heal ? `<button data-use="${entry.itemId}" ${atFullHp ? 'disabled' : ''}>Use</button>` : '';
    return `<div class="inventory-row">
      <span title="${describeItem(state, entry.itemId)}">${item.emoji} ${item.name} x${entry.quantity}</span>
      <span class="inventory-loadout-slots">${loadoutToggleButtonsHtml(entry.itemId)}</span>
      ${useButton}
    </div>`;
  }).join('');
}

function renderToolRows(entries) {
  if (entries.length === 0) return '<div class="inventory-empty">No tools.</div>';
  return entries.map((entry) => {
    const item = ITEMS[entry.itemId];
    return `<div class="inventory-row" title="${describeItem(state, entry.itemId)}">${item.emoji} ${item.name}</div>`;
  }).join('');
}

function renderTabButtons() {
  return TABS.map((tab) => `<button class="inventory-tab-btn${tab.id === activeTabId ? ' active' : ''}" data-tab="${tab.id}">${tab.label}</button>`).join('');
}

function renderSortControl(tab) {
  if (tab.sortOptions.length <= 1) return '';
  const options = tab.sortOptions.map((opt) => `<option value="${opt}"${sortOrderByTab[tab.id] === opt ? ' selected' : ''}>${SORT_LABELS[opt]}</option>`).join('');
  return `<div class="inventory-sort-control">
    <label for="inventory-sort-select">Sort:</label>
    <select id="inventory-sort-select">${options}</select>
  </div>`;
}

function render() {
  const activeTab = TABS.find((tab) => tab.id === activeTabId);
  const entries = sortEntries(state.inventory.filter(activeTab.predicate), sortOrderByTab[activeTabId]);

  rootEl.innerHTML = `
    <div class="overlay-panel inventory-panel">
      <h2>Inventory</h2>
      <div class="inventory-scroll-area">
        <h3>Equipment</h3>
        ${renderEquippedRows()}
        <div class="inventory-tab-buttons">${renderTabButtons()}</div>
        <div class="inventory-tab-content">
          ${renderSortControl(activeTab)}
          ${activeTab.render(entries)}
        </div>
      </div>
      <button id="btn-close-inventory">Close</button>
    </div>
  `;

  rootEl.querySelectorAll('button[data-tab]').forEach((btn) => {
    btn.onclick = () => {
      activeTabId = btn.dataset.tab;
      render();
    };
  });
  const sortSelect = rootEl.querySelector('#inventory-sort-select');
  if (sortSelect) {
    sortSelect.onchange = () => {
      sortOrderByTab[activeTabId] = sortSelect.value;
      render();
    };
  }
  rootEl.querySelectorAll('button[data-equip]').forEach((btn) => {
    btn.onclick = () => {
      const itemId = btn.dataset.equip;
      const tier = btn.dataset.tier || undefined;
      Object.assign(state, equipItem(state, itemId, btn.dataset.slot, tier));
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
  rootEl.querySelectorAll('button[data-loadout-slot]').forEach((btn) => {
    btn.onclick = () => {
      const slotIndex = Number(btn.dataset.loadoutSlot);
      const itemId = btn.dataset.loadoutItem;
      const alreadyInSlot = state.loadout[slotIndex] === itemId;
      state.loadout = alreadyInSlot ? clearLoadoutSlot(state.loadout, slotIndex) : setLoadoutSlot(state.loadout, slotIndex, itemId);
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
  activeTabId = 'gear';
  sortOrderByTab = defaultSortOrderByTab();
  render();
}

export function unmount() {}
