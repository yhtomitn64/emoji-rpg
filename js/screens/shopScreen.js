import { ITEMS } from '../data/items.js';
import { spendGold, addItem } from '../systems/inventory.js';

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
    return `<div class="shop-row">
      <span>${item.emoji} ${item.name} — ${item.price}g</span>
      <button data-item="${itemId}">Buy</button>
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

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  callbacks = props.callbacks;
  render();
}

export function unmount() {}
