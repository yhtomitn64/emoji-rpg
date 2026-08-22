import { MAX_BOSS_TIER, BOSS_TIER_HP_MULTIPLIER, nextBossTierToAttempt } from '../systems/bossTiers.js';

let rootEl = null;
let callbacks = null;
let text = null;
let showNgPlus = false;
let clearedTiers = [];
let currentTier = 0;

function renderMain() {
  const ngPlusButton = showNgPlus ? '<button id="btn-boss-ngplus">Start New Game+</button>' : '';
  const tierIndicator = clearedTiers.length > 0
    ? `<div class="boss-tier-indicator">${clearedTiers.map((cleared) => (cleared ? '⭐' : '☆')).join(' ')}</div>`
    : '';

  const maxSelectableTier = Math.min(nextBossTierToAttempt(currentTier), MAX_BOSS_TIER);
  const tierButtons = [];
  for (let tier = 0; tier <= maxSelectableTier; tier += 1) {
    const cleared = clearedTiers[tier];
    const hpMultiplier = BOSS_TIER_HP_MULTIPLIER ** tier;
    tierButtons.push(
      `<button data-tier="${tier}">Tier ${tier} (${hpMultiplier}x HP)${cleared ? ' ⭐' : ''}</button>`
    );
  }

  rootEl.innerHTML = `
    <div class="overlay-panel boss-prompt-panel">
      <h2>The Dragon Returns</h2>
      ${tierIndicator}
      <p>${text}</p>
      <div class="boss-tier-buttons">${tierButtons.join('')}</div>
      <button id="btn-boss-not-yet">Not yet</button>
      ${ngPlusButton}
    </div>
  `;

  rootEl.querySelectorAll('button[data-tier]').forEach((btn) => {
    btn.onclick = () => callbacks.onFight(Number(btn.dataset.tier));
  });
  document.getElementById('btn-boss-not-yet').onclick = () => callbacks.onWalkAway();
  if (showNgPlus) {
    document.getElementById('btn-boss-ngplus').onclick = renderConfirm;
  }

  rootEl.querySelector('button[data-tier]').focus();
}

function renderConfirm() {
  rootEl.innerHTML = `
    <div class="overlay-panel boss-prompt-panel">
      <h2>Start New Game+?</h2>
      <p>This resets your map progress. Your level, gear, and gold carry over.</p>
      <button id="btn-ngplus-confirm">Continue</button>
      <button id="btn-ngplus-cancel">Cancel</button>
    </div>
  `;

  document.getElementById('btn-ngplus-confirm').onclick = () => callbacks.onStartNgPlus();
  document.getElementById('btn-ngplus-cancel').onclick = renderMain;
  document.getElementById('btn-ngplus-confirm').focus();
}

export function mount(root, props) {
  rootEl = root;
  callbacks = props.callbacks;
  text = props.text;
  showNgPlus = props.showNgPlus;
  clearedTiers = props.clearedTiers || [];
  currentTier = props.currentTier || 0;
  renderMain();
}

export function unmount() {}
