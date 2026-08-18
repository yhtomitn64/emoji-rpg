import { MONSTERS } from '../data/monsters.js';
import { ITEMS } from '../data/items.js';
import { tickGauge, isReady, ATB_MAX, pickAppearLine, applyEnemySlow, resolvePlayerAttack, resolveMonsterAttack, resolvePotionUse, resolveWeakMobEncounter, applyKnockback, ATB_KNOCKBACK } from '../systems/combat.js';
import { getEquipmentBonuses, removeItem } from '../systems/inventory.js';
import { ABILITIES, getUnlockedAbilities, tickCooldowns, createBuffState, activateBuff, tickBuff, resolveAbilityUse, resolveDelayedHit, createDefenseDebuff, tickDefenseDebuff, applyDefenseDebuff, resolveTimingHit } from '../systems/abilities.js';

const VICTORY_PAUSE_MS = 1200;
const TIMING_METER_DURATION_MS = 1000;
const TIMING_SWEET_SPOT_START = 80;
const TIMING_SWEET_SPOT_END = 100;

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
let defenseDebuff = null;
let pendingDelayedHit = null;
let abilityActionInFlight = false;

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

function timingMeterHtml() {
  if (getUnlockedAbilities(state.player.level).length === 0) return '';
  return `
        <div class="battle-timing-meter" id="battle-timing-meter">
          <div class="battle-timing-track">
            <div class="battle-timing-sweet-spot" style="left: 80%; width: 20%;"></div>
            <div class="battle-timing-fill" id="battle-timing-fill"></div>
          </div>
        </div>`;
}

function buildDom() {
  const envClass = isCaveBattle() ? 'battle-screen-cave' : 'battle-screen-forest';
  rootEl.innerHTML = `
    <div class="overlay-panel battle-screen ${envClass}">
      <div class="battle-main">
        <div class="battle-combatants-row">
          <div class="battle-decoration">${battleDecorationHtml()}</div>
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
            <div class="battle-buff-indicator" id="battle-buff-indicator"></div>
          </div>
        </div>
        ${timingMeterHtml()}
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
    buffIndicator: document.getElementById('battle-buff-indicator'),
    menu: document.getElementById('battle-menu'),
    log: document.getElementById('battle-log'),
    timingMeter: document.getElementById('battle-timing-meter'),
    timingFill: document.getElementById('battle-timing-fill'),
  };
}

function runTimingMeter() {
  return new Promise((resolve) => {
    // Defensive: the meter track only renders once the player has an
    // unlocked ability (see timingMeterHtml()), and an ability can't be
    // used below that level anyway - so this should be unreachable with a
    // null meter. Resolve as a miss rather than throwing if it ever is.
    if (!elements.timingMeter || !elements.timingFill) {
      resolve(false);
      return;
    }

    elements.timingMeter.classList.add('battle-timing-meter-active');
    const startedAt = performance.now();
    let resolved = false;
    let rafId = null;

    function onKeydown(event) {
      if (event.code !== 'Space' && event.code !== 'Enter') return;
      event.preventDefault();
      const elapsed = performance.now() - startedAt;
      finish(Math.min(100, (elapsed / TIMING_METER_DURATION_MS) * 100));
    }

    function finish(actedAtPercent) {
      if (resolved) return;
      resolved = true;
      cancelAnimationFrame(rafId);
      elements.timingMeter.classList.remove('battle-timing-meter-active');
      elements.timingMeter.onclick = null;
      window.removeEventListener('keydown', onKeydown);
      elements.timingFill.style.width = '0%';
      resolve(resolveTimingHit(actedAtPercent, TIMING_SWEET_SPOT_START, TIMING_SWEET_SPOT_END));
    }

    function frame(now) {
      const elapsed = now - startedAt;
      const percent = Math.min(100, (elapsed / TIMING_METER_DURATION_MS) * 100);
      elements.timingFill.style.width = `${percent}%`;
      if (percent >= 100) {
        finish(-1); // ran out with no input: always a miss, ability still resolves at base value
        return;
      }
      rafId = requestAnimationFrame(frame);
    }

    elements.timingMeter.onclick = () => {
      const elapsed = performance.now() - startedAt;
      finish(Math.min(100, (elapsed / TIMING_METER_DURATION_MS) * 100));
    };

    window.addEventListener('keydown', onKeydown);

    rafId = requestAnimationFrame(frame);
  });
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

function updateBuffIndicator() {
  elements.buffIndicator.textContent = buffState.active
    ? `💪 Super Scream: ${Math.ceil(buffState.remainingMs / 1000)}s`
    : '';
}

function abilityButtonsHtml() {
  const ready = isReady(playerCombatant.atb);
  return ABILITIES.map((ability, index) => {
    const slot = index + 1;
    const locked = state.player.level < ability.unlockLevel;
    const cooldownRemaining = abilityCooldowns[ability.id] || 0;
    const disabled = locked || cooldownRemaining > 0 || !ready;
    const cooldownSuffix = cooldownRemaining > 0 ? ` ${Math.ceil(cooldownRemaining / 1000)}s` : '';
    const label = `${ability.name} (${slot})${cooldownSuffix}`;
    return `<button id="btn-ability-${ability.id}" class="battle-ability-button" ${disabled ? 'disabled' : ''}>${label}</button>`;
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
    <button id="btn-attack" ${ready ? '' : 'disabled'}>Attack (a)</button>
    ${abilityButtonsHtml()}
    <button id="btn-item" ${hasPotion ? '' : 'disabled'}>Item (i)</button>
    <button id="btn-flee" ${ready ? '' : 'disabled'}>Flee (f)</button>
  `;
  document.getElementById('btn-attack').onclick = playerAttack;
  document.getElementById('btn-flee').onclick = playerFlee;
  document.getElementById('btn-item').onclick = playerUseItem;
  for (const ability of ABILITIES) {
    const btn = document.getElementById(`btn-ability-${ability.id}`);
    if (btn) {
      btn.onclick = () => playerUseAbility(ability.id);
    }
  }
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
  } else if (key === 'Escape' || key === 'f' || key === 'F') {
    playerFlee();
  } else if (key >= '1' && key <= '5') {
    const ability = ABILITIES[Number(key) - 1];
    const locked = state.player.level < ability.unlockLevel;
    const onCooldown = (abilityCooldowns[ability.id] || 0) > 0;
    if (!locked && !onCooldown) {
      playerUseAbility(ability.id);
    }
  }
}

