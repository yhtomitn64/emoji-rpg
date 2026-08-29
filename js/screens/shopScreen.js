import { ITEMS, SHOP_CATALOG } from '../data/items.js';
import { spendGold, addItem, removeItem, addGold, sellPrice, maxAffordableQuantity, describeItem, equipItem, getItemStatDelta, sellDuplicateGear } from '../systems/inventory.js';
import { tierLabel } from '../systems/itemQuality.js';

// Raised 2026-08-29: "you never really need to buy more than 1 equipment
// item, the only thing that really needs multiples is the potions." Bulk
// quantities only make sense for stackable consumables - equipping is a
// one-copy-at-a-time slot, so a Buy 5x/10x/100x on a sword just clutters
// the row with buttons that are never useful (worst case, buying extras
// unequipped, which Sell Duplicate Gear above now exists specifically to
// clean back up).
const CONSUMABLE_BUY_QUANTITIES = [1, 5, 10, 100];
const GEAR_BUY_QUANTITIES = [1];

let rootEl = null;
let state = null;
let callbacks = null;
let pendingEquip = null;
let sellDuplicatesMessage = null;

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

// Raised 2026-08-29: "add a sell duplicates button... auto sells all your
// dupes to clean up INV" - originally landed in the inventory screen, then
// moved here per Timothy's own correction ("that should be a shop feature
// not something you can do all the time"). Scans the player's whole gear
// inventory, not just SHOP_CATALOG - a duplicate boss/unique drop (price 0)
// is just as much clutter as a duplicate shop item.
function renderSellDuplicatesControl() {
  const duplicateCount = state.inventory.filter((entry) => ITEMS[entry.itemId].slot && entry.quantity > 1).length;
  return `<div class="shop-sell-duplicates">
    <button id="btn-sell-duplicates" ${duplicateCount === 0 ? 'disabled' : ''}>🧹 Sell Duplicate Gear</button>
    ${sellDuplicatesMessage ? `<span class="shop-sell-duplicates-message">${sellDuplicatesMessage}</span>` : ''}
  </div>`;
}

// Raised 2026-08-28 (final review), fixed 2026-08-29: the shop used to only
// ever sell/buy the Plain stack of a gear item, leaving a single Fine/
// Superior copy with no sell path at all once found. Sells at the same
// sellPrice() as Plain - no tier price premium, same precedent already set
// by sellDuplicateGear below.
function tieredSellRowsHtml(itemId) {
  const item = ITEMS[itemId];
  return ['fine', 'superior'].map((tier) => {
    const entry = state.inventory.find((e) => e.itemId === itemId && e.tier === tier);
    if (!entry || entry.quantity === 0) return '';
    return `<div class="shop-row">
      <span title="${describeItem(itemId, tier)}">${item.emoji} ${tierLabel(tier)}${item.name} (own ${entry.quantity})</span>
      <span class="shop-row-buttons">
        <button data-sell="${itemId}" data-tier="${tier}">Sell (${sellPrice(item.price)}g)</button>
      </span>
    </div>`;
  }).join('');
}

function render() {
  const rows = SHOP_CATALOG.map((itemId) => {
    const item = ITEMS[itemId];
    const ownedEntry = state.inventory.find((entry) => entry.itemId === itemId && !entry.tier);
    const ownedQty = ownedEntry ? ownedEntry.quantity : 0;
    // Tier-aware: only the Plain copy is "this row, equipped" - a worn Fine/
    // Superior copy is a different (better) item than what the shop sells.
    const isEquipped = item.slot && state.equipment[item.slot] === itemId && !state.equipmentTiers?.[item.slot];
    const buyQuantities = item.type === 'consumable' ? CONSUMABLE_BUY_QUANTITIES : GEAR_BUY_QUANTITIES;
    const buyButtons = buyQuantities.map((qty) => {
      const affordable = maxAffordableQuantity(state.player.gold, item.price, qty) === qty;
      const label = qty === 1 ? 'Buy' : `Buy ${qty}x`;
      return `<button data-item="${itemId}" data-qty="${qty}" ${affordable ? '' : 'disabled'}>${label}</button>`;
    }).join('');
    return `<div class="shop-row">
      <span title="${describeItem(itemId)}">${item.emoji} ${item.name} — ${item.price}g${ownedQty > 0 ? ` (own ${ownedQty})` : ''}${isEquipped ? ' ✓ Equipped' : ''}</span>
      <span class="shop-row-buttons">
        ${buyButtons}
        <button data-sell="${itemId}" ${ownedQty === 0 ? 'disabled' : ''}>Sell (${sellPrice(item.price)}g)</button>
      </span>
    </div>${item.slot ? tieredSellRowsHtml(itemId) : ''}`;
  }).join('');

  rootEl.innerHTML = `
    <div class="shop-screen">
      <button class="screen-close-x" id="btn-close-x" aria-label="Leave shop">✕</button>
      <h2>Shop (Gold: ${state.player.gold})</h2>
      ${renderEquipPrompt()}
      ${renderSellDuplicatesControl()}
      ${rows}
      <button id="btn-leave">Leave</button>
    </div>
  `;

  rootEl.querySelectorAll('button[data-item]').forEach((btn) => {
    btn.onclick = () => buyItem(btn.dataset.item, Number(btn.dataset.qty));
  });
  rootEl.querySelectorAll('button[data-sell]').forEach((btn) => {
    btn.onclick = () => sellItem(btn.dataset.sell, btn.dataset.tier);
  });
  const sellDuplicatesBtn = document.getElementById('btn-sell-duplicates');
  if (sellDuplicatesBtn) {
    sellDuplicatesBtn.onclick = () => {
      const result = sellDuplicateGear(state);
      Object.assign(state, result.state);
      sellDuplicatesMessage = result.soldCount === 0
        ? 'No duplicates to sell.'
        : `Sold ${result.soldCount} duplicate item${result.soldCount === 1 ? '' : 's'} for ${result.goldEarned}g.`;
      pendingEquip = null;
      callbacks.onPurchase();
      render();
    };
  }
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
  sellDuplicatesMessage = null;
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

function sellItem(itemId, tier) {
  const owned = state.inventory.some((entry) => entry.itemId === itemId && entry.tier === tier && entry.quantity > 0);
  if (!owned) return;

  let next = removeItem(state, itemId, 1, tier); // tier undefined for the Plain row's button, 'fine'/'superior' for a tiered row's
  next = addGold(next, sellPrice(ITEMS[itemId].price));
  Object.assign(state, next);
  pendingEquip = null;
  sellDuplicatesMessage = null;
  callbacks.onPurchase();
  render();
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  callbacks = props.callbacks;
  pendingEquip = null;
  sellDuplicatesMessage = null;
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
