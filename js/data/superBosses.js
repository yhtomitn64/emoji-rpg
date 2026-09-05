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
export const SUPER_BOSSES = {};
