import { calculateDamage, rollCrit, applyCritMultiplier } from './combat.js';

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
