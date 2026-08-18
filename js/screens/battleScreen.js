import { MONSTERS } from '../data/monsters.js';
import { ITEMS } from '../data/items.js';
import { tickGauge, isReady, ATB_MAX, pickAppearLine, applyEnemySlow, resolvePlayerAttack, resolveMonsterAttack, resolvePotionUse, resolveWeakMobEncounter } from '../systems/combat.js';
import { getEquipmentBonuses, removeItem } from '../systems/inventory.js';
import { ABILITIES, getUnlockedAbilities, tickCooldowns, createBuffState, tickBuff, resolveAbilityUse } from '../systems/abilities.js';

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
let abilityCooldowns = {};
let buffState = createBuffState();

function buildPlayerCombatant() {
  const bonuses = getEquipmentBonuses(state);
  return {
    emoji: state.player.emoji,
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
  const enemySlowPercent = getEquipmentBonuses(state).enemySlowPercent;
  const speed = applyEnemySlow(monster.speed, enemySlowPercent);
  return {
    name: monster.name, emoji: monster.emoji,
    hp: monster.hp, maxHp: monster.hp,
    attack: monster.attack, defense: monster.defense, speed,
    atb: 0,
  };
}

function percent(value, max) {
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function isCaveBattle() {
  return state.map === 'dungeon' || state.map.startsWith('miniDungeon');
}

function battleDecorationHtml() {
  const emoji = isCaveBattle() ? ['🪨', '⛏️', '🪨', '🪨'] : ['🌲', '🌳', '🌲', '🌳'];
  return emoji.map((e) => `<span>${e}</span>`).join('');
}

function buildDom() {
  const envClass = isCaveBattle() ? 'battle-screen-cave' : 'battle-screen-forest';
  rootEl.innerHTML = `
    <div class="overlay-panel battle-screen ${envClass}">
      <div class="battle-decoration">${battleDecorationHtml()}</div>
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

function abilityButtonsHtml() {
  const unlocked = getUnlockedAbilities(state.player.level);
  return unlocked.map((ability) => {
    const cooldownRemaining = abilityCooldowns[ability.id];
    const disabled = cooldownRemaining > 0 ? 'disabled' : '';
    const label = cooldownRemaining > 0 ? `${ability.name} (${Math.ceil(cooldownRemaining / 1000)}s)` : ability.name;
    return `<button id="btn-ability-${ability.id}" class="battle-ability-button" ${disabled}>${label}</button>`;
  }).join('');
}

function updateMenu() {
  if (battleOver) {
    elements.menu.innerHTML = '';
    return;
  }
  const ready = isReady(playerCombatant.atb);
  const hasPotion = state.inventory.some((entry) => entry.itemId === 'potion' && entry.quantity > 0);

  elements.menu.innerHTML = `
    ${ready ? '<button id="btn-attack">Attack</button>' : ''}
    ${ready ? abilityButtonsHtml() : ''}
    <button id="btn-item" ${hasPotion ? '' : 'disabled'}>Item</button>
    ${ready ? '<button id="btn-flee">Flee</button>' : ''}
  `;
  if (ready) {
    document.getElementById('btn-attack').onclick = playerAttack;
    document.getElementById('btn-flee').onclick = playerFlee;
    for (const ability of getUnlockedAbilities(state.player.level)) {
      const btn = document.getElementById(`btn-ability-${ability.id}`);
      if (btn && !btn.disabled) {
        btn.onclick = () => playerUseAbility(ability.id);
      }
    }
  }
  document.getElementById('btn-item').onclick = playerUseItem;
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

const WEAK_MOB_LOG_MESSAGES = {
  surrender: (name) => `${name} surrenders!`,
  'fled-with-loot': (name) => `${name} flees, dropping loot!`,
  'fled-empty': (name) => `${name} flees!`,
};

function playWeakMobFleeEffect(emojiEl) {
  // Only the emoji animates (shrink + slide away) - it's nested inside the
  // zone, so adding the transform to both would compound into a double
  // shrink/translate instead of one clean flee motion.
  emojiEl.classList.add('battle-flee-shrink');
}

function handleKeydown(event) {
  if (battleOver) return;
  const key = event.key;
  if (key === 'i' || key === 'I') {
    playerUseItem();
    return;
  }
  if (!isReady(playerCombatant.atb)) return;
  if (key === 'a' || key === 'A') {
    playerAttack();
  } else if (key === 'Escape') {
    playerFlee();
  }
}

function playerAttack() {
  const result = resolvePlayerAttack(playerCombatant, monsterCombatant);
  monsterCombatant.hp = result.monsterHp;
  monsterCombatant.atb = result.monsterAtb;
  playerCombatant.atb = result.playerAtb;
  log.push(result.isCrit
    ? `Critical! You hit ${monsterCombatant.name} for ${result.damage}!`
    : `You hit ${monsterCombatant.name} for ${result.damage}.`);
  updateHpBars();
  updateAtbBars();
  updateLog();
  playHitEffect(elements.monsterZone, elements.monsterEmoji, result.damage, result.isCrit);
  checkOutcome();
  updateMenu();
}

function playerUseAbility(abilityId) {
  const ability = ABILITIES.find((a) => a.id === abilityId);
  if (ability.type !== 'damage') return; // superScream (buff) is handled in Task 10
  const result = resolveAbilityUse(playerCombatant, monsterCombatant, ability, buffState.active, false);
  monsterCombatant.hp = result.monsterHp;
  monsterCombatant.atb = result.monsterAtb;
  playerCombatant.atb = result.playerAtb;
  abilityCooldowns[abilityId] = ability.cooldownMs;
  log.push(result.isCrit
    ? `Critical! You use ${ability.name} on ${monsterCombatant.name} for ${result.damage}!`
    : `You use ${ability.name} on ${monsterCombatant.name} for ${result.damage}.`);
  updateHpBars();
  updateAtbBars();
  updateLog();
  playHitEffect(elements.monsterZone, elements.monsterEmoji, result.damage, result.isCrit);
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
  const result = resolvePotionUse(playerCombatant, ITEMS.potion.heal);
  playerCombatant.hp = result.playerHp;
  log.push(result.isCrit
    ? `Critical! You drink a potion and heal ${result.heal}!`
    : `You drink a potion and heal ${result.heal}.`);
  updateHpBars();
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
  const result = resolveMonsterAttack(monsterCombatant, playerCombatant);
  playerCombatant.hp = result.playerHp;
  playerCombatant.atb = result.playerAtb;
  monsterCombatant.atb = result.monsterAtb;
  log.push(result.isCrit
    ? `Critical! ${monsterCombatant.name} hits you for ${result.damage}!`
    : `${monsterCombatant.name} hits you for ${result.damage}.`);
  updateHpBars();
  updateLog();
  playHitEffect(elements.heroZone, elements.heroEmoji, result.damage, result.isCrit);
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
  abilityCooldowns = tickCooldowns(abilityCooldowns, 300);
  buffState = tickBuff(buffState, 300);

  if (isReady(monsterCombatant.atb)) {
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
  log = [pickAppearLine(MONSTERS[monsterId])];
  playerCombatant = buildPlayerCombatant();
  abilityCooldowns = Object.fromEntries(ABILITIES.map((ability) => [ability.id, 0]));
  buffState = createBuffState();
  monsterCombatant = buildMonsterCombatant();
  buildDom();
  updateHpBars();
  updateAtbBars();

  const weakMobOutcome = resolveWeakMobEncounter(playerCombatant, monsterCombatant, Boolean(MONSTERS[monsterId].isBoss));
  if (weakMobOutcome) {
    log.push(WEAK_MOB_LOG_MESSAGES[weakMobOutcome](monsterCombatant.name));
    updateLog();
    playWeakMobFleeEffect(elements.monsterEmoji);
    endBattle(weakMobOutcome);
    return;
  }

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
