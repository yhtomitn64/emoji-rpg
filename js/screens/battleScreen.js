import { MONSTERS } from '../data/monsters.js';
import { ITEMS } from '../data/items.js';
import { calculateDamage, tickGauge, isReady, ATB_MAX, rollCrit, applyCritMultiplier, pickAppearLine } from '../systems/combat.js';
import { getEquipmentBonuses, removeItem } from '../systems/inventory.js';

const VICTORY_PAUSE_MS = 1200;

let rootEl = null;
let state = null;
let monsterId = null;
let monsterOverrides = null;
let callbacks = null;
let intervalId = null;
let playerCombatant = null;
let monsterCombatant = null;
let battleOver = false;
let log = [];
let elements = {};
let endBattleTimeoutId = null;
let menuVisible = false;

function buildPlayerCombatant() {
  const bonuses = getEquipmentBonuses(state);
  return {
    emoji: '🧑',
    hp: state.player.hp,
    maxHp: state.player.maxHp + bonuses.maxHp,
    attack: state.player.attack + bonuses.attack,
    defense: state.player.defense + bonuses.defense,
    speed: state.player.speed + bonuses.speed,
    atb: 0,
  };
}

function buildMonsterCombatant() {
  const monster = { ...MONSTERS[monsterId], ...(monsterOverrides || {}) };
  return {
    name: monster.name, emoji: monster.emoji,
    hp: monster.hp, maxHp: monster.hp,
    attack: monster.attack, defense: monster.defense, speed: monster.speed,
    atb: 0,
  };
}

