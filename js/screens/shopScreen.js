import { ITEMS, SHOP_CATALOG } from '../data/items.js';
import { spendGold, addItem, removeItem, addGold, sellPrice, maxAffordableQuantity, describeItem, equipItem, getItemStatDelta, sellDuplicateGear, formatStatDelta, getUpgradeLevel } from '../systems/inventory.js';
import { tierLabel } from '../systems/itemQuality.js';
import { logEvent } from '../systems/telemetry.js';

// Raised 2026-08-29: "you never really need to buy more than 1 equipment
// item, the only thing that really needs multiples is the potions." Bulk
// quantities only make sense for stackable consumables - equipping is a
// one-copy-at-a-time slot, so buying a sword 5x/10x/100x at once just means
// buying extras that sit unequipped (worst case, Sell Duplicate Gear above
// exists specifically to clean those back up). This is why the shared qty
// toggle below (design: docs, "Battle FX & Shop Lab" artifact, section 05)
// is ignored for gear cards - only a consumable's Buy button ever reads it.
const CONSUMABLE_BUY_QUANTITIES = [1, 5, 10, 100];

const CATEGORY_TABS = [
  { key: 'weapon', label: 'Weapons' },
  { key: 'armor', label: 'Armor' },
  { key: 'potion', label: 'Potions' },
];

function categoryOf(item) {
  if (item.type === 'consumable') return 'potion';
  return item.slot === 'weapon' ? 'weapon' : 'armor';
}

let rootEl = null;
let state = null;
let callbacks = null;
let activeCategory = 'weapon';
let selectedQty = 1;
// A queue, not a single slot (raised 2026-09-04: "if you buy multiple the
// equip now should stay up for all of them you bought so you can buy 4
// pieces then equip them all") - buying a second not-yet-equipped item used
// to silently overwrite the first one's prompt, dropping it with no way
// back short of digging through Inventory. Keyed by itemId (deduped in
// buyItem below) rather than index, so a click's dataset always names the
// right row even after another row is removed in between renders.
let pendingEquipQueue = [];
let sellDuplicatesMessage = null;

function renderEquipPrompt() {
  if (pendingEquipQueue.length === 0) return '';
  const rows = pendingEquipQueue.map((itemId) => {
    const item = ITEMS[itemId];
    const deltaText = formatStatDelta(getItemStatDelta(state, itemId));
    return `<div class="shop-equip-prompt">
      <span>Equip ${item.emoji} ${item.name} now?${deltaText ? ` (${deltaText})` : ''}</span>
      <button data-equip-yes="${itemId}">Equip</button>
      <button data-equip-no="${itemId}">Not now</button>
    </div>`;
  }).join('');
  return `<div class="shop-equip-prompt-banner">
    <div class="shop-equip-prompt-banner-head">
      <span>Equip your new gear?</span>
      <button class="shop-equip-prompt-close-all" id="btn-equip-prompt-close-all" aria-label="Dismiss all equip prompts">✕</button>
    </div>
    ${rows}
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
      <span title="${describeItem(state, itemId, tier)}">${item.emoji} ${tierLabel(tier)}${item.name} (own ${entry.quantity})</span>
      <span class="shop-row-buttons">
        <button data-sell="${itemId}" data-tier="${tier}">Sell (${sellPrice(item.price)}g)</button>
      </span>
    </div>`;
  }).join('');
}

// Option A ("card grid") from the "Battle FX & Shop Lab" artifact, section
// 05: bigger emoji, one Buy button per item instead of four, category tabs
// instead of one long list.
function itemCardHtml(itemId) {
  const item = ITEMS[itemId];
  const ownedEntry = state.inventory.find((entry) => entry.itemId === itemId && !entry.tier);
  const ownedQty = ownedEntry ? ownedEntry.quantity : 0;
  // Tier-aware: only the Plain copy is "this card, equipped" - a worn Fine/
  // Superior copy is a different (better) item than what the shop sells.
  const isEquipped = item.slot && state.equipment[item.slot] === itemId && !state.equipmentTiers?.[item.slot];
  const isConsumable = item.type === 'consumable';
  const buyQty = isConsumable ? selectedQty : 1; // see CONSUMABLE_BUY_QUANTITIES's comment above
  const affordable = maxAffordableQuantity(state.player.gold, item.price, buyQty) === buyQty;
  const buyLabel = isConsumable && buyQty !== 1 ? `Buy ${buyQty}x` : 'Buy';
  const metaBits = [`${item.price}g`];
  if (ownedQty > 0) metaBits.push(`own ${ownedQty}`);
  if (isEquipped) metaBits.push('✓ Equipped');
  return `<div class="item-card">
    <span class="item-card-emoji">${item.emoji}</span>
    <span class="item-card-name" title="${describeItem(state, itemId)}">${item.name}</span>
    <span class="item-card-meta">${metaBits.join(' · ')}</span>
    <div class="item-card-actions">
      <button class="item-card-buy" data-item="${itemId}" data-qty="${buyQty}" ${affordable ? '' : 'disabled'}>${buyLabel}</button>
      <button class="item-card-sell" data-sell="${itemId}" ${ownedQty === 0 ? 'disabled' : ''}>Sell (${sellPrice(item.price)}g)</button>
    </div>
  </div>`;
}

