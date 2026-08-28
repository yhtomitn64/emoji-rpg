import { MONSTERS } from '../data/monsters.js';
import { ITEMS } from '../data/items.js';
import { QUEST_REQUIREMENTS, getQuestRewardItemId, getQuestRequirement, getQuestRewardQuantity, canTurnInQuest, turnInQuest } from '../systems/quests.js';
import { describeItem } from '../systems/inventory.js';

let rootEl = null;
let state = null;
let callbacks = null;

function render() {
  const rows = Object.keys(QUEST_REQUIREMENTS).map((monsterId) => {
    const monster = MONSTERS[monsterId];
    const level = state.questLevel[monsterId] || 1;
    const required = getQuestRequirement(monsterId, level);
    const progress = state.questProgress[monsterId] || 0;
    const rewardItemId = getQuestRewardItemId(monsterId);
    const rewardItem = ITEMS[rewardItemId];
    const rewardQuantity = getQuestRewardQuantity(level);
    const complete = canTurnInQuest(state, monsterId);

    return `<div class="quest-row">
      <span title="${describeItem(rewardItemId)}">${monster.emoji} ${monster.name} Lv.${level}: ${progress}/${required} killed — reward: ${rewardItem.emoji} ${rewardItem.name} ×${rewardQuantity}</span>
      <button data-monster="${monsterId}" ${complete ? '' : 'disabled'}>Turn In</button>
    </div>`;
  }).join('');

  const anyComplete = Object.keys(QUEST_REQUIREMENTS).some((monsterId) => canTurnInQuest(state, monsterId));

  rootEl.innerHTML = `
    <div class="quest-board-screen">
      <h2>Quest Board</h2>
      ${rows}
      <button id="btn-turn-in-all" ${anyComplete ? '' : 'disabled'}>Turn In All</button>
      <button id="btn-leave">Leave</button>
    </div>
  `;

  rootEl.querySelectorAll('button[data-monster]').forEach((btn) => {
    btn.onclick = () => turnIn(btn.dataset.monster);
  });
  document.getElementById('btn-turn-in-all').onclick = turnInAll;
  document.getElementById('btn-leave').onclick = () => callbacks.onLeave();
}

// Single-key shortcut alongside Tab-based focus navigation, raised
// 2026-08-28: "what else could help like 'l' for leave or something?"
function handleKeydown(event) {
  if (event.key === 'l' || event.key === 'L') {
    event.preventDefault();
    callbacks.onLeave();
  }
}

function turnIn(monsterId) {
  if (!canTurnInQuest(state, monsterId)) return;
  Object.assign(state, turnInQuest(state, monsterId));
  callbacks.onTurnIn();
  render();
}

function turnInAll() {
  for (const monsterId of Object.keys(QUEST_REQUIREMENTS)) {
    if (canTurnInQuest(state, monsterId)) {
      Object.assign(state, turnInQuest(state, monsterId));
    }
  }
  callbacks.onTurnIn();
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
