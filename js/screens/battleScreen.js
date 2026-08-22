import { MONSTERS } from '../data/monsters.js';
import { ITEMS } from '../data/items.js';
import { tickGauge, isReady, ATB_MAX, pickAppearLine, applyEnemySlow, resolvePlayerAttack, resolveMonsterAttack, resolvePotionUse, resolveWeakMobEncounter, applyKnockback, ATB_KNOCKBACK } from '../systems/combat.js';
import { getEquipmentBonuses, removeItem } from '../systems/inventory.js';
import { ABILITIES, getUnlockedAbilities, tickCooldowns, createBuffState, activateBuff, tickBuff, resolveAbilityUse, resolveDelayedHit, createDefenseDebuff, tickDefenseDebuff, applyDefenseDebuff, resolveTimingHit } from '../systems/abilities.js';
import { createWindupState, startWindup, tickWindup, isWindupComplete, windupElapsedPercent, resolveParryAttempt, rollIncomingDamage, resolveParrySuccess } from '../systems/parry.js';

const VICTORY_PAUSE_MS = 1200;
// Matches showDamageNumber's own lifetime: a killing blow's damage number/
// flash/shake needs this long on screen before the slot can be hidden, since
// hiding it and playing the effect happen in the same synchronous call and
// the browser only paints the final DOM state - reordering the two calls
// within one tick can't make an already-hidden element's effect visible.
const DEATH_HIDE_DELAY_MS = 900;
const TIMING_METER_DURATION_MS = 1000;
const TIMING_SWEET_SPOT_START = 80;
const TIMING_SWEET_SPOT_END = 100;

let rootEl = null;
let state = null;
let monsterIds = [];
let monsterOverridesList = [];
let callbacks = null;
let intervalId = null;
let playerCombatant = null;
let monsterCombatants = [];
let selectedMonsterIndex = 0;
let battleOver = false;
let log = [];
let elements = {};
let endBattleTimeoutId = null;
let abilityCooldowns = {};
let buffState = createBuffState();
let comboState = {};
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

function buildMonsterCombatant(monsterId, overrides) {
  const monster = { ...MONSTERS[monsterId], ...(overrides || {}) };
  const enemySlowPercent = getEquipmentBonuses(state).enemySlowPercent;
  const speed = applyEnemySlow(monster.speed, enemySlowPercent);
  return {
    monsterId,
    name: monster.name, emoji: monster.emoji,
    hp: monster.hp, maxHp: monster.hp,
    attack: monster.attack, defense: monster.defense, speed,
    atb: 0,
    windup: createWindupState(),
    defenseDebuff: null,
    pendingDelayedHit: null,
  };
}

