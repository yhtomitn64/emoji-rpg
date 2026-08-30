// tools/animation-lab/lab.js
//
// Dev-only UI for designing weapon-swing animations. Reuses the real battle
// screen's CSS/DOM classes (via index.html's <link> to css/styles.css) so
// the preview is what the game will actually render, not a lookalike.
import { ITEMS } from '../../js/data/items.js';
import { buildWaapiKeyframes } from './keyframes.js';

const ABILITY_ICONS = { attack: null, stab: '🥊', chop: '🪓', slash: '⚔️', sweep: '🌪️' };

const abilitySelect = document.getElementById('abilitySelect');
const weaponSelect = document.getElementById('weaponSelect');
const targetCountSelect = document.getElementById('targetCountSelect');
const stage = document.getElementById('labStage');
const monsterRow = document.getElementById('labMonsterRow');
const heroZone = document.getElementById('labHeroZone');
const anchorHandle = document.getElementById('anchorHandle');

function populateWeaponSelect() {
  Object.values(ITEMS)
    .filter((item) => item.slot === 'weapon')
    .forEach((weapon) => {
      const option = document.createElement('option');
      option.value = weapon.id;
      option.textContent = `${weapon.swingEmoji || weapon.emoji} ${weapon.name}`;
      weaponSelect.appendChild(option);
    });
}

function currentSwingEmoji() {
  const abilityId = abilitySelect.value;
  if (ABILITY_ICONS[abilityId]) return ABILITY_ICONS[abilityId];
  const weapon = ITEMS[weaponSelect.value];
  return weapon?.swingEmoji || weapon?.emoji || '👊';
}

function renderTargets() {
  const count = Number(targetCountSelect.value);
  monsterRow.innerHTML = '';
  for (let i = 0; i < count; i += 1) {
    const slot = document.createElement('div');
    slot.className = 'battle-combatant battle-monster-slot';
    slot.id = `labMonsterZone${i}`;
    slot.innerHTML = '<div class="battle-emoji battle-monster-emoji">👹</div><div class="battle-name">Target</div>';
    monsterRow.appendChild(slot);
  }
}

populateWeaponSelect();
renderTargets();
abilitySelect.addEventListener('change', renderTargets);
targetCountSelect.addEventListener('change', renderTargets);
weaponSelect.addEventListener('change', renderTargets);

// Timeline and keyframe editing
const DEFAULT_KEYFRAME = { offset: 0, x: 0, y: 0, dxFactor: 0, dyFactor: 0, rotate: 0, scale: 1 };

let currentDesign = { pinned: false, anchor: { x: 0, y: 0 }, durationMs: 1500, keyframes: [{ ...DEFAULT_KEYFRAME }, { ...DEFAULT_KEYFRAME, offset: 1 }] };
let selectedKeyframeIndex = 0;

const addKeyframeBtn = document.getElementById('addKeyframeBtn');
const removeKeyframeBtn = document.getElementById('removeKeyframeBtn');
const pinnedToggle = document.getElementById('pinnedToggle');
const timelineEl = document.getElementById('timeline');
const kfXInput = document.getElementById('kfX');
const kfYInput = document.getElementById('kfY');
const kfRotateInput = document.getElementById('kfRotate');
const kfScaleInput = document.getElementById('kfScale');

function renderTimeline() {
  timelineEl.innerHTML = '';
  currentDesign.keyframes.forEach((kf, i) => {
    const stop = document.createElement('button');
    stop.textContent = `${Math.round(kf.offset * 100)}%`;
    stop.style.border = i === selectedKeyframeIndex ? '2px solid #fff' : '2px solid #444';
    stop.addEventListener('click', () => selectKeyframe(i));
    timelineEl.appendChild(stop);
  });
  updateAnchorHandlePosition();
}

function selectKeyframe(i) {
  selectedKeyframeIndex = i;
  const kf = currentDesign.keyframes[i];
  kfXInput.value = kf.x;
  kfYInput.value = kf.y;
  kfRotateInput.value = kf.rotate;
  kfScaleInput.value = kf.scale;
  renderTimeline();
}

function updateAnchorHandlePosition() {
  const stageRect = stage.getBoundingClientRect();
  const heroRect = heroZone.getBoundingClientRect();
  const heroCenterX = heroRect.left + heroRect.width / 2 - stageRect.left;
  const heroCenterY = heroRect.top + heroRect.height / 2 - stageRect.top;
  anchorHandle.style.left = `${heroCenterX + currentDesign.anchor.x}px`;
  anchorHandle.style.top = `${heroCenterY + currentDesign.anchor.y}px`;
}

addKeyframeBtn.addEventListener('click', () => {
  currentDesign.keyframes.push({ ...DEFAULT_KEYFRAME, offset: 1 });
  currentDesign.keyframes.sort((a, b) => a.offset - b.offset);
  renderTimeline();
});

removeKeyframeBtn.addEventListener('click', () => {
  if (currentDesign.keyframes.length <= 2) return;
  currentDesign.keyframes.splice(selectedKeyframeIndex, 1);
  selectedKeyframeIndex = 0;
  renderTimeline();
  selectKeyframe(0);
});

pinnedToggle.addEventListener('change', () => {
  currentDesign.pinned = pinnedToggle.checked;
});

[kfXInput, kfYInput, kfRotateInput, kfScaleInput].forEach((input) => {
  input.addEventListener('input', () => {
    const kf = currentDesign.keyframes[selectedKeyframeIndex];
    kf.x = Number(kfXInput.value);
    kf.y = Number(kfYInput.value);
    kf.rotate = Number(kfRotateInput.value);
    kf.scale = Number(kfScaleInput.value);
  });
});

let draggingAnchor = false;
anchorHandle.addEventListener('mousedown', () => { draggingAnchor = true; });
window.addEventListener('mouseup', () => { draggingAnchor = false; });
window.addEventListener('mousemove', (e) => {
  if (!draggingAnchor) return;
  const stageRect = stage.getBoundingClientRect();
  const heroRect = heroZone.getBoundingClientRect();
  const heroCenterX = heroRect.left + heroRect.width / 2;
  const heroCenterY = heroRect.top + heroRect.height / 2;
  currentDesign.anchor.x = e.clientX - heroCenterX;
  currentDesign.anchor.y = e.clientY - heroCenterY;
  updateAnchorHandlePosition();
});

renderTimeline();
selectKeyframe(0);

// Play/preview playback
const playBtn = document.getElementById('playBtn');

function firstTargetZone() {
  return monsterRow.firstElementChild;
}

function playPreview() {
  const targetZone = firstTargetZone();
  if (!targetZone) return;
  const heroRect = heroZone.getBoundingClientRect();
  const targetRect = targetZone.getBoundingClientRect();
  const dx = (targetRect.left + targetRect.width / 2) - (heroRect.left + heroRect.width / 2);
  const dy = (targetRect.top + targetRect.height / 2) - (heroRect.top + heroRect.height / 2);

  const sprite = document.createElement('div');
  sprite.textContent = currentSwingEmoji();
  sprite.className = 'battle-swing-sprite';
  sprite.style.position = 'fixed';
  sprite.style.left = `${heroRect.left + heroRect.width / 2}px`;
  sprite.style.top = `${heroRect.top + heroRect.height / 2}px`;
  document.body.appendChild(sprite);

  const waapiKeyframes = buildWaapiKeyframes(currentDesign, dx, dy);
  const animation = sprite.animate(waapiKeyframes, { duration: currentDesign.durationMs, easing: 'ease-out', fill: 'forwards' });
  animation.onfinish = () => sprite.remove();
}

playBtn.addEventListener('click', playPreview);
