import { HERO_EMOJI_OPTIONS, DEFAULT_HERO_EMOJI } from '../state.js';

let rootEl = null;
let slots = [];
let callbacks = null;
let confirmDeleteId = null;
let newGameOpen = false;

function formatLastPlayed(timestamp) {
  const diffMin = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

function renderSlotRow(slot) {
  const ngBadge = slot.ngPlusCycle > 0 ? ` <span class="slot-ngplus-badge">NG+${slot.ngPlusCycle}</span>` : '';
  const deleteControls = confirmDeleteId === slot.id
    ? `<button data-confirm-delete="${slot.id}">Confirm delete?</button><button data-cancel-delete="${slot.id}">Cancel</button>`
    : `<button data-delete="${slot.id}">Delete</button>`;
  return `
    <div class="slot-row">
      <div class="slot-info">
        <div class="slot-name">${slot.name}${ngBadge}</div>
        <div class="slot-meta">Level ${slot.level} &middot; ${formatLastPlayed(slot.lastPlayed)}</div>
      </div>
      <div class="slot-actions">
        <button data-continue="${slot.id}">Continue</button>
        ${deleteControls}
      </div>
    </div>
  `;
}

function render() {
  const slotRows = slots.map(renderSlotRow).join('');
  const emojiOptions = HERO_EMOJI_OPTIONS.map((emoji) => `<option value="${emoji}">${emoji}</option>`).join('');
  const newGameSection = newGameOpen
    ? `<div class="new-game-row">
        <input type="text" id="new-game-name" placeholder="Character name" />
        <select id="new-game-emoji" aria-label="Hero emoji">${emojiOptions}</select>
        <button id="btn-create-slot">Create</button>
      </div>`
    : `<button id="btn-open-new-game">+ New Game</button>`;

  rootEl.innerHTML = `
    <div class="start-screen">
      <h1>Emoji RPG</h1>
      ${slotRows || '<div class="no-slots">No saves yet.</div>'}
      ${newGameSection}
    </div>
  `;

  slots.forEach((slot) => {
    rootEl.querySelector(`[data-continue="${slot.id}"]`).onclick = () => callbacks.onContinue(slot.id);
    if (confirmDeleteId === slot.id) {
      rootEl.querySelector(`[data-confirm-delete="${slot.id}"]`).onclick = () => callbacks.onDelete(slot.id);
      rootEl.querySelector(`[data-cancel-delete="${slot.id}"]`).onclick = () => {
        confirmDeleteId = null;
        render();
      };
    } else {
      rootEl.querySelector(`[data-delete="${slot.id}"]`).onclick = () => {
        confirmDeleteId = slot.id;
        render();
      };
    }
  });

  if (newGameOpen) {
    const input = document.getElementById('new-game-name');
    input.focus();
    document.getElementById('btn-create-slot').onclick = () => {
      const name = input.value.trim() || 'New Game';
      const heroEmoji = document.getElementById('new-game-emoji').value || DEFAULT_HERO_EMOJI;
      callbacks.onNewGame(name, heroEmoji);
    };
  } else {
    document.getElementById('btn-open-new-game').onclick = () => {
      newGameOpen = true;
      render();
    };
  }
}

export function mount(root, props) {
  rootEl = root;
  slots = props.slots;
  callbacks = props.callbacks;
  confirmDeleteId = null;
  newGameOpen = false;
  render();
}

export function unmount() {}
