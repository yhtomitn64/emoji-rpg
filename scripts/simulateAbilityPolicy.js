import { getUnlockedAbilities } from '../js/systems/abilities.js';

/**
 * Decides what the simulated player does on one tick, in priority order:
 *   1. Super Scream, if unlocked/off cooldown/not already active - free and
 *      strictly beneficial, so a reasonable player always takes it.
 *   2. Otherwise, the highest-unlocked damage ability that's off
 *      cooldown (all abilities share a GCD now, not a separate swing
 *      timer - see the ability-GCD rework spec).
 *   3. Otherwise, Attack - unless it's still on its own short cooldown, in
 *      which case there's nothing to do this tick.
 *
 * Post-ability-rotation-v2 (2026-09-02): no more combo-primer priority step -
 * every ability resolves independently now, there's no cross-ability
 * priming to model. Pure and side-effect-free on purpose: this is
 * unit-tested directly, kept in its own module so importing it never runs
 * simulate-balance.js's own unconditional report-printing `main()`.
 */
export function chooseAction({ level, cooldowns, buffActive, attackOnCooldown }) {
  const unlocked = getUnlockedAbilities(level);
  const offCooldown = (id) => (cooldowns[id] || 0) <= 0;

  const superScream = unlocked.find((a) => a.type === 'buff');
  if (superScream && offCooldown(superScream.id) && !buffActive) {
    return { kind: 'ability', id: superScream.id };
  }

  const candidates = unlocked.filter((a) => a.type === 'damage' && offCooldown(a.id));
  if (candidates.length > 0) {
    const best = candidates.reduce((a, b) => (b.unlockLevel > a.unlockLevel ? b : a));
    return { kind: 'ability', id: best.id };
  }

  return attackOnCooldown ? { kind: 'none' } : { kind: 'attack' };
}
