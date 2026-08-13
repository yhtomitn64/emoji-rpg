import { ITEMS } from '../data/items.js';
import { xpForLevel } from '../systems/leveling.js';
import { getEquipmentBonuses } from '../systems/inventory.js';

const SLOTS = ['weapon', 'head', 'body', 'legs', 'accessory'];

let rootEl = null;
let state = null;
let callbacks = null;

function render() {
  const bonuses = getEquipmentBonuses(state);
  const xpNeeded = xpForLevel(state.player.level);

  const equipRows = SLOTS.map((slot) => {
    const itemId = state.equipment[slot];
    if (!itemId) return `<div class="stats-slot">${slot}: (empty)</div>`;
    const item = ITEMS[itemId];
    const level = state.upgrades?.[itemId] || 0;
    return `<div class="stats-slot">${slot}: ${item.emoji} ${item.name} +${level}</div>`;
  }).join('');

  rootEl.innerHTML = `
    <div class="overlay-panel stats-panel">
      <h2>Stats</h2>
      <div>Level ${state.player.level} (XP ${state.player.xp}/${xpNeeded})</div>
      <div>HP: ${state.player.hp}/${state.player.maxHp + bonuses.maxHp}</div>
      <div>Attack: ${state.player.attack + bonuses.attack}</div>
      <div>Defense: ${state.player.defense + bonuses.defense}</div>
      <div>Speed: ${state.player.speed + bonuses.speed}</div>
      <div>Gold: ${state.player.gold}</div>
      <h3>Equipment</h3>
      ${equipRows}
      <button id="btn-close-stats">Close</button>
    </div>
  `;

  document.getElementById('btn-close-stats').onclick = () => callbacks.onClose();
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  callbacks = props.callbacks;
  render();
}

export function unmount() {}
