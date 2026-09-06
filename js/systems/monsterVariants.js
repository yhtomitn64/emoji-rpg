// Five named stat variants per regular monster type - same mechanism as
// bossTiers.js/ngPlus.js's scaled-override pattern, applied to regular
// encounters instead of the dragon. Picked randomly per encounter, not
// player-escalated. A modest +/-15% spread ("slightly different" per the
// backlog ask) - not elite-tier, that's a separate future idea.
export const VARIANT_TIERS = [
  { label: 'Puny', hpMultiplier: 0.85, attackMultiplier: 0.85 },
  { label: 'Lesser', hpMultiplier: 0.925, attackMultiplier: 0.925 },
  { label: null, hpMultiplier: 1, attackMultiplier: 1 },
  { label: 'Greater', hpMultiplier: 1.075, attackMultiplier: 1.075 },
  { label: 'Savage', hpMultiplier: 1.15, attackMultiplier: 1.15 },
];

export function pickMonsterVariant(baseMonster, rng = Math.random) {
  const tier = VARIANT_TIERS[Math.floor(rng() * VARIANT_TIERS.length)];
  return {
    name: tier.label ? `${tier.label} ${baseMonster.name}` : baseMonster.name,
    hp: Math.round(baseMonster.hp * tier.hpMultiplier),
    attack: Math.round(baseMonster.attack * tier.attackMultiplier),
  };
}

// forceFullBattle monsters (tool guardians, superbosses) never roll a
// variant - their stats are the tuned target (via
// scripts/simulate-balance.js, which never modeled variant rolling), and a
// repeatable, fleeable superboss would otherwise let a bad roll be farmed
// away by fleeing and re-triggering the encounter until a weak variant
// appears. Null means "use the monster's own base stats unchanged" -
// handleEncounter's downstream spread (`{ ...MONSTERS[id], ...overrides }`)
// already treats a null/absent override that way.
export function pickVariantOverrides(baseMonster, rng = Math.random) {
  return baseMonster.forceFullBattle ? null : pickMonsterVariant(baseMonster, rng);
}
