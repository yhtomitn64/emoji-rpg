import { ITEMS } from '../data/items.js';
import {
  upgradeCost, upgradeItem, MAX_UPGRADE_LEVEL, describeItem, getUpgradeLevel,
  canReforgeToMythic, reforgeToMythic, REFORGE_GOLD_COST, REFORGE_ESSENCE_COST,
} from '../systems/inventory.js';
import { tierLabel } from '../systems/itemQuality.js';

const SLOTS = ['weapon', 'head', 'body', 'legs', 'accessory', 'ring1', 'ring2'];
const SLOT_LABELS = { ring1: 'Ring 1', ring2: 'Ring 2' };

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
    if (!itemId) return `<div class="smith-row">${SLOT_LABELS[slot] || slot}: (empty)</div>`;

    const item = ITEMS[itemId];
    const tier = state.equipmentTiers?.[slot];
    const level = getUpgradeLevel(state, itemId, tier);

    const reforgeEligible = state.ngPlusCycle >= 1 && canReforgeToMythic(state, slot);
    const essenceCount = state.inventory.find((entry) => entry.itemId === 'mythicEssence')?.quantity || 0;
    const canAffordReforge = state.player.gold >= REFORGE_GOLD_COST && essenceCount >= REFORGE_ESSENCE_COST;
    const reforgeButton = reforgeEligible
      ? `<button data-reforge="${slot}" ${canAffordReforge ? '' : 'disabled'}>Reforge to Mythic (${REFORGE_GOLD_COST}g + ${REFORGE_ESSENCE_COST} Essence)</button>`
      : '';

    if (level >= MAX_UPGRADE_LEVEL) {
      return `<div class="smith-row">
      <span title="${describeItem(state, itemId, tier)}">${item.emoji} ${tierLabel(tier)}${item.name} +${level} (MAX)</span>
      ${reforgeButton}
    </div>`;
    }

    const hasUpgradePath = Object.values(ITEMS).some((candidate) => candidate.type === 'material' && candidate.upgradeSlot === slot);
    if (!hasUpgradePath) {
      // Ring slots have no upgrade material defined anywhere in the game
      // (unlike the five original slots, which always have one even when
      // the player doesn't currently hold a copy) - there's no reachable
      // upgrade path here, ever, so skip the select/button entirely rather
      // than show a control that can never work.
      return `<div class="smith-row">
      <span title="${describeItem(state, itemId, tier)}">${item.emoji} ${tierLabel(tier)}${item.name} +${level}</span>
      ${reforgeButton}
    </div>`;
    }

    const cost = upgradeCost(level);
    const materials = materialOptionsForSlot(slot);
    const canAfford = state.player.gold >= cost;
    const options = materials
      .map((m) => `<option value="${m.itemId}" title="${describeItem(state, m.itemId)}">${ITEMS[m.itemId].name} (x${m.quantity})</option>`)
      .join('');

    return `<div class="smith-row">
      <span title="${describeItem(state, itemId, tier)}">${item.emoji} ${tierLabel(tier)}${item.name} +${level}</span>
      <select data-slot="${slot}">${options}</select>
      <button data-slot="${slot}" ${materials.length === 0 || !canAfford ? 'disabled' : ''}>Upgrade (${cost}g)</button>
      ${reforgeButton}
    </div>`;
  }).join('');

  rootEl.innerHTML = `
    <div class="smith-screen">
      <button class="screen-close-x" id="btn-close-x" aria-label="Leave smith">✕</button>
      <h2>Smith (Gold: ${state.player.gold})</h2>
      ${rows}
      <button id="btn-leave">Leave</button>
    </div>
  `;

  rootEl.querySelectorAll('button[data-slot]').forEach((btn) => {
    btn.onclick = () => tryUpgrade(btn.dataset.slot);
  });
  rootEl.querySelectorAll('button[data-reforge]').forEach((btn) => {
    btn.onclick = () => tryReforge(btn.dataset.reforge);
  });
  document.getElementById('btn-leave').onclick = () => callbacks.onLeave();
  document.getElementById('btn-close-x').onclick = () => callbacks.onLeave();
}

// Single-key shortcut alongside Tab-based focus navigation, raised
// 2026-08-28: "what else could help like 'l' for leave or something?"
// Skipped while a <select> has focus (material picker) so it doesn't hijack
// the browser's own type-ahead-to-select-an-option behavior there.
function handleKeydown(event) {
  if (document.activeElement?.tagName === 'SELECT') return;
  if (event.key === 'l' || event.key === 'L') {
    event.preventDefault();
    callbacks.onLeave();
  }
}

function tryUpgrade(slot) {
  const select = rootEl.querySelector(`select[data-slot="${slot}"]`);
  const materialId = select?.value;
  if (!materialId) return;

  const itemId = state.equipment[slot];
  const tier = state.equipmentTiers?.[slot];
  const level = getUpgradeLevel(state, itemId, tier);
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

function tryReforge(slot) {
  try {
    const next = reforgeToMythic(state, slot);
    Object.assign(state, next);
    callbacks.onUpgrade();
  } catch {
    // Not enough gold or essence — button availability already reflects this
  }
  render();
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  callbacks = props.callbacks;
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
