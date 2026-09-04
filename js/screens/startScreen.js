import { HERO_EMOJI_OPTIONS, SKIN_TONES, isToneCapableEmoji, applySkinTone } from '../state.js';
import { MONSTERS } from '../data/monsters.js';
import { generateRandomName } from '../data/randomNames.js';

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

// Every skin tone except "Default" (the unmodified, plain-yellow glyph) -
// tiles on the hero-pick grid always show a real skin tone, never the bare
// yellow base, per Timothy's own call to randomize rather than leave them
// uniform.
const RANDOMIZABLE_TONES = SKIN_TONES.filter((tone) => tone.modifier);

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
// Three-step new-game flow (raised 2026-09-03/04): 'closed' (just the save
// list), 'name' (name entry only - no hero/tone controls here anymore),
// 'hero' (the large-tile hero/skin-tone picker, replacing the old inline
// emoji/tone <select> pair entirely). callbacks.onNewGame(name, heroEmoji)
// only fires once 'hero' is confirmed.
let newGameStep = 'closed';
let newGameName = '';
// emoji -> currently-shown tone modifier, re-rolled whenever the 'hero' step
// is entered or Shuffle is pressed. Tone-incapable emoji (see
// isToneCapableEmoji) always map to '' (no modifier available to show).
let heroTileTones = {};
let pickedHero = null;
let pickedTone = '';

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

function randomTone() {
  return RANDOMIZABLE_TONES[Math.floor(Math.random() * RANDOMIZABLE_TONES.length)].modifier;
}

function rollHeroTileTones() {
  heroTileTones = Object.fromEntries(
    HERO_EMOJI_OPTIONS.map((emoji) => [emoji, isToneCapableEmoji(emoji) ? randomTone() : '']),
  );
}

function renderHeroGrid() {
  return HERO_EMOJI_OPTIONS.map((emoji) => {
    const shown = applySkinTone(emoji, heroTileTones[emoji]);
    const picked = emoji === pickedHero ? ' hero-tile-picked' : '';
    return `<button type="button" class="hero-tile${picked}" data-hero="${emoji}" aria-label="Choose ${shown}">${shown}</button>`;
  }).join('');
}

function renderToneSwatches() {
  return SKIN_TONES.filter((tone) => tone.modifier).map((tone) => {
    const picked = tone.modifier === pickedTone ? ' hero-tone-swatch-picked' : '';
    return `<button type="button" class="hero-tone-swatch${picked}" data-tone="${tone.modifier}" aria-label="Skin tone ${tone.label}"></button>`;
  }).join('');
}

function renderHeroPickStep() {
  const toneRow = pickedHero
    ? `<div class="hero-pick-tone-row">
        <div class="hero-pick-avatar">${applySkinTone(pickedHero, pickedTone)}</div>
        ${isToneCapableEmoji(pickedHero)
          ? `<div class="hero-tone-swatches">${renderToneSwatches()}</div>`
          : '<div class="hero-pick-no-tone">This hero has no skin-tone variant.</div>'}
      </div>`
    : '<div class="hero-pick-hint">Pick a hero above</div>';
  return `
    <div class="hero-pick-header">
      <h2 class="hero-pick-title">Choose your hero</h2>
      <button type="button" id="btn-shuffle-tones" title="Re-roll every tile's skin tone">🔀 Shuffle</button>
    </div>
    <div class="hero-grid">${renderHeroGrid()}</div>
    ${toneRow}
    <div class="hero-pick-footer">
      <input type="text" id="hero-pick-name" value="${newGameName}" placeholder="Character name" />
      <button type="button" id="btn-random-character">🎲 Random Character</button>
      <button type="button" id="btn-back-to-name">&larr; Back</button>
      <button type="button" id="btn-create-slot" ${pickedHero ? '' : 'disabled'}>Start Adventure</button>
    </div>
  `;
}

function render() {
  const slotRows = slots.map(renderSlotRow).join('');
  let newGameSection;
  if (newGameStep === 'name') {
    newGameSection = `<div class="new-game-row">
        <input type="text" id="new-game-name" placeholder="Character name" value="${newGameName}" />
        <button id="btn-create-slot">Create</button>
      </div>`;
  } else if (newGameStep === 'closed') {
    newGameSection = `<button id="btn-open-new-game">+ New Game</button>`;
  } else {
    newGameSection = '';
  }

  const bodyHtml = newGameStep === 'hero'
    ? renderHeroPickStep()
    : `<h1 class="start-title">Emoji RPG</h1>
       ${slotRows || '<div class="no-slots">No saves yet.</div>'}
       ${newGameSection}`;

  rootEl.innerHTML = `
    <div class="start-screen">
      ${renderScene()}
      <div class="start-panel${newGameStep === 'hero' ? ' start-panel-hero-pick' : ''}">
        ${bodyHtml}
      </div>
    </div>
  `;

  if (newGameStep === 'hero') {
    bindHeroPickStep();
    return;
  }

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

  if (newGameStep === 'name') {
    const input = document.getElementById('new-game-name');
    input.focus();
    document.getElementById('btn-create-slot').onclick = () => {
      newGameName = input.value.trim() || 'New Game';
      newGameStep = 'hero';
      pickedHero = null;
      pickedTone = '';
      rollHeroTileTones();
      render();
    };
  } else {
    document.getElementById('btn-open-new-game').onclick = () => {
      newGameStep = 'name';
      render();
    };
  }
}

function pickHero(emoji) {
  pickedHero = emoji;
  pickedTone = heroTileTones[emoji] || '';
  render();
}

function bindHeroPickStep() {
  rootEl.querySelectorAll('[data-hero]').forEach((btn) => {
    btn.onclick = () => pickHero(btn.dataset.hero);
  });
  rootEl.querySelectorAll('[data-tone]').forEach((btn) => {
    btn.onclick = () => {
      pickedTone = btn.dataset.tone;
      render();
    };
  });

  document.getElementById('btn-shuffle-tones').onclick = () => {
    rollHeroTileTones();
    if (pickedHero) pickedTone = heroTileTones[pickedHero] || '';
    render();
  };

  const nameInput = document.getElementById('hero-pick-name');
  nameInput.oninput = () => { newGameName = nameInput.value; };

  document.getElementById('btn-random-character').onclick = () => {
    rollHeroTileTones();
    pickedHero = HERO_EMOJI_OPTIONS[Math.floor(Math.random() * HERO_EMOJI_OPTIONS.length)];
    pickedTone = heroTileTones[pickedHero] || '';
    newGameName = generateRandomName();
    render();
  };

  document.getElementById('btn-back-to-name').onclick = () => {
    newGameStep = 'name';
    render();
  };

  const createBtn = document.getElementById('btn-create-slot');
  if (pickedHero) {
    createBtn.onclick = () => {
      const name = newGameName.trim() || 'New Game';
      const heroEmoji = applySkinTone(pickedHero, pickedTone);
      callbacks.onNewGame(name, heroEmoji);
    };
  }
}

export function mount(root, props) {
  rootEl = root;
  slots = props.slots;
  callbacks = props.callbacks;
  confirmDeleteId = null;
  newGameStep = 'closed';
  newGameName = '';
  pickedHero = null;
  pickedTone = '';
  render();
}

export function unmount() {}
