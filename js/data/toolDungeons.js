// Fixed, hand-placed tool-dungeon entrances - one per tool, same for every
// save (unlike the randomized-then-fixed main dungeon, these were never
// randomized). Update the screenId/x/y here to move where a tool dungeon's
// entrance sits in the wilderness; use the terrain painter tool's "Place
// Tool Dungeon Entrance" mode to pick a spot and copy the exact value.
// mapId is the MAPS registry key for that tool dungeon's own interior map
// (js/maps/toolDungeons/); tileKind is the js/tiles.js entry rendered at
// the entrance position.
export const TOOL_DUNGEON_ENTRANCES = {
  axe: {
    screenId: 'farNorth', x: 13, y: 7, mapId: 'axeDungeon', tileKind: 'axeDungeonEntrance',
  },
  pick: {
    screenId: 'southSoutheast', x: 18, y: 14, mapId: 'pickDungeon', tileKind: 'pickDungeonEntrance',
  },
  canoe: {
    screenId: 'west', x: 18, y: 13, mapId: 'canoeDungeon', tileKind: 'canoeDungeonEntrance',
  },
  // screenId/x/y are placeholders - Timothy hand-places the real spot via
  // the terrain painter's "Place Tool Dungeon Entrance" mode, same as the
  // other three (see docs/superpowers/specs/2026-09-01-portal-scroll-
  // design.md). Every place that reads TOOL_DUNGEON_ENTRANCES compares a
  // real screenId string against this null, which is always false, so a
  // null entry here is inert until it's filled in - never reachable, never
  // a crash (see tests/toolDungeonMaps.test.js's null-placeholder test).
  portal: {
    screenId: 'southSouthwest', x: 16, y: 17, mapId: 'portalDungeon', tileKind: 'portalDungeonEntrance',
  },
};