function percent(value, max) {
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function livingIndices() {
  return monsterCombatants.map((mc, i) => i).filter((i) => monsterCombatants[i].hp > 0);
}

function cycleTarget(direction) {
  const living = livingIndices();
  if (living.length === 0) return;
  const currentPos = living.indexOf(selectedMonsterIndex);
  const nextPos = currentPos === -1
    ? 0
    : (currentPos + direction + living.length) % living.length;
  selectedMonsterIndex = living[nextPos];
  updateMonsterSelection();
}

function updateMonsterSelection() {
  monsterCombatants.forEach((mc, i) => {
    elements.monsterZones[i].classList.toggle('battle-monster-slot-selected', i === selectedMonsterIndex);
    elements.monsterZones[i].classList.toggle('battle-monster-slot-dim', i !== selectedMonsterIndex && mc.hp > 0);
  });
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

function monsterSlotHtml(mc, index) {
  return `
          <div class="battle-combatant battle-monster-slot" id="battle-monster-zone-${index}">
            <div class="battle-emoji battle-monster-emoji" id="battle-monster-emoji-${index}">${mc.emoji}</div>
            <div class="battle-name">${mc.name}</div>
            <div class="battle-hp-bar"><div class="battle-hp-fill" id="battle-monster-hp-fill-${index}"></div></div>
            <div class="battle-hp-text" id="battle-monster-hp-text-${index}"></div>
            <div class="battle-atb-bar" id="battle-monster-atb-bar-${index}">
              <div class="battle-parry-zone"></div>
              <div class="battle-atb-fill" id="battle-monster-atb-fill-${index}"></div>
            </div>
            <div class="battle-parry-hint" id="battle-parry-hint-${index}"></div>
          </div>`;
}

function buildDom() {
  const envClass = isCaveBattle() ? 'battle-screen-cave' : 'battle-screen-forest';
  rootEl.innerHTML = `
    <div class="overlay-panel battle-screen ${envClass}">
      <div class="battle-main">
        <div class="battle-combatants-row">
          <div class="battle-decoration">${battleDecorationHtml()}</div>
          <div class="battle-monster-row" id="battle-monster-row">
            ${monsterCombatants.map((mc, i) => monsterSlotHtml(mc, i)).join('')}
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
    monsterRow: document.getElementById('battle-monster-row'),
    monsterZones: monsterCombatants.map((_, i) => document.getElementById(`battle-monster-zone-${i}`)),
    monsterEmojis: monsterCombatants.map((_, i) => document.getElementById(`battle-monster-emoji-${i}`)),
    monsterHpFills: monsterCombatants.map((_, i) => document.getElementById(`battle-monster-hp-fill-${i}`)),
    monsterHpTexts: monsterCombatants.map((_, i) => document.getElementById(`battle-monster-hp-text-${i}`)),
    monsterAtbFills: monsterCombatants.map((_, i) => document.getElementById(`battle-monster-atb-fill-${i}`)),
    monsterAtbBars: monsterCombatants.map((_, i) => document.getElementById(`battle-monster-atb-bar-${i}`)),
    parryHints: monsterCombatants.map((_, i) => document.getElementById(`battle-parry-hint-${i}`)),
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
  monsterCombatants.forEach((mc, i) => {
    elements.monsterHpFills[i].style.width = `${percent(mc.hp, mc.maxHp)}%`;
    elements.monsterHpTexts[i].textContent = `HP ${mc.hp}/${mc.maxHp}`;
    const zone = elements.monsterZones[i];
    if (mc.hp <= 0) {
      // Defer hiding the slot until the killing blow's own hit effect has
      // had time to play, rather than hiding it in this same synchronous
      // call (see DEATH_HIDE_DELAY_MS). Only schedule once per death.
      if (!zone.classList.contains('battle-monster-slot-dead') && !zone.dataset.deathHidePending) {
        zone.dataset.deathHidePending = '1';
        setTimeout(() => {
          delete zone.dataset.deathHidePending;
          zone.classList.add('battle-monster-slot-dead');
        }, DEATH_HIDE_DELAY_MS);
      }
    } else {
      zone.classList.remove('battle-monster-slot-dead');
    }
  });
  elements.heroHpFill.style.width = `${percent(playerCombatant.hp, playerCombatant.maxHp)}%`;
  elements.heroHpText.textContent = `HP ${playerCombatant.hp}/${playerCombatant.maxHp}`;
  if (monsterCombatants[selectedMonsterIndex] && monsterCombatants[selectedMonsterIndex].hp <= 0) {
    cycleTarget(1);
  }
}

function updateAtbBars() {
  monsterCombatants.forEach((mc, i) => {
    const winding = mc.windup.active && mc.hp > 0;
    const monsterAtbPercent = winding
      ? windupElapsedPercent(mc.windup)
      : percent(mc.atb, ATB_MAX);
    elements.monsterAtbFills[i].style.width = `${monsterAtbPercent}%`;
    elements.monsterAtbBars[i].classList.toggle('battle-atb-bar-windup', winding);
    elements.parryHints[i].textContent = winding ? 'Parry! (s)' : '';
  });
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
    // A primed payoff (e.g. Chop after Stab landed) can be pressed even
    // before the swing timer is full - that's the "instant" combo feel.
    // A primed setup's return bonus (e.g. Stab after Chop landed) does NOT
    // get this bypass, only the extra damage - see Global Constraints.
    const comboPrimed = !!comboState[ability.id];
    const comboSkipsReady = comboPrimed && ability.comboRole === 'payoff';
    const disabled = locked || cooldownRemaining > 0 || (!ready && !comboSkipsReady);
    const cooldownSuffix = cooldownRemaining > 0 ? ` ${Math.ceil(cooldownRemaining / 1000)}s` : '';
    const comboSuffix = comboPrimed
      ? (ability.comboRole === 'payoff' ? ' ⚡ Combo Ready' : ' ⚡ Bonus Ready')
      : '';
    const label = `${ability.name} (${slot})${cooldownSuffix}${comboSuffix}`;
    const comboClass = comboPrimed ? ' battle-ability-button-combo' : '';
    return `<button id="btn-ability-${ability.id}" class="battle-ability-button${comboClass}" ${disabled ? 'disabled' : ''}>${label}</button>`;
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
  if (key === 's' || key === 'S') {
    // 's' collides with the map screen's WASD-south binding; this is only
    // safe because screenManager.js's mountOverlay() calls pause() on the
    // underlying screen, detaching its keydown listener while this overlay
    // is mounted. If a battle is ever shown without that pause, this would
    // also move the hero on the map underneath.
    //
    // Global sweep, not a targeted parry: every monster currently sitting in
    // its own parry zone at this exact instant gets parried in one press,
    // regardless of which monster is selected. This is a deliberate design
    // choice (see docs/superpowers/specs/2026-08-21-multi-mob-encounters-design.md) -
    // clicking a specific monster's own ATB bar/hint stays scoped to just
    // that monster (see mount()'s per-monster onclick wiring).
    for (const mc of monsterCombatants) {
      if (mc.hp > 0 && mc.windup.active && resolveParryAttempt(windupElapsedPercent(mc.windup))) {
        resolveMonsterWindup(mc, true);
      }
    }
    return;
  }
  if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Tab') {
    event.preventDefault();
    cycleTarget(key === 'ArrowLeft' ? -1 : 1);
    return;
  }
  if (key === 'i' || key === 'I') {
    playerUseItem();
    return;
  }
  if (key === 'a' || key === 'A') {
    if (!isReady(playerCombatant.atb)) return;
    playerAttack();
  } else if (key === 'Escape' || key === 'f' || key === 'F') {
    if (!isReady(playerCombatant.atb)) return;
    playerFlee();
  } else if (key >= '1' && key <= '5') {
    const ability = ABILITIES[Number(key) - 1];
    const locked = state.player.level < ability.unlockLevel;
    const onCooldown = (abilityCooldowns[ability.id] || 0) > 0;
    // Mirrors abilityButtonsHtml()'s comboSkipsReady bypass: a primed payoff
    // can be triggered via keyboard shortcut even before the swing timer is
    // full, matching what its button already allows via mouse click.
    const comboSkipsReady = !!comboState[ability.id] && ability.comboRole === 'payoff';
    if (!locked && !onCooldown && (isReady(playerCombatant.atb) || comboSkipsReady)) {
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
  // Capture the target's index now: updateHpBars() below can re-anchor
  // selectedMonsterIndex to a survivor the instant this hit is a killing
  // blow, so re-reading selectedMonsterIndex after that point would make the
  // hit effect render on the wrong (undamaged) monster.
  const targetIndex = selectedMonsterIndex;
  const target = monsterCombatants[targetIndex];
  const result = resolvePlayerAttack(playerCombatant, applyDefenseDebuff(target, target.defenseDebuff));
  target.hp = result.monsterHp;
  target.atb = result.monsterAtb;
  playerCombatant.atb = result.playerAtb;
  log.push(result.isCrit
    ? `Critical! You hit ${target.name} for ${result.damage}!`
    : `You hit ${target.name} for ${result.damage}.`);
  // Play the hit effect before updateHpBars() hides a killed monster's slot
  // (display: none), so a killing blow's damage number/flash/shake is
  // actually visible instead of rendering onto an already-hidden element.
  playHitEffect(elements.monsterZones[targetIndex], elements.monsterEmojis[targetIndex], result.damage, result.isCrit);
  updateHpBars();
  updateAtbBars();
  updateLog();
  checkOutcome();
  updateMenu();
}

async function playerUseAbility(abilityId) {
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

    const buffActiveAtPress = buffState.active;
    const comboBonusActive = !!comboState[abilityId];

    if (ability.aoe) {
      const targetIndices = monsterCombatants
        .map((mc, i) => i)
        .filter((i) => monsterCombatants[i].hp > 0);
      const debuffSnapshots = targetIndices.map((i) => monsterCombatants[i].defenseDebuff);
      const timingHit = await runTimingMeter();
      // Same battle-can-end-mid-await hazard as the single-target path below.
      if (battleOver) return;
      targetIndices.forEach((monsterIndex, n) => {
        const mc = monsterCombatants[monsterIndex];
        const result = resolveAbilityUse(playerCombatant, applyDefenseDebuff(mc, debuffSnapshots[n]), ability, buffActiveAtPress, timingHit, comboBonusActive);
        mc.hp = result.monsterHp;
        mc.atb = result.monsterAtb;
        playerCombatant.atb = result.playerAtb;
        mc.defenseDebuff = createDefenseDebuff(ability);
        const timingSuffix = timingHit ? ' Perfect timing!' : '';
        log.push((result.isCrit
          ? `Critical! You use ${ability.name} on ${mc.name} for ${result.damage}!`
          : `You use ${ability.name} on ${mc.name} for ${result.damage}.`) + timingSuffix);
        playHitEffect(elements.monsterZones[monsterIndex], elements.monsterEmojis[monsterIndex], result.damage, result.isCrit);
      });
      abilityCooldowns[abilityId] = ability.cooldownMs;
      comboState[abilityId] = false;
      if (ability.comboPartnerId) {
        comboState[ability.comboPartnerId] = true;
      }
      updateHpBars();
      updateAtbBars();
      updateLog();
      checkOutcome();
      updateMenu();
      return;
    }

    const targetIndex = selectedMonsterIndex;
    const target = monsterCombatants[targetIndex];
    const defenseDebuffAtPress = target.defenseDebuff;
    const timingHit = await runTimingMeter();
    // The battle can end while this await is outstanding - e.g. the monster's
    // own ATB-driven attack (tick() -> monsterAttack(), which is intentionally
    // NOT gated by abilityActionInFlight) can kill the player mid-swing. If it
    // did, don't resolve this ability's damage or call checkOutcome()/endBattle()
    // a second time.
    if (battleOver) return;
    const result = resolveAbilityUse(playerCombatant, applyDefenseDebuff(target, defenseDebuffAtPress), ability, buffActiveAtPress, timingHit, comboBonusActive);
    target.hp = result.monsterHp;
    target.atb = result.monsterAtb;
    playerCombatant.atb = result.playerAtb;
    abilityCooldowns[abilityId] = ability.cooldownMs;
    if (ability.id === 'slash') {
      target.pendingDelayedHit = { amount: resolveDelayedHit(result.damage, ability), dueAtMs: ability.delayedHitDelayMs };
    }
    comboState[abilityId] = false;
    if (ability.comboPartnerId) {
      comboState[ability.comboPartnerId] = true;
    }
    const timingSuffix = timingHit ? ' Perfect timing!' : '';
    log.push((result.isCrit
      ? `Critical! You use ${ability.name} on ${target.name} for ${result.damage}!`
      : `You use ${ability.name} on ${target.name} for ${result.damage}.`) + timingSuffix);
    playHitEffect(elements.monsterZones[targetIndex], elements.monsterEmojis[targetIndex], result.damage, result.isCrit);
    updateHpBars();
    updateAtbBars();
    updateLog();
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
  if (monsterIds.some((id) => MONSTERS[id].isBoss)) {
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

function monsterAttack(monster) {
  const result = resolveMonsterAttack(monster, playerCombatant);
  playerCombatant.hp = result.playerHp;
  playerCombatant.atb = result.playerAtb;
  monster.atb = result.monsterAtb;
  log.push(result.isCrit
    ? `Critical! ${monster.name} hits you for ${result.damage}!`
    : `${monster.name} hits you for ${result.damage}.`);
  updateHpBars();
  updateLog();
  playHitEffect(elements.heroZone, elements.heroEmoji, result.damage, result.isCrit);
  checkOutcome();
}

function resolveMonsterWindup(monster, parried) {
  if (battleOver) return;
  if (monster.hp <= 0) return;
  if (!monster.windup.active) return;
  const elapsedPercent = windupElapsedPercent(monster.windup);
  monster.windup = createWindupState();
  const index = monsterCombatants.indexOf(monster);
  if (parried && resolveParryAttempt(elapsedPercent)) {
    const { damage, isCrit } = rollIncomingDamage(monster, playerCombatant);
    const result = resolveParrySuccess(monster, damage);
    monster.hp = result.monsterHp;
    monster.atb = result.monsterAtb;
    log.push(`You parry ${monster.name}'s attack and strike back for ${result.reflectedDamage}!`);
    // Same ordering fix as playerAttack/playerUseAbility: play the hit effect
    // before updateHpBars() hides a killed monster's slot.
    playHitEffect(elements.monsterZones[index], elements.monsterEmojis[index], result.reflectedDamage, false);
    updateHpBars();
    updateLog();
    checkOutcome();
  } else {
    monsterAttack(monster);
  }
  updateAtbBars();
  updateMenu();
}

function checkOutcome() {
  if (monsterCombatants.every((mc) => mc.hp <= 0)) {
    endBattle('won');
  } else if (playerCombatant.hp <= 0) {
    endBattle('lost');
  }
}

function tick() {
  if (battleOver) return;
  playerCombatant.atb = tickGauge(playerCombatant.atb, playerCombatant.speed, 1);
  abilityCooldowns = tickCooldowns(abilityCooldowns, 300);
  buffState = tickBuff(buffState, 300);

  for (const mc of monsterCombatants) {
    if (mc.hp <= 0) continue;
    mc.atb = tickGauge(mc.atb, mc.speed, 1);
    if (isReady(mc.atb) && !mc.windup.active) {
      mc.windup = startWindup();
    } else if (mc.windup.active) {
      mc.windup = tickWindup(mc.windup, 300);
      if (isWindupComplete(mc.windup)) {
        resolveMonsterWindup(mc, false);
      }
    }
    if (battleOver) return;

    mc.defenseDebuff = tickDefenseDebuff(mc.defenseDebuff, 300);
    if (mc.pendingDelayedHit) {
      mc.pendingDelayedHit.dueAtMs -= 300;
      if (mc.pendingDelayedHit.dueAtMs <= 0) {
        const amount = mc.pendingDelayedHit.amount;
        mc.pendingDelayedHit = null;
        mc.hp = Math.max(0, mc.hp - amount);
        mc.atb = applyKnockback(mc.atb, ATB_KNOCKBACK);
        log.push(`Slash's bleed hits ${mc.name} for ${amount}!`);
        updateHpBars();
        updateAtbBars();
        updateLog();
        const index = monsterCombatants.indexOf(mc);
        playHitEffect(elements.monsterZones[index], elements.monsterEmojis[index], amount, false);
        checkOutcome();
        if (battleOver) return;
      }
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
  const killedMonsterIds = monsterCombatants.filter((mc) => mc.hp <= 0).map((mc) => mc.monsterId);
  updateMenu();
  endBattleTimeoutId = setTimeout(() => {
    callbacks.onBattleEnd(outcome, killedMonsterIds);
  }, VICTORY_PAUSE_MS);
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  monsterIds = props.monsterIds;
  monsterOverridesList = props.monsterOverrides || monsterIds.map(() => null);
  callbacks = props.callbacks;
  battleOver = false;
  log = [pickAppearLine(MONSTERS[monsterIds[0]])];
  playerCombatant = buildPlayerCombatant();
  abilityCooldowns = Object.fromEntries(ABILITIES.map((ability) => [ability.id, 0]));
  buffState = createBuffState();
  comboState = {};
  abilityActionInFlight = false;
  monsterCombatants = monsterIds.map((id, i) => buildMonsterCombatant(id, monsterOverridesList[i]));
  buildDom();
  monsterCombatants.forEach((mc, i) => {
    elements.monsterZones[i].onclick = () => {
      selectedMonsterIndex = i;
      updateMonsterSelection();
    };
    elements.monsterAtbBars[i].onclick = (event) => {
      event.stopPropagation();
      resolveMonsterWindup(mc, true);
    };
    elements.parryHints[i].onclick = (event) => {
      event.stopPropagation();
      resolveMonsterWindup(mc, true);
    };
  });
  selectedMonsterIndex = 0;
  updateMonsterSelection();
  updateHpBars();
  updateAtbBars();

  if (monsterIds.length === 1) {
    const soloMonster = monsterCombatants[0];
    const weakMobOutcome = resolveWeakMobEncounter(playerCombatant, soloMonster, Boolean(MONSTERS[monsterIds[0]].isBoss));
    if (weakMobOutcome) {
      log.push(WEAK_MOB_LOG_MESSAGES[weakMobOutcome](soloMonster.name));
      updateLog();
      playWeakMobFleeEffect(elements.monsterEmojis[0]);
      endBattle(weakMobOutcome);
      return;
    }
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
