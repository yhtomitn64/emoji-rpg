import { ITEMS } from '../data/items.js';
import { spendGold, addItem, removeItem, addGold, sellPrice } from '../systems/inventory.js';

const CATALOG = [
  'ironSword', 'ironHelm', 'ironArmor', 'ironGreaves',
  'powerRing', 'clothCap', 'clothTunic', 'clothPants', 'luckyCharm', 'potion',
];

let rootEl = null;
let state = null;
let callbacks = null;

function render() {
  const rows = CATALOG.map((itemId) => {
    const item = ITEMS[itemId];
    const ownedEntry = state.inventory.find((entry) => entry.itemId === itemId);
    const ownedQty = ownedEntry ? ownedEntry.quantity : 0;
    return `<div class="shop-row">
      <span>${item.emoji} ${item.name} — ${item.price}g${ownedQty > 0 ? ` (own ${ownedQty})` : ''}</span>
      <button data-item="${itemId}">Buy</button>
      <button data-sell="${itemId}" ${ownedQty === 0 ? 'disabled' : ''}>Sell (${sellPrice(item.price)}g)</button>
    </div>`;
  }).join('');

  rootEl.innerHTML = `
    <div class="shop-screen">
      <h2>Shop (Gold: ${state.player.gold})</h2>
      ${rows}
      <button id="btn-leave">Leave</button>
    </div>
  `;

  rootEl.querySelectorAll('button[data-item]').forEach((btn) => {
    btn.onclick = () => buyItem(btn.dataset.item);
  });
  rootEl.querySelectorAll('button[data-sell]').forEach((btn) => {
    btn.onclick = () => sellItem(btn.dataset.sell);
  });
  document.getElementById('btn-leave').onclick = () => callbacks.onLeave();
}

function buyItem(itemId) {
  const item = ITEMS[itemId];
  if (state.player.gold < item.price) return;

  let next = spendGold(state, item.price);
  next = addItem(next, itemId, 1);
  Object.assign(state, next);
  callbacks.onPurchase();
  render();
}

function sellItem(itemId) {
  const owned = state.inventory.some((entry) => entry.itemId === itemId && entry.quantity > 0);
  if (!owned) return;

  let next = removeItem(state, itemId, 1);
  next = addGold(next, sellPrice(ITEMS[itemId].price));
  Object.assign(state, next);
  callbacks.onPurchase();
  render();
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  callbacks = props.callbacks;
  render();
}

export function unmount() {}
