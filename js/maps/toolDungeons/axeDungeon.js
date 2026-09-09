const LEGEND = {
  '.': 'grass',
  '#': 'tree',
  E: 'exit',
  G: 'guardian',
};

// Raised 2026-09-07: "make the tool bosses take up like 4 tiles instead of
// 1 so they look big and scary, and in the center of their map instead of
// the corner, and make the map bigger." Enlarged from 14x8 to 21x13 -
// matches DEFAULT_VIEWPORT_TILES_WIDE/TALL (js/screens/mapScreen.js), so
// the whole arena fits a typical desktop window at once - and the guardian
// (G) moved from the old bottom-right corner to dead center (10, 6). The
// "big and scary" half of this is purely visual, not a map change - see
// GUARDIAN_CQB in mapScreen.js.
const ROWS = [
  '#####################',
  '#E..................#',
  '#...................#',
  '#....##.............#',
  '#....##.............#',
  '#...................#',
  '#.........G.........#',
  '#...................#',
  '#...................#',
  '#............###....#',
  '#...................#',
  '#...................#',
  '#####################',
];

export const axeDungeonMap = {
  id: 'axeDungeon',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 1, y: 1 },
  encounterChance: 0,
  cacheChance: 0,
  monsterTable: [],
  guardianMonsterId: 'axeGuardian',
};
