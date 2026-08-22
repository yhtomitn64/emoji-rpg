import { HERO_EMOJI_OPTIONS, DEFAULT_HERO_EMOJI, SKIN_TONES, isToneCapableEmoji, applySkinTone } from '../state.js';
import { MONSTERS } from '../data/monsters.js';

const SCENE_MONSTERS = [
  { id: 'dragon', top: 4, left: 36, size: 2.6, opacity: 0.55, duration: 5.2, delay: 0 },
  { id: 'boar', top: 10, left: 6, size: 1.6, opacity: 0.4, duration: 3.8, delay: 0.4 },
  { id: 'bat', top: 15, left: 82, size: 1.5, opacity: 0.4, duration: 3.4, delay: 0.9 },
  { id: 'wraith', top: 9, left: 64, size: 1.7, opacity: 0.4, duration: 4.4, delay: 1.3 },
  { id: 'spider', top: 40, left: 91, size: 1.6, opacity: 0.35, duration: 4.0, delay: 0.2 },
  { id: 'snake', top: 62, left: 3, size: 1.6, opacity: 0.35, duration: 3.6, delay: 1.7 },
  { id: 'goblin', top: 22, left: 46, size: 1.6, opacity: 0.35, duration: 4.6, delay: 0.6 },
  { id: 'direWolf', top: 70, left: 89, size: 1.7, opacity: 0.35, duration: 3.9, delay: 1.1 },
  { id: 'orc', top: 80, left: 9, size: 1.7, opacity: 0.35, duration: 4.2, delay: 0.3 },
];

const HORIZON = ['🌲', '⛰️', '🌳', '🏔️', '🌲', '🌳', '⛰️', '🌲', '🌳'];

function renderScene() {
  const monsters = SCENE_MONSTERS.map(({ id, top, left, size, opacity, duration, delay }) => {
    const emoji = MONSTERS[id]?.emoji || '';
    const style = `top:${top}%; left:${left}%; font-size:${size}rem; opacity:${opacity}; animation-duration:${duration}s; animation-delay:${delay}s;`;
    return `<span class="start-scene-monster" style="${style}">${emoji}</span>`;
  }).join('');
  const horizon = HORIZON.map((emoji) => `<span>${emoji}</span>`).join('');
  return `
    <div class="start-scene" aria-hidden="true">
      <div class="start-scene-monsters">${monsters}</div>
      <div class="start-scene-horizon">${horizon}</div>
    </div>
  `;
}

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
  const toneOptions = SKIN_TONES.map((tone) => `<option value="${tone.modifier}">${tone.label}</option>`).join('');
  const newGameSection = newGameOpen
    ? `<div class="new-game-row">
        <input type="text" id="new-game-name" placeholder="Character name" />
        <select id="new-game-emoji" aria-label="Hero emoji">${emojiOptions}</select>
        <select id="new-game-tone" aria-label="Skin tone">${toneOptions}</select>
        <button id="btn-create-slot">Create</button>
      </div>`
    : `<button id="btn-open-new-game">+ New Game</button>`;

  rootEl.innerHTML = `
    <div class="start-screen">
      ${renderScene()}
      <div class="start-panel">
        <h1 class="start-title">Emoji RPG</h1>
        ${slotRows || '<div class="no-slots">No saves yet.</div>'}
        ${newGameSection}
      </div>
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
    const emojiSelect = document.getElementById('new-game-emoji');
    const toneSelect = document.getElementById('new-game-tone');
    input.focus();

    const syncToneAvailability = () => {
      const capable = isToneCapableEmoji(emojiSelect.value);
      toneSelect.disabled = !capable;
      if (!capable) toneSelect.value = '';
    };
    emojiSelect.onchange = syncToneAvailability;
    syncToneAvailability();

    document.getElementById('btn-create-slot').onclick = () => {
      const name = input.value.trim() || 'New Game';
      const baseEmoji = emojiSelect.value || DEFAULT_HERO_EMOJI;
      const heroEmoji = applySkinTone(baseEmoji, toneSelect.value);
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
