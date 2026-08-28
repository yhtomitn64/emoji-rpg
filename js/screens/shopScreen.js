import { ITEMS, SHOP_CATALOG } from '../data/items.js';
import { spendGold, addItem, removeItem, addGold, sellPrice, maxAffordableQuantity, describeItem, equipItem, getItemStatDelta } from '../systems/inventory.js';

const BUY_QUANTITIES = [1, 5, 10, 100];

let rootEl = null;
let state = null;
let callbacks = null;
let pendingEquip = null;

function formatDelta(delta) {
  return Object.entries(delta)
    .filter(([, value]) => value !== 0)
    .map(([stat, value]) => `${stat} ${value > 0 ? '+' : ''}${value}`)
    .join(', ');
}

function renderEquipPrompt() {
  if (!pendingEquip) return '';
  const item = ITEMS[pendingEquip];
  const deltaText = formatDelta(getItemStatDelta(state, pendingEquip));
  return `<div class="shop-equip-prompt">
    <span>Equip ${item.emoji} ${item.name} now?${deltaText ? ` (${deltaText})` : ''}</span>
    <button id="btn-equip-prompt-yes">Equip</button>
    <button id="btn-equip-prompt-no">Not now</button>
  </div>`;
}

function render() {
  const rows = SHOP_CATALOG.map((itemId) => {
    const item = ITEMS[itemId];
    const ownedEntry = state.inventory.find((entry) => entry.itemId === itemId && !entry.tier);
    const ownedQty = ownedEntry ? ownedEntry.quantity : 0;
    // Tier-aware: only the Plain copy is "this row, equipped" - a worn Fine/
    // Superior copy is a different (better) item than what the shop sells.
    const isEquipped = item.slot && state.equipment[item.slot] === itemId && !state.equipmentTiers?.[item.slot];
    const buyButtons = BUY_QUANTITIES.map((qty) => {
      const affordable = maxAffordableQuantity(state.player.gold, item.price, qty) === qty;
      return `<button data-item="${itemId}" data-qty="${qty}" ${affordable ? '' : 'disabled'}>Buy ${qty}x</button>`;
    }).join('');
    return `<div class="shop-row">
      <span title="${describeItem(itemId)}">${item.emoji} ${item.name} — ${item.price}g${ownedQty > 0 ? ` (own ${ownedQty})` : ''}${isEquipped ? ' ✓ Equipped' : ''}</span>
      <span class="shop-row-buttons">
        ${buyButtons}
        <button data-sell="${itemId}" ${ownedQty === 0 ? 'disabled' : ''}>Sell (${sellPrice(item.price)}g)</button>
      </span>
    </div>`;
  }).join('');

  rootEl.innerHTML = `
    <div class="shop-screen">
      <button class="screen-close-x" id="btn-close-x" aria-label="Leave shop">✕</button>
      <h2>Shop (Gold: ${state.player.gold})</h2>
      ${renderEquipPrompt()}
      ${rows}
      <button id="btn-leave">Leave</button>
    </div>
  `;

  rootEl.querySelectorAll('button[data-item]').forEach((btn) => {
    btn.onclick = () => buyItem(btn.dataset.item, Number(btn.dataset.qty));
  });
  rootEl.querySelectorAll('button[data-sell]').forEach((btn) => {
    btn.onclick = () => sellItem(btn.dataset.sell);
  });
  if (pendingEquip) {
    document.getElementById('btn-equip-prompt-yes').onclick = () => {
      Object.assign(state, equipItem(state, pendingEquip, ITEMS[pendingEquip].slot));
      pendingEquip = null;
      callbacks.onPurchase();
      render();
    };
    document.getElementById('btn-equip-prompt-no').onclick = () => {
      pendingEquip = null;
      render();
    };
  }
  document.getElementById('btn-leave').onclick = () => callbacks.onLeave();
  document.getElementById('btn-close-x').onclick = () => callbacks.onLeave();
}

function buyItem(itemId, quantity = 1) {
  const item = ITEMS[itemId];
  const affordableQty = maxAffordableQuantity(state.player.gold, item.price, quantity);
  if (affordableQty < quantity) return;

  let next = spendGold(state, item.price * quantity);
  next = addItem(next, itemId, quantity);
  Object.assign(state, next);
  pendingEquip = (item.slot && state.equipment[item.slot] !== itemId) ? itemId : null;
  callbacks.onPurchase();
  render();
}

// Single-key shortcut alongside Tab-based focus navigation, raised
// 2026-08-28: "what else could help like 'l' for leave or something?"
// Skipped while a <select> has focus so it doesn't hijack the browser's own
// type-ahead-to-select-an-option behavior there.
function handleKeydown(event) {
  if (document.activeElement?.tagName === 'SELECT') return;
  if (event.key === 'l' || event.key === 'L') {
    event.preventDefault();
    callbacks.onLeave();
  }
}

function sellItem(itemId) {
  const owned = state.inventory.some((entry) => entry.itemId === itemId && !entry.tier && entry.quantity > 0);
  if (!owned) return;

  let next = removeItem(state, itemId, 1); // tier defaults to undefined - only ever sells the Plain stack
  next = addGold(next, sellPrice(ITEMS[itemId].price));
  Object.assign(state, next);
  pendingEquip = null;
  callbacks.onPurchase();
  render();
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  callbacks = props.callbacks;
  pendingEquip = null;
  render();
  window.addEventListener('keydown', handleKeydown);
}

export function unmount() {
  window.removeEventListener('keydown', handleKeydown);
}

// An overlay (inventory, stats, etc.) can open on top of this screen via the
// HUD without unmounting it - pause/resume (called by screenManager's
// mountOverlay/unmountOverlay) keep the 'l' shortcut from also firing while
// the player is actually interacting with something on top, same pattern
// mapScreen.js already uses for its own keybindings.
export function pause() {
  window.removeEventListener('keydown', handleKeydown);
}

export function resume() {
  window.addEventListener('keydown', handleKeydown);
}
