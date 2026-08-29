import { ITEMS } from '../data/items.js';

export const MAX_NG_PLUS_CYCLE = 2;
export const NG_PLUS_HP_MULTIPLIER = 2;
export const NG_PLUS_COMBAT_MULTIPLIER = 1.25;
export const NG_PLUS_REWARD_MULTIPLIER = 1.5;
export const NG_PLUS_DROP_CHANCE_MULTIPLIER = 1.5;

export function canStartNgPlus(state) {
  return Boolean(state.flags.dungeonBossDefeated) && state.ngPlusCycle < MAX_NG_PLUS_CYCLE;
}

export function getNgPlusCombatOverrides(baseMonster, cycle) {
  const hpMultiplier = NG_PLUS_HP_MULTIPLIER ** cycle;
  const combatMultiplier = NG_PLUS_COMBAT_MULTIPLIER ** cycle;
  return {
    hp: Math.round(baseMonster.hp * hpMultiplier),
    attack: Math.round(baseMonster.attack * combatMultiplier),
    defense: Math.round(baseMonster.defense * combatMultiplier),
    speed: baseMonster.speed,
  };
}

export function getNgPlusRewardMultiplier(cycle) {
  const multiplier = NG_PLUS_REWARD_MULTIPLIER ** cycle;
  return { gold: multiplier, xp: multiplier };
}

export function scaleDropTable(dropTable, cycle) {
  const multiplier = NG_PLUS_DROP_CHANCE_MULTIPLIER ** cycle;
  const isTool = (entry) => ITEMS[entry.itemId] && ITEMS[entry.itemId].type === 'tool';

  const scaled = dropTable.map((entry) => (
    isTool(entry) ? entry : { ...entry, chance: entry.chance * multiplier }
  ));

  const total = scaled.reduce((sum, entry) => (isTool(entry) ? sum : sum + entry.chance), 0);
  if (total <= 1) return scaled;

  return scaled.map((entry) => (
    isTool(entry) ? entry : { ...entry, chance: entry.chance / total }
  ));
}

const isToolItem = (itemId) => Boolean(ITEMS[itemId] && ITEMS[itemId].type === 'tool');

// Raised 2026-08-29: "NG+ should reset the tools you have otherwise you can
// go straight to dragon." Confirmed the tools form a strict earn-in-order
// chain (axe -> pick -> canoe -> dragon, per Timothy directly) - without
// this, a player who already owns every tool and has already cleared every
// tool gate keeps both across an NG+ reset, walking straight to the
// dungeon entrance with none of zone 1's tool-gated obstacles in the way.
// Both inventory and clearedGates reset together (Timothy's call,
// 2026-08-29) so NG+ reproduces the exact same reachability graph a
// brand-new save starts with - re-fighting each tool guardian already works
// with zero extra code (the guardian tile has no "already defeated" flag),
// this just makes that refight actually necessary again.
export function resetWorldForNgPlus(state) {
  return {
    ...state,
    flags: { ...state.flags, dungeonBossDefeated: false },
    inventory: state.inventory.filter((entry) => !isToolItem(entry.itemId)),
    clearedGates: {},
    // Deliberately NOT reset, unlike every other world-progress field
    // below - Timothy wants the worn-path trails kept across NG+ cycles
    // rather than every screen starting blank again. Purely cosmetic
    // (per-tile walk history for trail rendering, js/systems/exploration.js),
    // nothing else reads it as a per-cycle completion signal, so carrying
    // it forward has no other gameplay effect.
    seenScreens: {},
    caches: {},
    gateRewards: {},
    miniDungeons: {},
    activeMiniDungeon: null,
    bossTier: 0,
    map: 'center',
    position: null,
    lossStreak: 0,
    ngPlusCycle: Math.min(state.ngPlusCycle + 1, MAX_NG_PLUS_CYCLE),
  };
}

// One-time migration for saves already mid-NG+-cycle from before the fix
// above existed - resetWorldForNgPlus has never stripped tools until now,
// so any save currently at ngPlusCycle >= 1 holding tools got every one of
// them via carryover, with no legitimate "re-earned it this cycle" case to
// protect against false-positive stripping. Scoped to inventory only, not a
// retroactive clearedGates revert - re-gating terrain out from under a save
// already mid-playthrough is a bigger, more disruptive surprise than this
// migration is meant to cause; a clearedGates reset only applies
// prospectively, at each future NG+ transition (resetWorldForNgPlus above).
// Guarded by ngPlusToolsMigrated so it only ever runs once per save - without
// it, this would re-confiscate a tool the player legitimately re-earned
// after the first migration, on every subsequent load.
export function migrateNgPlusToolCarryover(state) {
  if (state.ngPlusToolsMigrated) return state;
  if (state.ngPlusCycle < 1) return { ...state, ngPlusToolsMigrated: true };
  return {
    ...state,
    inventory: state.inventory.filter((entry) => !isToolItem(entry.itemId)),
    ngPlusToolsMigrated: true,
  };
}
