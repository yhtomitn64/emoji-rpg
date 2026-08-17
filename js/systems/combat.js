import { applyHeal } from './inventory.js';

export const ATB_MAX = 100;

export function calculateDamage(attacker, defender, rng = Math.random) {
  const base = Math.max(1, attacker.attack - defender.defense);
  const variance = 0.85 + rng() * 0.3;
  return Math.max(1, Math.round(base * variance));
}

export function tickGauge(currentAtb, speed, dt) {
  return Math.min(ATB_MAX, currentAtb + speed * dt);
}

export function isReady(atb) {
  return atb >= ATB_MAX;
}

export const ATB_KNOCKBACK = 15;

export function applyKnockback(atb, amount) {
  return Math.max(0, atb - amount);
}

// A player who has invested enough in speed (leveling and/or gear like Wind
// Greaves) to reach this threshold gets a small damage bonus, so speed stays
// worth chasing past the point where it's already fast enough to act often.
export const SPEED_DAMAGE_BONUS_THRESHOLD = 20;
export const SPEED_DAMAGE_BONUS_MULTIPLIER = 1.1;

export function applySpeedDamageBonus(damage, speed) {
  return speed >= SPEED_DAMAGE_BONUS_THRESHOLD ? Math.round(damage * SPEED_DAMAGE_BONUS_MULTIPLIER) : damage;
}

export function applyEnemySlow(speed, slowPercent) {
  return Math.max(1, Math.round(speed * (1 - slowPercent / 100)));
}

export const CRIT_CHANCE = 0.1;
export const CRIT_MULTIPLIER = 1.5;

export function rollCrit(rng = Math.random) {
  return rng() < CRIT_CHANCE;
}

export function applyCritMultiplier(damage, isCrit) {
  return isCrit ? Math.round(damage * CRIT_MULTIPLIER) : damage;
}

// Single source of truth for "what happens when X attacks Y" - both
// battleScreen.js (the real UI) and scripts/simulate-balance.js (the
// headless balance report) call these exact functions, so the damage/crit/
// knockback/speed-bonus/heal formulas can never drift out of sync between
// what's shipped and what's being balance-tested. Only the surrounding loop
// (whose turn it is, when to act) stays separate - that's driven by real
// user input in one and an AI policy in the other, and can't be unified the
// same way.

export function resolvePlayerAttack(player, monster, rng = Math.random) {
  const isCrit = rollCrit(rng);
  let damage = calculateDamage(player, monster, rng);
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

export function resolveMonsterAttack(monster, player, rng = Math.random) {
  const isCrit = rollCrit(rng);
  let damage = calculateDamage(monster, player, rng);
  damage = applyCritMultiplier(damage, isCrit);
  return {
    damage,
    isCrit,
    playerHp: Math.max(0, player.hp - damage),
    playerAtb: applyKnockback(player.atb, ATB_KNOCKBACK),
    monsterAtb: 0,
  };
}

export function resolvePotionUse(player, healAmount, rng = Math.random) {
  const isCrit = rollCrit(rng);
  const heal = applyCritMultiplier(healAmount, isCrit);
  return {
    heal,
    isCrit,
    playerHp: applyHeal(player.hp, player.maxHp, heal),
  };
}

// A monster the player can kill within this many hits (average damage roll)
// is a candidate for surrendering/fleeing instead of fighting to the death -
// see resolveWeakMobEncounter below.
export const WEAK_MOB_HITS_TO_KILL_THRESHOLD = 3;
export const WEAK_MOB_TRIGGER_CHANCE = 0.35;

export function isMonsterOutclassed(player, monster) {
  const averageDamage = calculateDamage(player, monster, () => 0.5);
  const hitsToKill = Math.ceil(monster.hp / averageDamage);
  return hitsToKill <= WEAK_MOB_HITS_TO_KILL_THRESHOLD;
}

// Bosses never surrender/flee (they already can't be fled from), so isBoss
// short-circuits regardless of how outclassed they are. Otherwise, an
// outclassed monster has a WEAK_MOB_TRIGGER_CHANCE shot at a three-way split:
// giving up outright (full win rewards), fleeing but dropping loot on the way
// out, or fleeing with nothing.
export function resolveWeakMobEncounter(player, monster, isBoss, rng = Math.random) {
  if (isBoss) return null;
  if (!isMonsterOutclassed(player, monster)) return null;
  if (rng() >= WEAK_MOB_TRIGGER_CHANCE) return null;
  const roll = rng();
  if (roll < 1 / 3) return 'surrender';
  if (roll < 2 / 3) return 'fled-with-loot';
  return 'fled-empty';
}

export const FLAVOR_LINE_CHANCE = 0.35;

export function pickAppearLine(monster, rng = Math.random) {
  const lines = monster.flavorLines;
  if (!lines || lines.length === 0 || rng() >= FLAVOR_LINE_CHANCE) {
    return `A wild ${monster.name} appears!`;
  }
  const index = Math.floor(rng() * lines.length);
  return lines[index];
}
