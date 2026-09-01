import { calculateDamage, rollCrit, applyCritMultiplier } from './combat.js';

// Wind-up elapsed time is a real wall-clock measurement (startedAt vs. now),
// not a value accumulated in fixed 300ms ticks. It used to be the latter:
// battleScreen.js's tick() only advanced state every 300ms, so the value
// resolveParryAttempt actually checked only ever jumped in 300ms steps
// (0/300/600/900/1200), while the ATB bar's CSS transition displayed it
// gliding continuously between those jumps. A press made mid-glide - bar
// visually inside the red parry zone - could still read the previous,
// not-yet-advanced tick value and fail, landing a full hit that looked like
// a correctly-timed parry. Found from Timothy's 2026-08-25 report ("enemies
// are still hitting me when I parry") plus his own follow-up question about
// whether the bar's graphic was lying - it was, just not in its own
// position (the static zone markup - `.battle-parry-zone` in css/
// styles.css, kept in sync by hand with PARRY_ZONE_START/END_PERCENT below
// - was correct); the moving fill's displayed position could outrun the
// value being checked against it.
// Recomputing elapsed time from the clock at the exact moment of the
// keypress/click (rather than trusting the last poll) closes that gap:
// whatever the player is looking at when they press is what gets checked.
// battleScreen.js's tick() still polls every 300ms to catch isWindupComplete
// when nothing was pressed, but that's just a poll now, not the source of
// truth. See docs/superpowers/specs/2026-08-18-parry-mechanic-design.md.
export const PARRY_WINDUP_DURATION_MS = 1000;
// Narrowed from 80 (a 200ms window) 2026-09-01, per Timothy's own concern
// ("if you do parries correctly you can win almost anything"). 200ms was the
// same size as the ability-timing meter's sweet spot
// (TIMING_SWEET_SPOT_START in battleScreen.js), which assumes a 70% landing
// rate for a reasonably-attentive player (TIMING_HIT_RATE in
// scripts/simulate-balance.js) - but parry's payoff (full damage negation +
// 50% reflected damage + resetting the monster's attack timer entirely) is
// far more valuable per landing than the timing meter's +30% damage bonus,
// so an equal window size let a good parrier win fights that should stay
// hard. Confirmed with the balance simulator's new --parry-rate flag: at a
// 0.7 landing rate (this window's old size), several dragon-tier and NG+2
// matchups that are unwinnable at 0 parries flip to 84-100% win rate. Halved
// to 100ms so landing one reliably takes real skill rather than a generous
// anticipation window - see the "Parry window trade-offs" backlog entry in
// docs/superpowers/BACKLOG.md for the full history. This is a feel-tuning
// call the simulator can't fully validate on its own (it has no reaction-
// timing model) - re-check against actual play and retune if it reads as
// too easy or too punishing.
export const PARRY_ZONE_START_PERCENT = 90;
export const PARRY_ZONE_END_PERCENT = 100;
export const PARRY_REFLECT_FRACTION = 0.5;

export function createWindupState() {
  return { active: false, startedAt: 0 };
}

export function startWindup(now = Date.now()) {
  return { active: true, startedAt: now };
}

// Called on resume from a mid-battle pause, with offsetMs = how long the
// pause lasted, so the paused duration doesn't count as windup elapsed time.
export function shiftWindupStart(windupState, offsetMs) {
  return { ...windupState, startedAt: windupState.startedAt + offsetMs };
}

export function windupElapsedMs(windupState, now = Date.now()) {
  if (!windupState.active) return 0;
  return Math.max(0, now - windupState.startedAt);
}

export function isWindupComplete(windupState, now = Date.now()) {
  return windupState.active && windupElapsedMs(windupState, now) >= PARRY_WINDUP_DURATION_MS;
}

export function windupElapsedPercent(windupState, now = Date.now()) {
  return Math.min(100, (windupElapsedMs(windupState, now) / PARRY_WINDUP_DURATION_MS) * 100);
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
