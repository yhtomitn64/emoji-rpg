import { ITEMS } from '../data/items.js';
import { xpForLevel } from '../systems/leveling.js';
import { getEquipmentBonuses } from '../systems/inventory.js';
import { tierLabel } from '../systems/itemQuality.js';

const SLOTS = ['weapon', 'head', 'body', 'legs', 'accessory', 'ring1', 'ring2'];
const SLOT_LABELS = { ring1: 'Ring 1', ring2: 'Ring 2' };

let rootEl = null;
let state = null;
let callbacks = null;

function render() {
  const bonuses = getEquipmentBonuses(state);
  const xpNeeded = xpForLevel(state.player.level);

  const equipRows = SLOTS.map((slot) => {
    const itemId = state.equipment[slot];
    const label = SLOT_LABELS[slot] || slot;
    if (!itemId) return `<div class="stats-slot">${label}: (empty)</div>`;
    const item = ITEMS[itemId];
    const level = state.upgrades?.[itemId] || 0;
    const tier = state.equipmentTiers?.[slot];
    return `<div class="stats-slot">${label}: ${item.emoji} ${tierLabel(tier)}${item.name} +${level}</div>`;
  }).join('');

  const effectRows = [
    bonuses.lifestealPercent > 0 ? `<div>Lifesteal: ${bonuses.lifestealPercent}%</div>` : '',
    bonuses.extraSwingChance > 0 ? `<div>Extra Swing Chance: ${bonuses.extraSwingChance}%</div>` : '',
    bonuses.elementalProcChance > 0 ? `<div>Elemental Proc: ${bonuses.elementalProcChance}% chance, +${bonuses.elementalProcDamage} dmg</div>` : '',
  ].join('');

  const ngPlusBadge = state.ngPlusCycle > 0 ? `<div class="ngplus-badge">New Game+${state.ngPlusCycle}</div>` : '';

  rootEl.innerHTML = `
    <div class="overlay-panel stats-panel">
      <h2>Stats</h2>
      ${ngPlusBadge}
      <div>Level ${state.player.level} (XP ${state.player.xp}/${xpNeeded})</div>
      <div>HP: ${state.player.hp}/${state.player.maxHp + bonuses.maxHp}</div>
      <div>Attack: ${state.player.attack + bonuses.attack}</div>
      <div>Defense: ${state.player.defense + bonuses.defense}</div>
      <div>Speed: ${state.player.speed + bonuses.speed}</div>
      <div>Gold: ${state.player.gold}</div>
      ${effectRows}
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