function percent(value, max) {
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function buildDom() {
  rootEl.innerHTML = `
    <div class="overlay-panel battle-screen">
      <div class="battle-main">
        <div class="battle-combatant" id="battle-monster-zone">
          <div class="battle-emoji battle-monster-emoji" id="battle-monster-emoji">${monsterCombatant.emoji}</div>
          <div class="battle-name">${monsterCombatant.name}</div>
          <div class="battle-hp-bar"><div class="battle-hp-fill" id="battle-monster-hp-fill"></div></div>
          <div class="battle-hp-text" id="battle-monster-hp-text"></div>
          <div class="battle-atb-bar"><div class="battle-atb-fill" id="battle-monster-atb-fill"></div></div>
        </div>
        <div class="battle-divider">⚔️</div>
        <div class="battle-combatant" id="battle-hero-zone">
          <div class="battle-emoji" id="battle-hero-emoji">${playerCombatant.emoji}</div>
          <div class="battle-name">You</div>
          <div class="battle-hp-bar"><div class="battle-hp-fill battle-hp-fill-hero" id="battle-hero-hp-fill"></div></div>
          <div class="battle-hp-text" id="battle-hero-hp-text"></div>
          <div class="battle-atb-bar"><div class="battle-atb-fill" id="battle-hero-atb-fill"></div></div>
        </div>
        <div class="battle-menu" id="battle-menu"></div>
      </div>
      <div class="battle-sidebar">
        <div class="battle-log-label">Battle Log</div>
        <div class="battle-log" id="battle-log"></div>
      </div>
    </div>
  `;

  elements = {
    monsterZone: document.getElementById('battle-monster-zone'),
    monsterEmoji: document.getElementById('battle-monster-emoji'),
    monsterHpFill: document.getElementById('battle-monster-hp-fill'),
    monsterHpText: document.getElementById('battle-monster-hp-text'),
    monsterAtbFill: document.getElementById('battle-monster-atb-fill'),
    heroZone: document.getElementById('battle-hero-zone'),
    heroEmoji: document.getElementById('battle-hero-emoji'),
    heroHpFill: document.getElementById('battle-hero-hp-fill'),
    heroHpText: document.getElementById('battle-hero-hp-text'),
    heroAtbFill: document.getElementById('battle-hero-atb-fill'),
    menu: document.getElementById('battle-menu'),
    log: document.getElementById('battle-log'),
  };
}

function updateHpBars() {
  elements.monsterHpFill.style.width = `${percent(monsterCombatant.hp, monsterCombatant.maxHp)}%`;
  elements.monsterHpText.textContent = `HP ${monsterCombatant.hp}/${monsterCombatant.maxHp}`;
  elements.heroHpFill.style.width = `${percent(playerCombatant.hp, playerCombatant.maxHp)}%`;
  elements.heroHpText.textContent = `HP ${playerCombatant.hp}/${playerCombatant.maxHp}`;
}

function updateAtbBars() {
  elements.monsterAtbFill.style.width = `${percent(monsterCombatant.atb, ATB_MAX)}%`;
  elements.heroAtbFill.style.width = `${percent(playerCombatant.atb, ATB_MAX)}%`;
}

function updateLog() {
  elements.log.innerHTML = log.map((line) => `<div>${line}</div>`).join('');
  elements.log.scrollTop = elements.log.scrollHeight;
}

function updateMenu() {
  const shouldShow = !battleOver && isReady(playerCombatant.atb);
  if (shouldShow === menuVisible) return;
  menuVisible = shouldShow;

  if (!shouldShow) {
    elements.menu.innerHTML = '';
    return;
  }
  elements.menu.innerHTML = `
    <button id="btn-attack">Attack</button>
    <button id="btn-item">Item</button>
    <button id="btn-flee">Flee</button>
  `;
  document.getElementById('btn-attack').onclick = playerAttack;
  document.getElementById('btn-item').onclick = playerUseItem;
  document.getElementById('btn-flee').onclick = playerFlee;
}

function showDamageNumber(zoneEl, amount, isCrit) {
  const numberEl = document.createElement('div');
  numberEl.textContent = `-${amount}`;
  numberEl.className = 'battle-damage-number' + (isCrit ? ' battle-damage-number-crit' : '');
  zoneEl.appendChild(numberEl);
  setTimeout(() => numberEl.remove(), 900);
}

function playHitEffect(zoneEl, emojiEl, amount, isCrit) {
  emojiEl.classList.add('battle-hit-flash');
  zoneEl.classList.add('battle-hit-shake');
  showDamageNumber(zoneEl, amount, isCrit);
  setTimeout(() => {
    emojiEl.classList.remove('battle-hit-flash');
    zoneEl.classList.remove('battle-hit-shake');
  }, 220);
}

function playReviveEffect(zoneEl, emojiEl) {
  emojiEl.classList.add('battle-revive-glow');
  zoneEl.classList.add('battle-revive-glow');
}

function handleKeydown(event) {
  if (battleOver || !isReady(playerCombatant.atb)) return;
  const key = event.key;
  if (key === 'a' || key === 'A') {
    playerAttack();
  } else if (key === 'i' || key === 'I') {
    playerUseItem();
  } else if (key === 'Escape') {
    playerFlee();
  }
}

function playerAttack() {
  const isCrit = rollCrit();
  let damage = calculateDamage(playerCombatant, monsterCombatant);
  damage = applyCritMultiplier(damage, isCrit);
  monsterCombatant.hp = Math.max(0, monsterCombatant.hp - damage);
  log.push(isCrit ? `Critical! You hit ${monsterCombatant.name} for ${damage}!` : `You hit ${monsterCombatant.name} for ${damage}.`);
  playerCombatant.atb = 0;
  updateHpBars();
  updateAtbBars();
  updateLog();
  playHitEffect(elements.monsterZone, elements.monsterEmoji, damage, isCrit);
  checkOutcome();
  updateMenu();
}

function playerUseItem() {
  const potionEntry = state.inventory.find((entry) => entry.itemId === 'potion' && entry.quantity > 0);
  if (!potionEntry) {
    log.push('No potions left.');
    updateLog();
    return;
  }
  Object.assign(state, removeItem(state, 'potion', 1));
  const heal = ITEMS.potion.heal;
  playerCombatant.hp = Math.min(playerCombatant.maxHp, playerCombatant.hp + heal);
  log.push(`You drink a potion and heal ${heal}.`);
  playerCombatant.atb = 0;
  updateHpBars();
  updateAtbBars();
  updateLog();
  updateMenu();
}

function playerFlee() {
  if (MONSTERS[monsterId].isBoss) {
    log.push('You cannot flee from this battle!');
    playerCombatant.atb = 0;
    updateAtbBars();
    updateLog();
    updateMenu();
    return;
  }
  log.push('You got away safely!');
  updateLog();
  endBattle('fled');
}

function monsterAttack() {
  const isCrit = rollCrit();
  let damage = calculateDamage(monsterCombatant, playerCombatant);
  damage = applyCritMultiplier(damage, isCrit);
  playerCombatant.hp = Math.max(0, playerCombatant.hp - damage);
  log.push(isCrit ? `Critical! ${monsterCombatant.name} hits you for ${damage}!` : `${monsterCombatant.name} hits you for ${damage}.`);
  monsterCombatant.atb = 0;
  updateHpBars();
  updateLog();
  playHitEffect(elements.heroZone, elements.heroEmoji, damage, isCrit);
  checkOutcome();
}

function checkOutcome() {
  if (monsterCombatant.hp <= 0) {
    endBattle('won');
  } else if (playerCombatant.hp <= 0) {
    endBattle('lost');
  }
}

function tick() {
  if (battleOver) return;
  playerCombatant.atb = tickGauge(playerCombatant.atb, playerCombatant.speed, 1);
  monsterCombatant.atb = tickGauge(monsterCombatant.atb, monsterCombatant.speed, 1);

  if (isReady(monsterCombatant.atb) && !isReady(playerCombatant.atb)) {
    monsterAttack();
  }

  updateAtbBars();
  updateMenu();
}

function endBattle(outcome) {
  battleOver = true;
  clearInterval(intervalId);
  state.player.hp = playerCombatant.hp;
  if (outcome === 'lost') {
    playReviveEffect(elements.heroZone, elements.heroEmoji);
  }
  updateMenu();
  endBattleTimeoutId = setTimeout(() => {
    callbacks.onBattleEnd(outcome, monsterId);
  }, VICTORY_PAUSE_MS);
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  monsterId = props.monsterId;
  monsterOverrides = props.monsterOverrides || null;
  callbacks = props.callbacks;
  battleOver = false;
  menuVisible = false;
  log = [pickAppearLine(MONSTERS[monsterId])];
  playerCombatant = buildPlayerCombatant();
  monsterCombatant = buildMonsterCombatant();
  buildDom();
  updateHpBars();
  updateAtbBars();
  updateLog();
  updateMenu();
  intervalId = setInterval(tick, 300);
  window.addEventListener('keydown', handleKeydown);
}

export function unmount() {
  clearInterval(intervalId);
  clearTimeout(endBattleTimeoutId);
  window.removeEventListener('keydown', handleKeydown);
}
