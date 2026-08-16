import { MONSTERS } from '../data/monsters.js';
import { ITEMS } from '../data/items.js';
import { QUEST_REQUIREMENTS, getQuestRewardItemId, canTurnInQuest, turnInQuest } from '../systems/quests.js';

let rootEl = null;
let state = null;
let callbacks = null;

function render() {
  const rows = Object.keys(QUEST_REQUIREMENTS).map((monsterId) => {
    const monster = MONSTERS[monsterId];
    const required = QUEST_REQUIREMENTS[monsterId];
    const progress = state.questProgress[monsterId] || 0;
    const rewardItem = ITEMS[getQuestRewardItemId(monsterId)];
    const complete = canTurnInQuest(state, monsterId);

    return `<div class="quest-row">
      <span>${monster.emoji} ${monster.name}: ${progress}/${required} killed — reward: ${rewardItem.emoji} ${rewardItem.name}</span>
      <button data-monster="${monsterId}" ${complete ? '' : 'disabled'}>Turn In</button>
    </div>`;
  }).join('');

  rootEl.innerHTML = `
    <div class="quest-board-screen">
      <h2>Quest Board</h2>
      ${rows}
      <button id="btn-leave">Leave</button>
    </div>
  `;

  rootEl.querySelectorAll('button[data-monster]').forEach((btn) => {
    btn.onclick = () => turnIn(btn.dataset.monster);
  });
  document.getElementById('btn-leave').onclick = () => callbacks.onLeave();
}

function turnIn(monsterId) {
  if (!canTurnInQuest(state, monsterId)) return;
  Object.assign(state, turnInQuest(state, monsterId));
  callbacks.onTurnIn();
  render();
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  callbacks = props.callbacks;
  render();
}

export function unmount() {}
