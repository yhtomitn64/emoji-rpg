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

export const FLAVOR_LINE_CHANCE = 0.35;

export function pickAppearLine(monster, rng = Math.random) {
  const lines = monster.flavorLines;
  if (!lines || lines.length === 0 || rng() >= FLAVOR_LINE_CHANCE) {
    return `A wild ${monster.name} appears!`;
  }
  const index = Math.floor(rng() * lines.length);
  return lines[index];
}
