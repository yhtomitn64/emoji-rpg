import { MONSTERS } from '../data/monsters.js';
import { ITEMS } from '../data/items.js';
import { tickGauge, isReady, ATB_MAX, pickAppearLine, applyEnemySlow, resolvePlayerAttack, resolveMonsterAttack, resolvePotionUse, applyKnockback, ATB_KNOCKBACK, attackStreakMultiplier, attackKnockbackMultiplier, attackCooldownMsForStreak, ATTACK_STREAK_FLOOR, ATTACK_STREAK_FLOOR_PER_ABILITY, ATTACK_STREAK_RECOVERY_MS } from '../systems/combat.js';
import { getEquipmentBonuses, removeItem } from '../systems/inventory.js';
import { ABILITIES, getUnlockedAbilities, tickCooldowns, createBuffState, activateBuff, tickBuff, resolveAbilityUse, resolveDelayedHit, createDefenseDebuff, tickDefenseDebuff, applyDefenseDebuff, resolveTimingHit, canUseAbility, estimateAbilityDamage, comboTimingHintUnlocked } from '../systems/abilities.js';
import { createWindupState, startWindup, isWindupComplete, windupElapsedPercent, resolveParryAttempt, rollIncomingDamage, resolveParrySuccess, PARRY_WINDUP_DURATION_MS, PARRY_ZONE_START_PERCENT } from '../systems/parry.js';
import { getEliteAppearLine } from '../systems/eliteEncounter.js';

const VICTORY_PAUSE_MS = 1200;
// Timed to *finish* right as the VICTORY_PAUSE_MS pause ends, not to start
// at the top of it - screenManager.js's unmountOverlay() clears the DOM
// synchronously the instant the pause's own setTimeout fires, so there's no
// window for a CSS exit animation after that point. Playing it immediately
// at the start of the pause would finish early and leave the panel sitting
// static/shrunk for the remainder of the pause, which reads as broken, not
// intentional.
const EXIT_ANIM_MS = 400;
// A killing blow's flash/shake needs this long on screen before the slot can
// be hidden, since hiding it and playing the effect happen in the same
// synchronous call and the browser only paints the final DOM state -
// reordering the two calls within one tick can't make an already-hidden
// element's effect visible. The damage number itself is unaffected by this -
// it's a body-level fixed element (see showDamageNumber), independent of the
// zone's own DOM lifecycle.
const DEATH_HIDE_DELAY_MS = 900;
const TIMING_METER_DURATION_MS = 1000;
const TIMING_SWEET_SPOT_START = 80;
const TIMING_SWEET_SPOT_END = 100;
// Shown once per battle, the first time Attack's decay bottoms out at its
// (ability-lowered) floor - a nudge toward the rotation, not a mechanical
// effect.
const ATTACK_TAUNT_LINES = [
  (name) => `${name} barely flinches - maybe try an ability?`,
  (name) => `${name} yawns through another weak jab.`,
  (name) => `${name} smirks. Is that all you've got?`,
  (name) => `${name} shrugs off your attack without much notice.`,
];

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
// Distinct from battleOver: a battle can end (win/lose/flee) and still sit on
// screen for VICTORY_PAUSE_MS before unmount() actually tears the screen
// down, but unmount() can also happen well before that (e.g. the app force-
// navigates away). Anything resuming after a real awaited delay - the Sweep
// stagger loop below, the trail-ghost spawn timers - needs to check this
// specifically, since battleOver alone doesn't cover an abrupt unmount.
let unmounted = false;
let log = [];
let elements = {};
let endBattleTimeoutId = null;
let exitAnimTimeoutId = null;
let abilityCooldowns = {};
let buffState = createBuffState();
let comboState = {};
let abilityActionInFlight = false;
let attackStreak = 0;
let attackCooldownMs = 0;
let attackTauntShown = false;
let attackStreakIdleMs = 0;
let liveDamageNumbers = [];
let liveSwingSprites = [];
let livePerfectBadges = [];
let playerEffectBonuses = null;

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
    attackStyle: monster.attackStyle, projectileEmoji: monster.projectileEmoji,
    atb: 0,
    windup: createWindupState(),
    defenseDebuff: null,
    pendingDelayedHit: null,
    deathStyle: null,
  };
}

// Lifesteal and elemental proc are each their own small, discrete hook -
// deliberately not a generic "on-hit effect" pipeline, matching how
// crit/knockback/combo bonuses are each their own named mechanic in this
// file already. Called once per monster actually hit by a player action
// (once for a single-target hit, once per monster for an AOE ability).
// damageMultiplier defaults to 1 (abilities' own on-hit effects always land
// at full strength) - the basic Attack call site passes its real
// streakMultiplier instead. Raised 2026-08-29: spammed Attack's own damage
// decays down to a 0% floor (attackStreakMultiplier), but elementalProcDamage
// is a flat stat unrelated to the hit's own damage number, so it kept
// dealing full proc damage even on a 0-damage spammed swing - defeating the
// point of the spam throttle. lifestealPercent needs no equivalent fix: it's
// already a percentage of `damage`, which is already the real, already-
// decayed hit, so it naturally scales down with it.
function applyOnHitEffects(target, damage, damageMultiplier = 1) {
  if (playerEffectBonuses.lifestealPercent > 0) {
    const healAmount = Math.round(damage * playerEffectBonuses.lifestealPercent / 100);
    playerCombatant.hp = Math.min(playerCombatant.maxHp, playerCombatant.hp + healAmount);
  }
  if (playerEffectBonuses.elementalProcChance > 0 && Math.random() * 100 < playerEffectBonuses.elementalProcChance) {
    const procDamage = Math.round(playerEffectBonuses.elementalProcDamage * damageMultiplier);
    target.hp = Math.max(0, target.hp - procDamage);
    log.push(`🔥 Bonus fire damage to ${target.name}: ${procDamage}!`);
  }
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
            <div class="battle-timing-sweet-spot" id="battle-timing-sweet-spot" style="left: 80%; width: 20%;"></div>
            <div class="battle-timing-fill" id="battle-timing-fill"></div>
          </div>
          <div class="battle-timing-hint" id="battle-timing-hint">Press Space!</div>
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
              <div class="battle-parry-zone" id="battle-monster-parry-zone-${index}"></div>
              <div class="battle-atb-fill" id="battle-monster-atb-fill-${index}"></div>
            </div>
            <div class="battle-parry-hint" id="battle-parry-hint-${index}"></div>
          </div>`;
}

function buildDom() {
  const envClass = isCaveBattle() ? 'battle-screen-cave' : 'battle-screen-forest';
  // A dedicated class rather than baking the animation into the base
  // .overlay-panel.battle-screen rule, so this `animation` shorthand can't
  // collide with any other single-class rule on the same element. Fresh
  // element every mount() (see buildDom's own rootEl.innerHTML= above this
  // function's start), so this just plays once on creation - no JS
  // toggling needed.
  rootEl.innerHTML = `
    <div class="overlay-panel battle-screen ${envClass} battle-screen-swirl-in">
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
    dialog: rootEl.querySelector('.overlay-panel.battle-screen'),
    decoration: rootEl.querySelector('.battle-decoration'),
    monsterRow: document.getElementById('battle-monster-row'),
    monsterZones: monsterCombatants.map((_, i) => document.getElementById(`battle-monster-zone-${i}`)),
    monsterEmojis: monsterCombatants.map((_, i) => document.getElementById(`battle-monster-emoji-${i}`)),
    monsterHpFills: monsterCombatants.map((_, i) => document.getElementById(`battle-monster-hp-fill-${i}`)),
    monsterHpTexts: monsterCombatants.map((_, i) => document.getElementById(`battle-monster-hp-text-${i}`)),
    monsterAtbFills: monsterCombatants.map((_, i) => document.getElementById(`battle-monster-atb-fill-${i}`)),
    monsterAtbBars: monsterCombatants.map((_, i) => document.getElementById(`battle-monster-atb-bar-${i}`)),
    monsterParryZones: monsterCombatants.map((_, i) => document.getElementById(`battle-monster-parry-zone-${i}`)),
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
    timingHint: document.getElementById('battle-timing-hint'),
    timingSweetSpot: document.getElementById('battle-timing-sweet-spot'),
  };
}

