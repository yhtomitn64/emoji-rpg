import { rollCrit, calculateDamage, applyCritMultiplier, applySpeedDamageBonus, applyKnockback, ATB_KNOCKBACK } from './combat.js';

export const ABILITIES = [
  {
    id: 'stab', name: 'Stab', unlockLevel: 2, type: 'damage',
    damageMultiplier: 1.3, cooldownMs: 4000,
  },
  {
    id: 'chop', name: 'Chop', unlockLevel: 4, type: 'damage',
    damageMultiplier: 1.8, cooldownMs: 10000,
  },
  {
    id: 'slash', name: 'Slash', unlockLevel: 6, type: 'damage',
    damageMultiplier: 1.0, cooldownMs: 6000,
    delayedHitMultiplier: 0.2, delayedHitDelayMs: 900,
  },
  {
    id: 'sweep', name: 'Sweep', unlockLevel: 8, type: 'damage',
    damageMultiplier: 1.5, cooldownMs: 12000,
    defenseShredMultiplier: 0.85, defenseShredDurationMs: 6000,
  },
  {
    id: 'superScream', name: 'Super Scream', unlockLevel: 10, type: 'buff',
    cooldownMs: 30000, buffDurationMs: 12000,
  },
];

export function getUnlockedAbilities(level) {
  return ABILITIES.filter((ability) => ability.unlockLevel <= level);
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

export const ROTATION_BONUS_MULTIPLIER = 1.25;
export const TIMING_BONUS_MULTIPLIER = 1.30;

export function resolveAbilityUse(player, monster, ability, buffActive, timingHit, rng = Math.random) {
  const isCrit = rollCrit(rng);
  let damage = calculateDamage(player, monster, rng);
  damage = Math.round(damage * ability.damageMultiplier);
  if (buffActive) damage = Math.round(damage * ROTATION_BONUS_MULTIPLIER);
  if (timingHit) damage = Math.round(damage * TIMING_BONUS_MULTIPLIER);
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
