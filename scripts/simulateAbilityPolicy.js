import { getUnlockedAbilities } from '../js/systems/abilities.js';

/**
 * Decides what the simulated player does on one tick, in priority order:
 *   1. Super Scream, if unlocked/off cooldown/not already active - free and
 *      strictly beneficial, so a reasonable player always takes it.
 *   2. A primed combo payoff (Chop/Sweep) that's off its own cooldown - the
 *      biggest available action, and instant-cast (bypasses `ready`) per the
 *      real combo-priming rules.
 *   3. Otherwise, if the swing timer is ready, the highest-unlocked damage
 *      ability that's off cooldown.
 *   4. Otherwise, Attack - unless it's still on its own short cooldown, in
 *      which case there's nothing to do this tick.
 *
 * Pure and side-effect-free on purpose: this is unit-tested directly, kept
 * in its own module so importing it never runs simulate-balance.js's own
 * unconditional report-printing `main()`.
 */
export function chooseAction({ level, cooldowns, comboState, buffActive, ready, attackOnCooldown }) {
  const unlocked = getUnlockedAbilities(level);
  const offCooldown = (id) => (cooldowns[id] || 0) <= 0;

  const superScream = unlocked.find((a) => a.type === 'buff');
  if (superScream && offCooldown(superScream.id) && !buffActive) {
    return { kind: 'ability', id: superScream.id };
  }

  const primedPayoff = unlocked.find(
    (a) => a.comboRole === 'payoff' && comboState[a.id] && offCooldown(a.id)
  );
  if (primedPayoff) {
    return { kind: 'ability', id: primedPayoff.id };
  }

  if (ready) {
    const candidates = unlocked.filter((a) => a.type === 'damage' && offCooldown(a.id));
    if (candidates.length > 0) {
      const best = candidates.reduce((a, b) => (b.unlockLevel > a.unlockLevel ? b : a));
      return { kind: 'ability', id: best.id };
    }
  }

  return attackOnCooldown ? { kind: 'none' } : { kind: 'attack' };
}