function playerAttack() {
  // Same re-entrancy hazard as playerUseAbility's own guard, but from the other
  // direction: while an ability's timing meter is pending, playerCombatant.atb
  // hasn't been reset and updateMenu() hasn't re-rendered, so Attack (button or
  // the 'a' keydown path) is still clickable/pressable. Left unguarded, a
  // resolvePlayerAttack() here could end the battle (checkOutcome -> endBattle)
  // while the pending ability's await is still outstanding - see the
  // `if (battleOver) return;` added after that await below for the other half
  // of this fix.
  if (abilityActionInFlight) return;
  const result = resolvePlayerAttack(playerCombatant, applyDefenseDebuff(monsterCombatant, defenseDebuff));
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

async function playerUseAbility(abilityId) {
  // Guard against re-entrant activation: while a damage ability's timing meter is
  // awaited below, the player's ATB isn't reset yet (that only happens once the
  // await resolves), so a second click/keypress during that ~1s window would
  // otherwise start a second runTimingMeter() concurrently. Both instances share
  // the same `elements.timingMeter` DOM node and `onclick` handler, so the two
  // instances stomp on each other and the meter can be left stuck on-screen,
  // never resolving. This flag makes any overlapping activation attempt a no-op
  // instead.
  if (abilityActionInFlight) return;
  abilityActionInFlight = true;
  try {
    const ability = ABILITIES.find((a) => a.id === abilityId);
    if (ability.type === 'buff') {
      buffState = activateBuff(ability);
      abilityCooldowns[abilityId] = ability.cooldownMs;
      playerCombatant.atb = 0;
      log.push(`You use ${ability.name}! Your attacks hit harder for a while.`);
      updateAtbBars();
      updateBuffIndicator();
      updateLog();
      updateMenu();
      return;
    }
    // Press-time semantics: the player's commitment is the button press, and
    // that's also what the on-screen buff countdown/debuff they're reading
    // refers to. Snapshot both here, before the ~1s timing-meter await, so a
    // buff/debuff that expires mid-meter doesn't silently steal the bonus the
    // player was visibly aiming for when they pressed the button.
    const buffActiveAtPress = buffState.active;
    const defenseDebuffAtPress = defenseDebuff;
    const timingHit = await runTimingMeter();
    // The battle can end while this await is outstanding - e.g. the monster's
    // own ATB-driven attack (tick() -> monsterAttack(), which is intentionally
    // NOT gated by abilityActionInFlight) can kill the player mid-swing. If it
    // did, don't resolve this ability's damage or call checkOutcome()/endBattle()
    // a second time.
    if (battleOver) return;
    const result = resolveAbilityUse(playerCombatant, applyDefenseDebuff(monsterCombatant, defenseDebuffAtPress), ability, buffActiveAtPress, timingHit);
    monsterCombatant.hp = result.monsterHp;
    monsterCombatant.atb = result.monsterAtb;
    playerCombatant.atb = result.playerAtb;
    abilityCooldowns[abilityId] = ability.cooldownMs;
    if (ability.id === 'slash') {
      pendingDelayedHit = { amount: resolveDelayedHit(result.damage, ability), dueAtMs: ability.delayedHitDelayMs };
    }
    if (ability.id === 'sweep') {
      defenseDebuff = createDefenseDebuff(ability);
    }
    const timingSuffix = timingHit ? ' Perfect timing!' : '';
    log.push((result.isCrit
      ? `Critical! You use ${ability.name} on ${monsterCombatant.name} for ${result.damage}!`
      : `You use ${ability.name} on ${monsterCombatant.name} for ${result.damage}.`) + timingSuffix);
    updateHpBars();
    updateAtbBars();
    updateLog();
    playHitEffect(elements.monsterZone, elements.monsterEmoji, result.damage, result.isCrit);
    checkOutcome();
    updateMenu();
  } finally {
    abilityActionInFlight = false;
  }
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
  // Same re-entrancy hazard as playerAttack's guard above: block Flee (button
  // or Escape) while an ability's timing meter is still pending.
  if (abilityActionInFlight) return;
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
  if (battleOver) return;

  defenseDebuff = tickDefenseDebuff(defenseDebuff, 300);
  if (pendingDelayedHit) {
    pendingDelayedHit.dueAtMs -= 300;
    if (pendingDelayedHit.dueAtMs <= 0) {
      const amount = pendingDelayedHit.amount;
      pendingDelayedHit = null;
      monsterCombatant.hp = Math.max(0, monsterCombatant.hp - amount);
      monsterCombatant.atb = applyKnockback(monsterCombatant.atb, ATB_KNOCKBACK);
      log.push(`Slash's bleed hits ${monsterCombatant.name} for ${amount}!`);
      updateHpBars();
      updateAtbBars();
      updateLog();
      playHitEffect(elements.monsterZone, elements.monsterEmoji, amount, false);
      checkOutcome();
    }
  }

  updateAtbBars();
  updateMenu();
  updateBuffIndicator();
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
  defenseDebuff = null;
  pendingDelayedHit = null;
  abilityActionInFlight = false;
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
