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
  superBossOne: {
    id: 'superBossOne', monsterId: 'superBossOne', screenId: 'farSoutheast', x: 15, y: 20, hasDungeon: true, dungeonMapId: 'superBossOneDungeon',
  },
};
