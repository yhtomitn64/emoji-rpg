import { rollCrit, calculateDamage, applyCritMultiplier, applySpeedDamageBonus, applyKnockback, ATB_KNOCKBACK } from './combat.js';

// Powers the damage number shown next to each ability button. Deliberately
// excludes crit (rollCrit) and the timing-minigame bonus - those are luck/skill
// at press-time, not something the player can know before pressing. Buff and
// combo state ARE known in advance (visible from the button's own combo-ready
// glow / the buff indicator), so those bonuses are included for accuracy.

export const ROTATION_BONUS_MULTIPLIER = 1.25;
export const TIMING_BONUS_MULTIPLIER = 1.30;
export const COMBO_PAYOFF_BONUS_MULTIPLIER = 1.5;
export const COMBO_RETURN_BONUS_MULTIPLIER = 1.15;

export const ABILITIES = [
  {
    id: 'stab', name: 'Stab', icon: '🗡️', unlockLevel: 2, type: 'damage',
    damageMultiplier: 0.8, cooldownMs: 4000,
    description: "a quick, lighter jab — land it in the timing window to prime Chop's bonus",
    comboRole: 'setup', comboPartnerId: 'chop', comboBonusMultiplier: COMBO_RETURN_BONUS_MULTIPLIER,
  },
  {
    id: 'chop', name: 'Chop', icon: '🪓', unlockLevel: 4, type: 'damage',
    damageMultiplier: 1.1, cooldownMs: 10000,
    description: 'a heavy payoff swing — deals bonus damage right after a well-timed Stab',
    comboRole: 'payoff', comboPartnerId: 'stab', comboBonusMultiplier: COMBO_PAYOFF_BONUS_MULTIPLIER,
  },
  {
    id: 'slash', name: 'Slash', icon: '⚔️', unlockLevel: 6, type: 'damage',
    damageMultiplier: 0.85, cooldownMs: 6000,
    delayedHitMultiplier: 0.2, delayedHitDelayMs: 900,
    description: 'a cut that also bleeds for extra damage a moment later — land it in the timing window to prime Sweep\'s bonus',
    comboRole: 'setup', comboPartnerId: 'sweep', comboBonusMultiplier: COMBO_RETURN_BONUS_MULTIPLIER,
  },
  {
    id: 'sweep', name: 'Sweep', icon: '🌪️', unlockLevel: 8, type: 'damage',
    damageMultiplier: 1.3, cooldownMs: 12000,
    defenseShredMultiplier: 0.85, defenseShredDurationMs: 6000,
    aoe: true,
    description: 'a spinning hit on every living enemy that also weakens their defense for a few seconds — deals bonus damage right after a well-timed Slash',
    comboRole: 'payoff', comboPartnerId: 'slash', comboBonusMultiplier: COMBO_PAYOFF_BONUS_MULTIPLIER,
  },
  {
    id: 'superScream', name: 'Super Scream', icon: '📢', unlockLevel: 10, type: 'buff',
    cooldownMs: 30000, buffDurationMs: 12000,
    description: 'a roar that boosts all your damage for a while',
  },
];

export function getUnlockedAbilities(level) {
  return ABILITIES.filter((ability) => ability.unlockLevel <= level);
}

// Whether the timing-meter's bonus zone means anything yet for this ability.
// A setup ability's (Stab/Slash) timing window only exists to prime its
// combo partner (Chop/Sweep) - if that partner isn't unlocked yet (e.g.
// Stab unlocks at level 2, Chop not until level 4), showing the green zone
// for two levels before it can do anything is misleading (raised
// 2026-08-28: "don't show the green section until you get the next ability
// which actually benefits from that timing"). An ability with no combo
// partner at all (nothing to prime) always shows its hint normally.
export function comboTimingHintUnlocked(ability, playerLevel) {
  if (!ability.comboPartnerId) return true;
  const partner = ABILITIES.find((a) => a.id === ability.comboPartnerId);
  return !partner || partner.unlockLevel <= playerLevel;
}

export function canUseAbility({ locked, onCooldown, ready, comboPrimed, comboRole, alwaysReady }) {
  if (locked) return false;
  // A primed payoff (e.g. Chop right after a timing-hit Stab) fires
  // instantly - bypassing both the swing-timer/ready gate AND its own
  // real-time cooldown, not just the former, so priming it always means
  // "usable right away" rather than "usable once its cooldown happens to
  // also be up."
  const comboSkipsGates = comboPrimed && comboRole === 'payoff';
  if (comboSkipsGates) return true;
  return !onCooldown && !!(ready || alwaysReady);
}

export function tickCooldowns(cooldowns, dt) {
  const next = {};
  for (const [id, remainingMs] of Object.entries(cooldowns)) {
    next[id] = Math.max(0, remainingMs - dt);
  }
  return next;
}

export function createBuffState() {
  return { active: false, remainingMs: 0 };
}

export function activateBuff(ability) {
  return { active: true, remainingMs: ability.buffDurationMs };
}

export function tickBuff(buffState, dt) {
  if (!buffState.active) return buffState;
  const remainingMs = Math.max(0, buffState.remainingMs - dt);
  return remainingMs === 0 ? createBuffState() : { ...buffState, remainingMs };
}

export function resolveTimingHit(actedAtPercent, sweetSpotStartPercent, sweetSpotEndPercent) {
  return actedAtPercent >= sweetSpotStartPercent && actedAtPercent <= sweetSpotEndPercent;
}

export function resolveAbilityUse(player, monster, ability, buffActive, timingHit, comboBonusActive, rng = Math.random, critChanceBonus = 0) {
  const isCrit = rollCrit(rng, critChanceBonus);
  let damage = calculateDamage(player, monster, rng);
  damage = Math.round(damage * ability.damageMultiplier);
  if (buffActive) damage = Math.round(damage * ROTATION_BONUS_MULTIPLIER);
  if (timingHit) damage = Math.round(damage * TIMING_BONUS_MULTIPLIER);
  if (comboBonusActive) damage = Math.round(damage * ability.comboBonusMultiplier);
  damage = applyCritMultiplier(damage, isCrit);
  damage = applySpeedDamageBonus(damage, player.speed);
  return {
    damage,
    isCrit,
    monsterHp: Math.max(0, monster.hp - damage),
    monsterAtb: applyKnockback(monster.atb, ATB_KNOCKBACK),
    playerAtb: 0,
  };
}

export function estimateAbilityDamage(player, monster, ability, buffActive, comboBonusActive, rng = () => 0.5) {
  let damage = calculateDamage(player, monster, rng);
  damage = Math.round(damage * ability.damageMultiplier);
  if (buffActive) damage = Math.round(damage * ROTATION_BONUS_MULTIPLIER);
  if (comboBonusActive) damage = Math.round(damage * ability.comboBonusMultiplier);
  return applySpeedDamageBonus(damage, player.speed);
}

export function resolveDelayedHit(baseDamage, ability) {
  return Math.round(baseDamage * ability.delayedHitMultiplier);
}

export function createDefenseDebuff(ability) {
  return { active: true, multiplier: ability.defenseShredMultiplier, remainingMs: ability.defenseShredDurationMs };
}

export function tickDefenseDebuff(debuff, dt) {
  if (!debuff) return null;
  const remainingMs = Math.max(0, debuff.remainingMs - dt);
  return remainingMs === 0 ? null : { ...debuff, remainingMs };
}

export function applyDefenseDebuff(monster, debuff) {
  if (!debuff || !debuff.active) return monster;
  return { ...monster, defense: Math.round(monster.defense * debuff.multiplier) };
}
