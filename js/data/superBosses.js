// Position-keyed registry for hand-placed super-bosses, parallel to
// js/data/toolDungeons.js's TOOL_DUNGEON_ENTRANCES - but a superboss can
// either sit directly in the open wilderness (hasDungeon: false, fought
// on the spot via the superBossMarker tile) or behind its own dungeon
// entrance (hasDungeon: true, dungeonMapId points at a MAPS registry key
// under js/maps/superBosses/). See
// docs/superpowers/specs/2026-09-05-superboss-pass-design.md.
//
// A fresh entry starts with screenId: null, x: null, y: null - inert
// (never matches a real screen) until placed via the terrain painter's
// "Place Super-Boss Marker" mode (js/screens/mapScreen.js's tileAt()
// compares screenId against this null, which is always false - same
// invariant TOOL_DUNGEON_ENTRANCES.portal relied on before it was placed).
export const SUPER_BOSSES = {
  // First real entry (the super-boss pass's worked example). screenId/x/y
  // start null - hand-written stub here (mirrors TOOL_DUNGEON_ENTRANCES'
  // own convention: monsterId/dungeonMapId are authored by hand, only the
  // position fields get placed via the terrain painter's "Place Super-Boss
  // Marker" mode, since there's no tooling to create a brand-new registry
  // entry from scratch, only to patch position fields of an existing one).
  // Placed for real via tools/terrain-painter/'s Node server - see
  // task-14-report.md for the exact steps.
  //
  // Moved 2026-09-07 (x/y only, screenId unchanged): the original (15, 20)
  // sat directly on farSoutheast's row-20 corridor, its only open east-west
  // crossing into southSoutheast (west neighbor) - since the entrance tile
  // is walkable and instantly enters the dungeon on step (no confirmation,
  // same as every other dungeon entrance), a player approaching from the
  // east had no way to cross that row without walking straight into a
  // level-appropriate-for-nobody-yet superboss fight, right on a path
  // toward the pick tool. Raised live by Timothy, mid-playthrough at level
  // 5, unable to get past. New position (15, 9) is a walled-off interior
  // pocket on the same screen (open ground per the ROWS grid, verified
  // against the real underlying tile, not just guessed from the ASCII art)
  // - off the through-corridor, not on any tool-dungeon-entrance or main-
  // dungeon-entrance tile. Same screen kept deliberately (still reads as
  // "the big scary thing out toward the far southeast corner"), just off
  // the road. superBosses.test.js's placement checks (in-bounds, walkable
  // underneath, no collisions) cover exactly this class of mistake.
  superBossOne: {
    id: 'superBossOne', monsterId: 'superBossOne', screenId: 'farSoutheast', x: 15, y: 9, hasDungeon: true, dungeonMapId: 'superBossOneDungeon',
  },
};