function runTimingMeter(ability) {
  // The timing bonus zone only means anything once the ability it primes is
  // unlocked - see comboTimingHintUnlocked. The timing hit is still scored
  // underneath so priming "just works" the moment the payoff unlocks, this
  // only hides the visual.
  const showHint = !ability || comboTimingHintUnlocked(ability, state.player.level);
  return new Promise((resolve) => {
    // Defensive: the meter track only renders once the player has an
    // unlocked ability (see timingMeterHtml()), and an ability can't be
    // used below that level anyway - so this should be unreachable with a
    // null meter. Resolve as a miss rather than throwing if it ever is.
    if (!elements.timingMeter || !elements.timingFill || !elements.timingHint) {
      resolve(false);
      return;
    }

    elements.timingMeter.classList.add('battle-timing-meter-active');
    // Same real-time-delayed pulse approach as the parry zone above,
    // timed off TIMING_SWEET_SPOT_START/TIMING_METER_DURATION_MS instead
    // of PARRY_ZONE_START_PERCENT/PARRY_WINDUP_DURATION_MS.
    if (elements.timingSweetSpot) {
      const pulseDelayMs = (TIMING_SWEET_SPOT_START / 100) * TIMING_METER_DURATION_MS;
      elements.timingSweetSpot.style.animation = 'none';
      void elements.timingSweetSpot.offsetWidth; // force reflow so re-triggering restarts the animation
      elements.timingSweetSpot.style.animation = `battle-zone-pulse 0.35s ease-out ${pulseDelayMs}ms`;
    }
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
      elements.timingHint.classList.remove('battle-timing-hint-visible');
      resolve(resolveTimingHit(actedAtPercent, TIMING_SWEET_SPOT_START, TIMING_SWEET_SPOT_END));
    }

    function frame(now) {
      const elapsed = now - startedAt;
      const percent = Math.min(100, (elapsed / TIMING_METER_DURATION_MS) * 100);
      elements.timingFill.style.width = `${percent}%`;
      elements.timingHint.classList.toggle('battle-timing-hint-visible', showHint && percent >= TIMING_SWEET_SPOT_START);
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
        // Spin-in-place + shrink, distinct from the flee effect's
        // shrink-and-slide-sideways - a kill reads as "defeated", a flee
        // reads as "escaped". A crit killing blow can instead roll the
        // split-death variant - see maybeMarkSplitDeath. The split CSS reads
        // the glyph back via attr(data-glyph) (see .battle-death-split in
        // css/styles.css), so it has to be stamped on before the class is
        // added.
        if (mc.deathStyle === 'split') {
          elements.monsterEmojis[i].dataset.glyph = elements.monsterEmojis[i].textContent;
          elements.monsterEmojis[i].classList.add('battle-death-split');
        } else {
          elements.monsterEmojis[i].classList.add('battle-death-spin');
        }
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
  // Keep the persistent HUD's HP readout live during the fight too, not just
  // at endBattle() - raised 2026-08-28: "my HP in the main game window with
  // the map doesn't update while in battle... I look up there sometimes."
  // No persist() here deliberately: a hit lands far more often than the game
  // otherwise writes to localStorage (attack-spam can be sub-second), and
  // mid-battle HP was never guaranteed durable across a reload anyway - only
  // the visible readout needed to stop lying.
  state.player.hp = playerCombatant.hp;
  callbacks.onHpChange?.();
}

function updateAtbBars() {
  monsterCombatants.forEach((mc, i) => {
    const winding = mc.windup.active && mc.hp > 0;
    // While winding, the fill's width comes from the battle-windup-fill CSS
    // animation started in tick() (real-time, matches what resolveParryAttempt
    // checks at keypress) - setting style.width here on every 300ms poll is
    // exactly the stale-snapshot problem that animation replaces, so leave it
    // alone. Once winding ends, clear the animation and fall back to the
    // regular transition-smoothed width for the plain ATB charge-up display.
    if (!winding) {
      elements.monsterAtbFills[i].style.animation = '';
      elements.monsterAtbFills[i].style.width = `${percent(mc.atb, ATB_MAX)}%`;
      elements.monsterParryZones[i].style.animation = '';
    }
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
  const target = monsterCombatants[selectedMonsterIndex];
  return getUnlockedAbilities(state.player.level).map((ability, index) => {
    const slot = index + 1;
    const cooldownRemaining = abilityCooldowns[ability.id] || 0;
    // A primed payoff (e.g. Chop after Stab landed) can be pressed even
    // before the swing timer is full - that's the "instant" combo feel.
    // A primed setup's return bonus (e.g. Stab after Chop landed) does NOT
    // get this bypass, only the extra damage - see Global Constraints.
    const comboPrimed = !!comboState[ability.id];
    const alwaysReady = ability.type === 'buff';
    const disabled = !canUseAbility({ locked: false, onCooldown: cooldownRemaining > 0, ready, comboPrimed, comboRole: ability.comboRole, alwaysReady });
    // A primed payoff bypasses its own cooldown (see canUseAbility) - don't
    // show a stale countdown on a button that's actually already pressable.
    const comboSkipsCooldown = comboPrimed && ability.comboRole === 'payoff';
    const cooldownSuffix = cooldownRemaining > 0 && !comboSkipsCooldown ? ` ${Math.ceil(cooldownRemaining / 1000)}s` : '';
    const comboSuffix = comboPrimed
      ? (ability.comboRole === 'payoff' ? ' ⚡ Combo Ready' : ' ⚡ Bonus Ready')
      : '';
    const keyLabel = alwaysReady ? 'Space' : slot;
    // Excludes crit/timing luck (unknowable before pressing) - see estimateAbilityDamage.
    const damageSuffix = ability.type === 'damage' && target
      ? ` ~${estimateAbilityDamage(playerCombatant, applyDefenseDebuff(target, target.defenseDebuff), ability, buffState.active, comboPrimed)}`
      : '';
    const label = `${ability.icon} ${ability.name} (${keyLabel})${cooldownSuffix}${comboSuffix}${damageSuffix}`;
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
  const attackDecayPercent = Math.round((1 - attackStreakMultiplier(attackStreak, getUnlockedAbilities(state.player.level).length)) * 100);
  const attackDecaySuffix = attackDecayPercent > 0 ? ` -${attackDecayPercent}%` : '';

  elements.menu.innerHTML = `
    <button id="btn-attack" ${attackCooldownMs > 0 ? 'disabled' : ''}>Attack (a)${attackDecaySuffix}</button>
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

const DAMAGE_NUMBER_DURATION_MS = 1400;
const CRIT_SHAKE_DURATION_MS = 340;

function showDamageNumber(zoneEl, amount, isCrit) {
  // Fixed-positioned on <body> (from the zone's live screen position) rather
  // than absolute-inside-zoneEl, so the float isn't clipped by the dialog's
  // `overflow: hidden` - lets it rise above the dialog entirely.
  const rect = zoneEl.getBoundingClientRect();
  const numberEl = document.createElement('div');
  numberEl.textContent = `-${amount}`;
  numberEl.className = 'battle-damage-number' + (isCrit ? ' battle-damage-number-crit' : '');
  numberEl.style.left = `${rect.left + rect.width / 2}px`;
  numberEl.style.top = `${rect.top + 10}px`;
  document.body.appendChild(numberEl);
  const timeoutId = setTimeout(() => {
    numberEl.remove();
    liveDamageNumbers = liveDamageNumbers.filter((n) => n.timeoutId !== timeoutId);
  }, DAMAGE_NUMBER_DURATION_MS);
  liveDamageNumbers.push({ el: numberEl, timeoutId });
}

const PERFECT_TIMING_BADGE_MS = 900;

// Distinct from both the plain hit-flash and the crit sway - a reward for
// a skill-based read (ability timing-hit or a landed parry), not a damage
// roll. Same fixed-on-<body> pattern as showDamageNumber, for the same
// reason: escapes the dialog's `overflow: hidden` so it can rise clear of it.
// `text`/`variantClass` let a landed parry reuse the same pop animation with
// its own wording and color (see playParryEffect) instead of the generic
// ability-timing-hit "PERFECT!" look.
function playPerfectTimingEffect(zoneEl, text = 'PERFECT!', variantClass = null) {
  if (!zoneEl) return;
  const rect = zoneEl.getBoundingClientRect();
  const badgeEl = document.createElement('div');
  badgeEl.textContent = text;
  badgeEl.className = variantClass ? `battle-perfect-timing-badge ${variantClass}` : 'battle-perfect-timing-badge';
  badgeEl.style.left = `${rect.left + rect.width / 2}px`;
  badgeEl.style.top = `${rect.top + rect.height / 2}px`;
  document.body.appendChild(badgeEl);
  const timeoutId = setTimeout(() => {
    badgeEl.remove();
    livePerfectBadges = livePerfectBadges.filter((b) => b.timeoutId !== timeoutId);
  }, PERFECT_TIMING_BADGE_MS);
  livePerfectBadges.push({ el: badgeEl, timeoutId });
}

// Raised 2026-08-28: "that dialog moving for in battle stuff is too much" -
// the dialog-level shake this used to also trigger (.battle-dialog-shake-crit)
// is gone; only the character-level sway remains.
function playCritReaction(decorationEl) {
  if (decorationEl) {
    decorationEl.classList.add('battle-decoration-sway-crit');
    setTimeout(() => decorationEl.classList.remove('battle-decoration-sway-crit'), CRIT_SHAKE_DURATION_MS);
  }
}

const PARRY_FLASH_MS = 220;

// Raised 2026-08-29: a landed parry had no clear visual telling the player it
// worked, beyond the same generic "PERFECT!" badge an ability timing-hit
// shows on the *monster*. Distinct wording/color (gold, not the timing-hit's
// cyan) plus a flash on the hero's own emoji - the same "the thing that
// reacted lights up" pattern playHitEffect already uses for a hit landing.
function playParryEffect(zoneEl, emojiEl) {
  playPerfectTimingEffect(zoneEl, 'PARRY!', 'battle-perfect-timing-badge-parry');
  if (emojiEl) {
    emojiEl.classList.add('battle-parry-flash');
    setTimeout(() => emojiEl.classList.remove('battle-parry-flash'), PARRY_FLASH_MS);
  }
}

function playHitEffect(zoneEl, emojiEl, amount, isCrit) {
  emojiEl.classList.add('battle-hit-flash');
  zoneEl.classList.add('battle-hit-shake');
  showDamageNumber(zoneEl, amount, isCrit);
  if (isCrit) {
    playCritReaction(elements.decoration);
  }
  setTimeout(() => {
    emojiEl.classList.remove('battle-hit-flash');
    zoneEl.classList.remove('battle-hit-shake');
  }, 220);
}

const MELEE_LUNGE_MS = 300;
const RANGED_PROJECTILE_MS = 350;

function playMeleeLunge(emojiEl) {
  emojiEl.classList.add('battle-monster-lunge');
  setTimeout(() => emojiEl.classList.remove('battle-monster-lunge'), MELEE_LUNGE_MS);
}

function playRangedProjectile(monster, monsterZoneEl, heroZoneEl) {
  const startRect = monsterZoneEl.getBoundingClientRect();
  const endRect = heroZoneEl.getBoundingClientRect();
  const startX = startRect.left + startRect.width / 2;
  const startY = startRect.top + startRect.height / 2;
  const dx = (endRect.left + endRect.width / 2) - startX;
  const dy = (endRect.top + endRect.height / 2) - startY;
  const projectileEl = document.createElement('div');
  projectileEl.textContent = monster.projectileEmoji;
  projectileEl.className = 'battle-projectile';
  projectileEl.style.left = `${startX}px`;
  projectileEl.style.top = `${startY}px`;
  document.body.appendChild(projectileEl);
  const animation = projectileEl.animate(
    [
      { transform: 'translate(-50%, -50%) translate(0, 0)' },
      { transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px)` },
    ],
    { duration: RANGED_PROJECTILE_MS, easing: 'ease-in' },
  );
  animation.onfinish = () => projectileEl.remove();
}

// Themed windup for a monster's own attack - a quick lunge-and-snap-back for
// melee monsters, or a projectile flying monster -> hero for ranged ones
// (js/data/monsters.js's attackStyle/projectileEmoji). Purely presentational:
// callers still apply damage/log/hit-effect on their own timing around this.
function playMonsterAttackWindup(monster, monsterIndex) {
  const emojiEl = elements.monsterEmojis[monsterIndex];
  const zoneEl = elements.monsterZones[monsterIndex];
  if (!emojiEl || !zoneEl) return;
  if (monster.attackStyle === 'ranged') {
    playRangedProjectile(monster, zoneEl, elements.heroZone);
  } else {
    playMeleeLunge(emojiEl);
  }
}

// Slowed way down from the originally-shipped 220-350ms during live
// troubleshooting 2026-08-30 (see the matching .battle-swing-sprite comment
// in css/styles.css) - confirmed this reads much better, keeping it.
const SWING_DURATION_MS = {
  // ANIMATION-DESIGNER:attack:DURATION:START
  attack: 1500,
  // ANIMATION-DESIGNER:attack:DURATION:END
  // ANIMATION-DESIGNER:stab:DURATION:START
  stab: 1500,
  // ANIMATION-DESIGNER:stab:DURATION:END
  // ANIMATION-DESIGNER:chop:DURATION:START
  chop: 1500,
  // ANIMATION-DESIGNER:chop:DURATION:END
  // ANIMATION-DESIGNER:slash:DURATION:START
  slash: 1500,
  // ANIMATION-DESIGNER:slash:DURATION:END
};

// Attack has no ability object/icon of its own to swing - falls back to
// whatever's actually equipped (js/data/items.js's own emoji per weapon),
// so an unarmed player (weapon slot unequipped via the inventory screen -
// js/systems/inventory.js's unequipItem allows this) still gets *something*
// rather than a blank sprite.
function swingSpriteEmoji(ability) {
  if (ability) return ability.icon;
  const weaponId = state.equipment.weapon;
  const weapon = ITEMS[weaponId];
  // swingEmoji (js/data/items.js) overrides a weapon's own display emoji for
  // this one purpose - a few weapons (Dragon Fang Blade, Fossil Fang,
  // Vampiric Fang) use a body-part pun as their inventory icon, which reads
  // fine in a gear list but not as a swung weapon.
  return weapon?.swingEmoji || weapon?.emoji || '👊';
}

// Shared by every ability's generated case inside swingKeyframesFor below -
// kept here as hand-written plumbing (not inside any ANIMATION-DESIGNER
// marker block) since it's identical logic for every ability, not
// per-ability data. Mirrors tools/animation-lab/keyframes.js's own
// buildTransform() byte-for-byte - if one changes, change the other by
// hand and add a matching case to tests/animationLabKeyframes.test.js.
//
// Pinned: rotates around the fixed `anchor` with the glyph riding a
// rotating arm out to its keyframe position - the CSS transform function
// list composes like nested coordinate frames, so `translate(anchor)
// rotate(deg) translate(arm)` moves the origin to anchor, rotates that
// frame, then places the glyph arm-px out from the rotated origin.
// Free: matches every existing swing's prior behavior exactly - rotates
// the glyph about its own center while translating it along the path.
function resolveXY(point, dx, dy) {
  return {
    x: point.x + dx * (point.dxFactor ?? 0),
    y: point.y + dy * (point.dyFactor ?? 0),
  };
}

function buildTransform(pinned, anchor, kf, dx, dy) {
  const { x, y } = resolveXY(kf, dx, dy);
  if (pinned) {
    const { x: ax, y: ay } = resolveXY(anchor, dx, dy);
    const armX = x - ax;
    const armY = y - ay;
    return `translate(-50%, -50%) translate(${ax}px, ${ay}px) rotate(${kf.rotate}deg) translate(${armX}px, ${armY}px) scale(${kf.scale})`;
  }
  return `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${kf.rotate}deg) scale(${kf.scale})`;
}

// Distinct motion per ability - a stab thrusts straight in, a chop arcs down
// from overhead, a slash wipes diagonally across, and the bare Attack (no
// ability, no icon) gets a smaller plain jab. dx/dy are the target zone's
// center offset from the swing's start position (hero zone or, for a Sweep
// waypoint, the previous target). Each case's ANIMATION literal is a
// hand-transcribed copy of tools/animation-lab/designs/<ability>.json (see
// buildTransform above) - Animation Lab (tools/animation-lab/) regenerates
// the code between each case's ANIMATION-DESIGNER markers, it doesn't read
// the JSON at runtime.
function swingKeyframesFor(abilityId, dx, dy) {
  switch (abilityId) {
    // ANIMATION-DESIGNER:stab:KEYFRAMES:START
    case 'stab': {
      const ANIMATION = {"pinned":false,"anchor":{"x":0,"y":0},"keyframes":[{"offset":0,"x":0,"y":0,"dxFactor":0,"dyFactor":0,"rotate":135,"scale":1},{"offset":0.5,"x":0,"y":0,"dxFactor":0.7,"dyFactor":0.7,"rotate":135,"scale":1},{"offset":1,"x":0,"y":0,"dxFactor":0,"dyFactor":0,"rotate":135,"scale":1}]};
      return ANIMATION.keyframes.map((kf) => ({ transform: buildTransform(ANIMATION.pinned, ANIMATION.anchor, kf, dx, dy), offset: kf.offset }));
    }
    // ANIMATION-DESIGNER:stab:KEYFRAMES:END
    // ANIMATION-DESIGNER:chop:KEYFRAMES:START
    case 'chop': {
      const ANIMATION = {"pinned":false,"anchor":{"x":0,"y":0},"keyframes":[{"offset":0,"x":40,"y":-50,"dxFactor":0.15,"dyFactor":0.15,"rotate":-30,"scale":1},{"offset":1,"x":-10,"y":10,"dxFactor":0.15,"dyFactor":0.15,"rotate":10,"scale":1}]};
      return ANIMATION.keyframes.map((kf) => ({ transform: buildTransform(ANIMATION.pinned, ANIMATION.anchor, kf, dx, dy), offset: kf.offset }));
    }
    // ANIMATION-DESIGNER:chop:KEYFRAMES:END
    // ANIMATION-DESIGNER:slash:KEYFRAMES:START
    case 'slash': {
      const ANIMATION = {"pinned":false,"anchor":{"x":0,"y":0},"keyframes":[{"offset":0,"x":-24,"y":-24,"dxFactor":1,"dyFactor":1,"rotate":-45,"scale":1},{"offset":1,"x":24,"y":24,"dxFactor":1,"dyFactor":1,"rotate":45,"scale":1}]};
      return ANIMATION.keyframes.map((kf) => ({ transform: buildTransform(ANIMATION.pinned, ANIMATION.anchor, kf, dx, dy), offset: kf.offset }));
    }
    // ANIMATION-DESIGNER:slash:KEYFRAMES:END
    // ANIMATION-DESIGNER:attack:KEYFRAMES:START
    default: {
      const ANIMATION = {"pinned":false,"anchor":{"x":0,"y":0},"keyframes":[{"offset":0,"x":0,"y":0,"dxFactor":0,"dyFactor":0,"rotate":0,"scale":1},{"offset":0.5,"x":-15,"y":-20,"dxFactor":0.1,"dyFactor":0.1,"rotate":180,"scale":1},{"offset":1,"x":25,"y":-25,"dxFactor":0.15,"dyFactor":0.15,"rotate":360,"scale":1}]};
      return ANIMATION.keyframes.map((kf) => ({ transform: buildTransform(ANIMATION.pinned, ANIMATION.anchor, kf, dx, dy), offset: kf.offset }));
    }
    // ANIMATION-DESIGNER:attack:KEYFRAMES:END
  }
}

// Spawns one fixed-on-<body> emoji sprite that travels from startZoneEl to
// endZoneEl using keyframesFn(dx, dy), same fixed-position/live-tracking
// pattern as showDamageNumber/playPerfectTimingEffect above. Purely
// presentational, like playMonsterAttackWindup: callers apply damage/log/
// hit-effect on their own timing around this. jsdom (tests/helpers/dom.js)
// has no Element.prototype.animate, so the WAAPI call is best-effort -
// skipping it there still exercises the DOM structure/emoji/class assertions
// tests actually check, per this file's own tests' stated scope.
function spawnSwingSprite(emoji, className, startZoneEl, endZoneEl, keyframesFn, durationMs) {
  const startRect = startZoneEl.getBoundingClientRect();
  const endRect = endZoneEl.getBoundingClientRect();
  const dx = (endRect.left + endRect.width / 2) - (startRect.left + startRect.width / 2);
  const dy = (endRect.top + endRect.height / 2) - (startRect.top + startRect.height / 2);
  const spriteEl = document.createElement('div');
  spriteEl.textContent = emoji;
  spriteEl.className = className;
  spriteEl.style.left = `${startRect.left + startRect.width / 2}px`;
  spriteEl.style.top = `${startRect.top + startRect.height / 2}px`;
  document.body.appendChild(spriteEl);
  if (typeof spriteEl.animate === 'function') {
    // fill: 'forwards' - without it, the instant the WAAPI animation's own
    // timeline finishes (independent of the separate setTimeout below), the
    // transform reverts to none, snapping the sprite to its raw uncentered
    // (left, top) corner for the remainder of the setTimeout's own delay.
    spriteEl.animate(keyframesFn(dx, dy), { duration: durationMs, easing: 'ease-out', fill: 'forwards' });
  }
  const timeoutId = setTimeout(() => {
    spriteEl.remove();
    liveSwingSprites = liveSwingSprites.filter((s) => s.timeoutId !== timeoutId);
  }, durationMs);
  liveSwingSprites.push({ el: spriteEl, timeoutId });
  return spriteEl;
}

const TRAIL_GHOST_OPACITIES = [0.5, 0.3, 0.15];
const TRAIL_GHOST_STAGGER_MS = 50;

// Afterimage trail: faint blurred copies of the same swing, chasing it along
// the identical path a beat behind - reuses spawnSwingSprite for each ghost
// rather than a separate code path. Called for a crit hit's swing, and always
// for Sweep's traveling sprite (see playPlayerSweepSwing).
function spawnSwingTrail(emoji, className, startZoneEl, endZoneEl, keyframesFn, durationMs) {
  TRAIL_GHOST_OPACITIES.forEach((opacity, i) => {
    setTimeout(() => {
      if (unmounted) return;
      const ghost = spawnSwingSprite(emoji, `${className} battle-swing-trail`, startZoneEl, endZoneEl, keyframesFn, durationMs);
      ghost.style.opacity = String(opacity);
      ghost.style.filter = 'blur(1px)';
    }, (i + 1) * TRAIL_GHOST_STAGGER_MS);
  });
}

const HERO_ATTACK_LUNGE_MS = 300;

// Same trick as playMeleeLunge above, but for the hero's own attacks - see
// .battle-hero-attack-lunge's own comment in css/styles.css for why this
// exists (make the swing sprites read as the hero's own swing, not a
// projectile flying at the enemy on its own).
function playHeroAttackLunge() {
  if (!elements.heroEmoji) return;
  elements.heroEmoji.classList.add('battle-hero-attack-lunge');
  setTimeout(() => elements.heroEmoji.classList.remove('battle-hero-attack-lunge'), HERO_ATTACK_LUNGE_MS);
}

// Single-target swing: Attack (ability === null) or a non-AOE ability
// (Stab/Chop/Slash). isCrit adds the afterimage trail on top of the base
// swing - see spawnSwingTrail.
function playPlayerSwing(ability, targetZoneEl, isCrit) {
  playHeroAttackLunge();
  const emoji = swingSpriteEmoji(ability);
  const durationMs = SWING_DURATION_MS[ability?.id || 'attack'] || 250;
  const keyframesFn = (dx, dy) => swingKeyframesFor(ability?.id, dx, dy);
  spawnSwingSprite(emoji, 'battle-swing-sprite', elements.heroZone, targetZoneEl, keyframesFn, durationMs);
  if (isCrit) spawnSwingTrail(emoji, 'battle-swing-sprite', elements.heroZone, targetZoneEl, keyframesFn, durationMs);
}

const SWEEP_STAGGER_MS = 260;

// ANIMATION-DESIGNER:sweep:PROFILES:START
const SWEEP_PROFILES = {"default":{"pinned":false,"anchor":{"x":0,"y":0},"leadIn":{"x":0,"y":0,"dxFactor":0,"dyFactor":0,"rotate":0,"scale":1},"perWaypoint":{"x":0,"y":0,"dxFactor":1,"dyFactor":1,"rotateStep":120,"scale":1}},"overrides":{}};
// ANIMATION-DESIGNER:sweep:PROFILES:END

function sweepProfileFor(targetCount) {
  return SWEEP_PROFILES.overrides[String(targetCount)] || SWEEP_PROFILES.default;
}

// Sweep's own swing: one big sprite that travels through every living
// target's zone in turn (left to right), matching the sequential contact
// timing of the caller's own staggered hit loop below - never a fan of one
// sprite per target. Always carries the afterimage trail (see
// spawnSwingTrail), independent of crit, since Sweep is meant to read as one
// big sweep through the whole line regardless of how any single hit rolls.
function playPlayerSweepSwing(ability, targetZoneEls) {
  playHeroAttackLunge();
  const emoji = swingSpriteEmoji(ability);
  const profile = sweepProfileFor(targetZoneEls.length);
  const totalDurationMs = targetZoneEls.length * SWEEP_STAGGER_MS;
  const startRect = elements.heroZone.getBoundingClientRect();
  const startX = startRect.left + startRect.width / 2;
  const startY = startRect.top + startRect.height / 2;
  const waypoints = targetZoneEls.map((zoneEl) => {
    const rect = zoneEl.getBoundingClientRect();
    return {
      dx: (rect.left + rect.width / 2) - startX,
      dy: (rect.top + rect.height / 2) - startY,
    };
  });
  const keyframesFn = () => [
    { transform: buildTransform(profile.pinned, profile.anchor, { ...profile.leadIn }, 0, 0), offset: 0 },
    ...waypoints.map((p, i) => {
      const kf = {
        x: profile.perWaypoint.x,
        y: profile.perWaypoint.y,
        dxFactor: profile.perWaypoint.dxFactor,
        dyFactor: profile.perWaypoint.dyFactor,
        rotate: (i + 1) * profile.perWaypoint.rotateStep,
        scale: profile.perWaypoint.scale,
      };
      return {
        transform: buildTransform(profile.pinned, profile.anchor, kf, p.dx, p.dy),
        offset: (i + 1) / waypoints.length,
      };
    }),
  ];
  // heroZone passed as both start and end below only to anchor the sprite's
  // starting (left, top) position - the real multi-waypoint path is baked
  // into keyframesFn via the waypoints closure above, not derived from a
  // single dx/dy the way every other swing's path is.
  spawnSwingSprite(emoji, 'battle-swing-sprite battle-swing-sprite-large', elements.heroZone, elements.heroZone, keyframesFn, totalDurationMs);
  spawnSwingTrail(emoji, 'battle-swing-sprite battle-swing-sprite-large', elements.heroZone, elements.heroZone, keyframesFn, totalDurationMs);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SPLIT_DEATH_CHANCE = 0.5;

// A crit killing blow can, once in a while, play the split-in-two death
// animation instead of the usual spin (raised 2026-08-29) - checked and
// stamped onto the target the instant its result is known, so
// updateHpBars() (which actually applies the class) just reads it back.
function maybeMarkSplitDeath(target, result) {
  if (result.monsterHp <= 0 && result.isCrit && Math.random() < SPLIT_DEATH_CHANCE) {
    target.deathStyle = 'split';
  }
}

function playReviveEffect(emojiEl) {
  // Scoped to just the emoji, not the whole zone - the zone's own
  // battle-hit-shake animates `transform` via the `animation` shorthand,
  // and a killing blow adds both classes in the same tick. Two classes
  // setting `animation` on the same element can't both win: whichever CSS
  // rule is declared later takes the whole shorthand, so the shake was
  // silently never playing on the exact hit that triggers a revive. The
  // glow's own keyframes also animate box-shadow rather than filter, so it
  // doesn't fight battle-hit-flash's filter on the emoji either.
  emojiEl.classList.add('battle-revive-glow');
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
  if (event.code === 'Space') {
    // Super Scream lives on Space instead of a digit key, and unlike every
    // other ability it's exempt from the swing-timer-ready gate entirely -
    // see canUseAbility's alwaysReady param. The existing abilityActionInFlight
    // guard inside playerUseAbility already keeps this safe if Space is
    // pressed while another ability's timing meter is up: that call just
    // no-ops and the meter's own separate listener still resolves normally.
    event.preventDefault();
    const superScream = ABILITIES.find((a) => a.id === 'superScream');
    const locked = state.player.level < superScream.unlockLevel;
    const onCooldown = (abilityCooldowns[superScream.id] || 0) > 0;
    if (canUseAbility({ locked, onCooldown, ready: isReady(playerCombatant.atb), alwaysReady: true })) {
      playerUseAbility(superScream.id);
    }
    return;
  }
  if (key === 'a' || key === 'A') {
    playerAttack();
  } else if (key === 'Escape' || key === 'f' || key === 'F') {
    if (!isReady(playerCombatant.atb)) return;
    playerFlee();
  } else if (key >= '1' && key <= '4') {
    const ability = getUnlockedAbilities(state.player.level)[Number(key) - 1];
    if (!ability) return;
    const onCooldown = (abilityCooldowns[ability.id] || 0) > 0;
    const comboPrimed = !!comboState[ability.id];
    if (canUseAbility({ locked: false, onCooldown, ready: isReady(playerCombatant.atb), comboPrimed, comboRole: ability.comboRole })) {
      playerUseAbility(ability.id);
    }
  }
}

function resolveOneAttack(countsTowardStreak) {
  // Capture the target's index now: updateHpBars() below can re-anchor
  // selectedMonsterIndex to a survivor the instant this hit is a killing
  // blow, so re-reading selectedMonsterIndex after that point would make the
  // hit effect render on the wrong (undamaged) monster.
  const targetIndex = selectedMonsterIndex;
  const target = monsterCombatants[targetIndex];
  const unlockedAbilityCount = getUnlockedAbilities(state.player.level).length;
  // A bonus swing from extraSwingChance is deliberately exempt from the
  // attack-spam-decay system - see the Global Constraints at the top of
  // this plan and the design spec's "Combat hooks" section for why: it's an
  // automatic proc from one real press, not player spam, so it always hits
  // at full strength (multiplier 1) and never advances or is throttled by
  // the streak/cooldown state.
  const streakMultiplier = countsTowardStreak ? attackStreakMultiplier(attackStreak, unlockedAbilityCount) : 1;
  const knockbackMultiplier = countsTowardStreak ? attackKnockbackMultiplier(attackStreak) : 1;
  const result = resolvePlayerAttack(playerCombatant, applyDefenseDebuff(target, target.defenseDebuff), Math.random, streakMultiplier, knockbackMultiplier, playerEffectBonuses.critChancePercent / 100);
  if (countsTowardStreak) {
    attackStreak += 1;
    attackStreakIdleMs = 0;
    attackCooldownMs = attackCooldownMsForStreak(attackStreak);
  }
  target.hp = result.monsterHp;
  target.atb = result.monsterAtb;
  playerCombatant.atb = result.playerAtb;
  maybeMarkSplitDeath(target, result);
  log.push(result.isCrit
    ? `Critical! You hit ${target.name} for ${result.damage}!`
    : `You hit ${target.name} for ${result.damage}.`);
  if (countsTowardStreak) {
    const floor = Math.max(0, ATTACK_STREAK_FLOOR - unlockedAbilityCount * ATTACK_STREAK_FLOOR_PER_ABILITY);
    if (streakMultiplier <= floor && unlockedAbilityCount > 0 && !attackTauntShown) {
      attackTauntShown = true;
      const taunt = ATTACK_TAUNT_LINES[Math.floor(Math.random() * ATTACK_TAUNT_LINES.length)];
      log.push(taunt(target.name));
    }
  }
  // Play the hit effect before updateHpBars() hides a killed monster's slot
  // (display: none), so a killing blow's damage number/flash/shake is
  // actually visible instead of rendering onto an already-hidden element.
  playPlayerSwing(null, elements.monsterZones[targetIndex], result.isCrit);
  playHitEffect(elements.monsterZones[targetIndex], elements.monsterEmojis[targetIndex], result.damage, result.isCrit);
  applyOnHitEffects(target, result.damage, streakMultiplier);
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
  if (abilityActionInFlight || attackCooldownMs > 0) return;
  resolveOneAttack(true);
  updateHpBars();
  updateAtbBars();
  updateLog();
  checkOutcome();
  updateMenu();
  // Extra-swing chance (e.g. Swift Strike Charm) - deliberately does not
  // re-roll on the bonus swing itself, capping this at exactly one bonus
  // swing per original attack by construction (there's no recursive call
  // here, just this one guarded block). Gated on !battleOver: the first
  // swing above may have just ended the battle via checkOutcome ->
  // endBattle, which schedules callbacks.onBattleEnd via setTimeout: calling
  // checkOutcome a second time from a second swing would double-schedule
  // that callback and double-process rewards/XP for the same battle.
  if (!battleOver && playerEffectBonuses.extraSwingChance > 0 && Math.random() * 100 < playerEffectBonuses.extraSwingChance) {
    const bonusTarget = monsterCombatants[selectedMonsterIndex];
    if (bonusTarget && bonusTarget.hp > 0) {
      resolveOneAttack(false);
      updateHpBars();
      updateAtbBars();
      updateLog();
      checkOutcome();
      updateMenu();
    }
  }
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
  // Fired once here rather than removed later: this button is about to be
  // torn down and rebuilt fresh by the next updateMenu() call (abilityButtonsHtml()
  // regenerates the whole menu's innerHTML), so the animation just plays out
  // on the outgoing element - no cleanup needed. Works identically whether
  // playerUseAbility was reached via a mouse click or a keyboard shortcut.
  document.getElementById(`btn-ability-${abilityId}`)?.classList.add('battle-ability-button-pressed');
  try {
    const ability = ABILITIES.find((a) => a.id === abilityId);
    if (ability.type === 'buff') {
      buffState = activateBuff(ability);
      abilityCooldowns[abilityId] = ability.cooldownMs;
      attackStreak = 0;
      attackStreakIdleMs = 0;
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
    const comboBonusActive = !!comboState[abilityId];

    if (ability.aoe) {
      const targetIndices = monsterCombatants
        .map((mc, i) => i)
        .filter((i) => monsterCombatants[i].hp > 0);
      const debuffSnapshots = targetIndices.map((i) => monsterCombatants[i].defenseDebuff);
      // Payoff abilities (Sweep) never get the timing minigame - only the
      // setup half of a combo lane (Stab/Slash) does. Landing the setup's
      // timing window is what primes the payoff in the first place; the
      // payoff's own "bonus" is the combo multiplier, not a stacked timing
      // bonus on top of it.
      const timingHit = ability.comboRole === 'payoff' ? false : await runTimingMeter(ability);
      // Same battle-can-end-mid-await hazard as the single-target path below.
      if (battleOver) return;
      // Press-time semantics (see the buffActiveAtPress/comboBonusActive
      // snapshots above): cooldown/streak/combo bookkeeping all commit here,
      // immediately on press, rather than waiting for the staggered sequence
      // below to finish - the player's commitment is the button press, not
      // however long the sweep animation takes to play out.
      abilityCooldowns[abilityId] = ability.cooldownMs;
      attackStreak = 0;
      attackStreakIdleMs = 0;
      // Consume this ability's own primed bonus (if any), then prime its combo
      // partner: a setup primes its payoff for the bigger forward bonus, a
      // payoff primes its setup for the smaller return bonus. Same two lines
      // handle both directions since comboPartnerId points both ways - but a
      // setup only primes forward when its timing window was actually hit
      // (a miss still deals normal damage, per the never-fails design, just
      // doesn't light up the payoff); a payoff has no timing option of its
      // own, so it always primes its setup's return bonus.
      comboState[abilityId] = false;
      if (ability.comboPartnerId && (ability.comboRole === 'payoff' || timingHit)) {
        comboState[ability.comboPartnerId] = true;
      }
      // Sequential contact, not a fan of duplicate sprites (raised
      // 2026-08-28, see BACKLOG.md): one traveling sweep sprite visits each
      // living target in turn, and each target's own hp/log/hit-effect lands
      // in sync with the sprite actually reaching it - a real awaited delay
      // between targets, not everything resolving in one synchronous batch.
      // abilityActionInFlight (see the try/finally around this whole
      // function) stays true for the entire sequence, so it behaves like the
      // existing timing-meter await above: no re-entrant action mid-swing.
      const livingIndices = targetIndices.filter((i) => monsterCombatants[i].hp > 0);
      playPlayerSweepSwing(ability, livingIndices.map((i) => elements.monsterZones[i]));
      for (let n = 0; n < targetIndices.length; n++) {
        const monsterIndex = targetIndices[n];
        // Always sleeps first, even for a target that turns out to already be
        // dead below - the sweep sprite's own waypoint schedule (built from a
        // fixed livingIndices count above) assumes one stagger slot per living
        // target regardless of what happens to any of them mid-sequence. A
        // target that dies from something unrelated while waiting its turn
        // (e.g. a Slash bleed tick landing via tick()'s own setInterval) still
        // consumes its slot instead of the remaining hits resolving early and
        // outrunning the sprite still visually en route to them.
        await sleep(SWEEP_STAGGER_MS);
        if (battleOver || unmounted) return;
        const mc = monsterCombatants[monsterIndex];
        if (mc.hp <= 0) continue; // died before its own turn in the sequence
        const result = resolveAbilityUse(playerCombatant, applyDefenseDebuff(mc, debuffSnapshots[n]), ability, buffActiveAtPress, timingHit, comboBonusActive, Math.random, playerEffectBonuses.critChancePercent / 100);
        mc.hp = result.monsterHp;
        mc.atb = result.monsterAtb;
        playerCombatant.atb = result.playerAtb;
        maybeMarkSplitDeath(mc, result);
        mc.defenseDebuff = createDefenseDebuff(ability);
        const timingSuffix = timingHit ? ' Perfect timing!' : '';
        log.push((result.isCrit
          ? `Critical! You use ${ability.name} on ${mc.name} for ${result.damage}!`
          : `You use ${ability.name} on ${mc.name} for ${result.damage}.`) + timingSuffix);
        playHitEffect(elements.monsterZones[monsterIndex], elements.monsterEmojis[monsterIndex], result.damage, result.isCrit);
        if (timingHit) playPerfectTimingEffect(elements.monsterZones[monsterIndex]);
        applyOnHitEffects(mc, result.damage);
        updateHpBars();
        updateAtbBars();
        updateLog();
      }
      checkOutcome();
      updateMenu();
      return;
    }

    const targetIndex = selectedMonsterIndex;
    const target = monsterCombatants[targetIndex];
    const defenseDebuffAtPress = target.defenseDebuff;
    // Payoff abilities (Chop) never get the timing minigame - see the AOE
    // branch above for why.
    const timingHit = ability.comboRole === 'payoff' ? false : await runTimingMeter(ability);
    // The battle can end while this await is outstanding - e.g. the monster's
    // own ATB-driven attack (tick() -> monsterAttack(), which is intentionally
    // NOT gated by abilityActionInFlight) can kill the player mid-swing. If it
    // did, don't resolve this ability's damage or call checkOutcome()/endBattle()
    // a second time.
    if (battleOver) return;
    const result = resolveAbilityUse(playerCombatant, applyDefenseDebuff(target, defenseDebuffAtPress), ability, buffActiveAtPress, timingHit, comboBonusActive, Math.random, playerEffectBonuses.critChancePercent / 100);
    target.hp = result.monsterHp;
    target.atb = result.monsterAtb;
    playerCombatant.atb = result.playerAtb;
    maybeMarkSplitDeath(target, result);
    abilityCooldowns[abilityId] = ability.cooldownMs;
    attackStreak = 0;
    attackStreakIdleMs = 0;
    if (ability.id === 'slash') {
      target.pendingDelayedHit = { amount: resolveDelayedHit(result.damage, ability), dueAtMs: ability.delayedHitDelayMs };
    }
    // Consume this ability's own primed bonus (if any), then prime its combo
    // partner - see the AOE branch above for the same logic and why a setup
    // only primes forward on a timing hit while a payoff always primes back.
    comboState[abilityId] = false;
    if (ability.comboPartnerId && (ability.comboRole === 'payoff' || timingHit)) {
      comboState[ability.comboPartnerId] = true;
    }
    const timingSuffix = timingHit ? ' Perfect timing!' : '';
    log.push((result.isCrit
      ? `Critical! You use ${ability.name} on ${target.name} for ${result.damage}!`
      : `You use ${ability.name} on ${target.name} for ${result.damage}.`) + timingSuffix);
    // Play the hit effect before updateHpBars() hides a killed monster's slot
    // (display: none), so a killing blow's damage number/flash/shake is
    // actually visible instead of rendering onto an already-hidden element.
    playPlayerSwing(ability, elements.monsterZones[targetIndex], result.isCrit);
    playHitEffect(elements.monsterZones[targetIndex], elements.monsterEmojis[targetIndex], result.damage, result.isCrit);
    if (timingHit) playPerfectTimingEffect(elements.monsterZones[targetIndex]);
    applyOnHitEffects(target, result.damage);
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
  const result = resolvePotionUse(playerCombatant, ITEMS.potion.heal, Math.random, playerEffectBonuses.critChancePercent / 100);
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

function applyMonsterAttackImpact(monster, result) {
  log.push(result.isCrit
    ? `Critical! ${monster.name} hits you for ${result.damage}!`
    : `${monster.name} hits you for ${result.damage}.`);
  updateHpBars();
  updateLog();
  playHitEffect(elements.heroZone, elements.heroEmoji, result.damage, result.isCrit);
  checkOutcome();
}

function monsterAttack(monster) {
  const result = resolveMonsterAttack(monster, playerCombatant);
  playerCombatant.hp = result.playerHp;
  playerCombatant.atb = result.playerAtb;
  monster.atb = result.monsterAtb;
  const monsterIndex = monsterCombatants.indexOf(monster);
  playMonsterAttackWindup(monster, monsterIndex);
  // Impact resolves immediately for every attack style, purely cosmetic
  // projectile flight aside - a delay here used to push the ranged case
  // past the moment the parry wind-up bar resets to inactive
  // (PARRY_WINDUP_DURATION_MS in js/systems/parry.js), so a parry press
  // during that gap silently did nothing and the hit landed unblocked.
  // Found 2026-08-23 from Timothy's own report that parries against ranged
  // monsters (goblin/spider/dragon/wraith/skeleton/the elite) felt
  // unreliable - real regression from adding the projectile animation,
  // not his timing.
  applyMonsterAttackImpact(monster, result);
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
    // before updateHpBars() hides a killed monster's slot. isCrit is `true`
    // here (not a rolled crit) so a landed parry gets the same shake/flash
    // punch as one - "perfect timing" is exactly what a parry read is.
    playHitEffect(elements.monsterZones[index], elements.monsterEmojis[index], result.reflectedDamage, true);
    playParryEffect(elements.heroZone, elements.heroEmoji);
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
  // Attack's decayed streak only resets passively after a sustained
  // real-time idle stretch with no Attack presses (ATTACK_STREAK_RECOVERY_MS) -
  // deliberately slow, and deliberately decoupled from the ATB gauge above:
  // that gauge caps at ATB_MAX and abilities read the same value for their
  // own readiness, so it can't be pushed further to represent a slower
  // recharge on its own. Landing an ability still resets the streak
  // instantly (elsewhere in this file) - only the "just wait it out" path
  // is slow.
  if (attackStreak > 0) {
    attackStreakIdleMs += 300;
    if (attackStreakIdleMs >= ATTACK_STREAK_RECOVERY_MS) {
      attackStreak = 0;
      attackStreakIdleMs = 0;
    }
  }
  attackCooldownMs = Math.max(0, attackCooldownMs - 300);
  abilityCooldowns = tickCooldowns(abilityCooldowns, 300);
  buffState = tickBuff(buffState, 300);

  for (const mc of monsterCombatants) {
    if (mc.hp <= 0) continue;
    mc.atb = tickGauge(mc.atb, mc.speed, 1);
    if (isReady(mc.atb) && !mc.windup.active) {
      mc.windup = startWindup();
      // Kick off the real-time fill animation at the exact instant the
      // windup starts, rather than waiting for the next updateAtbBars()
      // poll - see the battle-windup-fill comment in css/styles.css.
      const index = monsterCombatants.indexOf(mc);
      elements.monsterAtbFills[index].style.animation = `battle-windup-fill ${PARRY_WINDUP_DURATION_MS}ms linear forwards`;
      // A one-shot pulse on the static red zone marker, timed via
      // animation-delay to fire at the exact real-time instant the moving
      // fill actually crosses into it - same real-time-not-polled approach
      // as the fill animation above, so the pulse can't lag behind like a
      // tick-polled trigger would. See docs/superpowers/BACKLOG.md's
      // "Pulse/glow on timing bars..." item.
      const zoneEl = elements.monsterParryZones[index];
      const pulseDelayMs = (PARRY_ZONE_START_PERCENT / 100) * PARRY_WINDUP_DURATION_MS;
      zoneEl.style.animation = 'none';
      void zoneEl.offsetWidth; // force reflow so re-triggering restarts the animation
      zoneEl.style.animation = `battle-zone-pulse 0.35s ease-out ${pulseDelayMs}ms`;
    } else if (mc.windup.active && isWindupComplete(mc.windup)) {
      // isWindupComplete/windupElapsedPercent read real elapsed wall-clock
      // time now, not a value this tick advances - this is just a poll to
      // catch "the window closed and nothing was pressed," not the source
      // of truth (see js/systems/parry.js).
      resolveMonsterWindup(mc, false);
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
    playReviveEffect(elements.heroEmoji);
  }
  const killedMonsterIds = monsterCombatants.filter((mc) => mc.hp <= 0).map((mc) => mc.monsterId);
  updateMenu();
  exitAnimTimeoutId = setTimeout(() => {
    elements.dialog?.classList.add('battle-screen-swirl-out');
  }, Math.max(0, VICTORY_PAUSE_MS - EXIT_ANIM_MS));
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
  unmounted = false;
  playerCombatant = buildPlayerCombatant();
  playerEffectBonuses = getEquipmentBonuses(state);
  abilityCooldowns = Object.fromEntries(ABILITIES.map((ability) => [ability.id, 0]));
  buffState = createBuffState();
  comboState = {};
  abilityActionInFlight = false;
  attackStreak = 0;
  attackStreakIdleMs = 0;
  attackTauntShown = false;
  // Found via the new jsdom test harness (tests/battleScreenDom.test.js):
  // every other per-battle Attack counter above is reset here, but this one
  // was missed. A battle ending while Attack was mid-cooldown (e.g. the
  // winning blow was itself an Attack) left a stale positive
  // attackCooldownMs in place, silently disabling Attack for a moment at
  // the start of the player's *next* battle until tick() decayed it back to
  // 0 - self-healing within a second or two, so easy to miss live, but a
  // real bug.
  attackCooldownMs = 0;
  monsterCombatants = monsterIds.map((id, i) => buildMonsterCombatant(id, monsterOverridesList[i]));
  // The elite gets an adaptive appear line based on estimated win chance
  // instead of a random pick from a fixed pool - needs the built combatant
  // stats (equipment bonuses, NG+ scaling), not the raw MONSTERS entry, so
  // this has to run after buildPlayerCombatant/buildMonsterCombatant above.
  log = [MONSTERS[monsterIds[0]].isElite
    ? getEliteAppearLine(playerCombatant, monsterCombatants[0])
    : pickAppearLine(MONSTERS[monsterIds[0]])];
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

  updateLog();
  updateMenu();
  intervalId = setInterval(tick, 300);
  window.addEventListener('keydown', handleKeydown);
}

export function unmount() {
  unmounted = true;
  clearInterval(intervalId);
  clearTimeout(endBattleTimeoutId);
  clearTimeout(exitAnimTimeoutId);
  window.removeEventListener('keydown', handleKeydown);
  liveDamageNumbers.forEach(({ el, timeoutId }) => {
    clearTimeout(timeoutId);
    el.remove();
  });
  liveDamageNumbers = [];
  livePerfectBadges.forEach(({ el, timeoutId }) => {
    clearTimeout(timeoutId);
    el.remove();
  });
  livePerfectBadges = [];
  liveSwingSprites.forEach(({ el, timeoutId }) => {
    clearTimeout(timeoutId);
    el.remove();
  });
  liveSwingSprites = [];
}
