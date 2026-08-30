// tools/animation-lab/lab.js
//
// Dev-only UI for designing weapon-swing animations. Reuses the real battle
// screen's CSS/DOM classes (via index.html's <link> to css/styles.css) so
// the preview is what the game will actually render, not a lookalike.
import { ITEMS } from '../../js/data/items.js';

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
