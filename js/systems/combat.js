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

export const CRIT_CHANCE = 0.1;
export const CRIT_MULTIPLIER = 1.5;

export function rollCrit(rng = Math.random) {
  return rng() < CRIT_CHANCE;
}

export function applyCritMultiplier(damage, isCrit) {
  return isCrit ? Math.round(damage * CRIT_MULTIPLIER) : damage;
}
