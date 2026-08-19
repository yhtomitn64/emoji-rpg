import { calculateDamage, rollCrit, applyCritMultiplier } from './combat.js';

// NOTE: this is a nominal duration. battleScreen.js's tick() only advances
// wind-up state every 300ms, and the tick that starts a wind-up doesn't also
// advance it - so the real wall-clock wind-up is ~1200ms (4 ticks past the
// start), with only a single tick (elapsedMs=900, rendering as 90%) actually
// landing inside the PARRY_ZONE_START_PERCENT-PARRY_ZONE_END_PERCENT band
// before completion at elapsedMs=1200. Recorded here so a future balance/
// tuning pass starts from the real behavior, not this nominal number - see
// docs/superpowers/specs/2026-08-18-parry-mechanic-design.md.
export const PARRY_WINDUP_DURATION_MS = 1000;
export const PARRY_ZONE_START_PERCENT = 80;
export const PARRY_ZONE_END_PERCENT = 100;
export const PARRY_REFLECT_FRACTION = 0.5;

export function createWindupState() {
  return { active: false, elapsedMs: 0 };
}

export function startWindup() {
  return { active: true, elapsedMs: 0 };
}

export function tickWindup(windupState, dt) {
  if (!windupState.active) return windupState;
  return { active: true, elapsedMs: windupState.elapsedMs + dt };
}

export function isWindupComplete(windupState) {
  return windupState.active && windupState.elapsedMs >= PARRY_WINDUP_DURATION_MS;
}

export function windupElapsedPercent(windupState) {
  return Math.min(100, (windupState.elapsedMs / PARRY_WINDUP_DURATION_MS) * 100);
}

export function resolveParryAttempt(elapsedPercent) {
  return elapsedPercent >= PARRY_ZONE_START_PERCENT && elapsedPercent <= PARRY_ZONE_END_PERCENT;
}

export function rollIncomingDamage(monster, player, rng = Math.random) {
  const isCrit = rollCrit(rng);
  let damage = calculateDamage(monster, player, rng);
  damage = applyCritMultiplier(damage, isCrit);
  return { damage, isCrit };
}

export function resolveParrySuccess(monster, incomingDamage) {
  const reflectedDamage = Math.round(incomingDamage * PARRY_REFLECT_FRACTION);
  return {
    monsterHp: Math.max(0, monster.hp - reflectedDamage),
    monsterAtb: 0,
    reflectedDamage,
  };
}