function tabsHtml() {
  return CATEGORY_TABS.map(({ key, label }) =>
    `<button class="shop-tab ${key === activeCategory ? 'active' : ''}" data-cat="${key}">${label}</button>`
  ).join('');
}

function qtyToggleHtml() {
  return CONSUMABLE_BUY_QUANTITIES.map((qty) =>
    `<button class="shop-qty-btn ${qty === selectedQty ? 'active' : ''}" data-qty="${qty}">${qty}×</button>`
  ).join('');
}

function render() {
  const categoryItemIds = SHOP_CATALOG.filter((itemId) => categoryOf(ITEMS[itemId]) === activeCategory);
  const cardsHtml = categoryItemIds.map(itemCardHtml).join('');
  const tieredHtml = categoryItemIds
    .filter((itemId) => ITEMS[itemId].slot)
    .map((itemId) => tieredSellRowsHtml(itemId))
    .join('');

  rootEl.innerHTML = `
    <div class="shop-screen">
      <button class="screen-close-x" id="btn-close-x" aria-label="Leave shop">✕</button>
      <h2>Shop (Gold: ${state.player.gold})</h2>
      ${renderEquipPrompt()}
      ${renderSellDuplicatesControl()}
      <div class="shop-toolbar">
        <div class="shop-tabs">${tabsHtml()}</div>
        <div class="shop-qty-toggle"><span class="shop-qty-label">Buy qty:</span>${qtyToggleHtml()}</div>
      </div>
      <div class="item-grid">${cardsHtml}</div>
      ${tieredHtml}
      <button id="btn-leave">Leave</button>
    </div>
  `;

  rootEl.querySelectorAll('.shop-tab').forEach((btn) => {
    btn.onclick = () => { activeCategory = btn.dataset.cat; render(); };
  });
  rootEl.querySelectorAll('.shop-qty-btn').forEach((btn) => {
    btn.onclick = () => { selectedQty = Number(btn.dataset.qty); render(); };
  });
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
      pendingEquipQueue = [];
      callbacks.onPurchase();
      render();
    };
  }
  rootEl.querySelectorAll('button[data-equip-yes]').forEach((btn) => {
    btn.onclick = () => {
      const itemId = btn.dataset.equipYes;
      const slot = ITEMS[itemId].slot;
      const replacedItemId = state.equipment[slot] || null;
      Object.assign(state, equipItem(state, itemId, slot));
      logEvent('gear_equipped', { itemId, slot, tier: null, upgradeLevel: getUpgradeLevel(state, itemId, undefined), replacedItemId, ngPlusCycle: state.ngPlusCycle });
      pendingEquipQueue = pendingEquipQueue.filter((id) => id !== itemId);
      callbacks.onPurchase();
      render();
    };
  });
  rootEl.querySelectorAll('button[data-equip-no]').forEach((btn) => {
    btn.onclick = () => {
      pendingEquipQueue = pendingEquipQueue.filter((id) => id !== btn.dataset.equipNo);
      render();
    };
  });
  const closeAllEquipPromptsBtn = document.getElementById('btn-equip-prompt-close-all');
  if (closeAllEquipPromptsBtn) {
    closeAllEquipPromptsBtn.onclick = () => {
      pendingEquipQueue = [];
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
  if (item.slot && state.equipment[item.slot] !== itemId && !pendingEquipQueue.includes(itemId)) {
    pendingEquipQueue.push(itemId);
  }
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
  if (event.key === 'l' || event.key === 'L' || event.key === 'Escape') {
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
  pendingEquipQueue = [];
  sellDuplicatesMessage = null;
  callbacks.onPurchase();
  render();
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  callbacks = props.callbacks;
  pendingEquipQueue = [];
  sellDuplicatesMessage = null;
  activeCategory = 'weapon';
  selectedQty = 1;
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
