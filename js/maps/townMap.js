const LEGEND = {
  '.': 'grass',
  '#': 'tree',
  S: 'shop',
  M: 'smith',
  Q: 'questBoard',
  W: 'well',
  n: 'treeGapNorth',
  s: 'treeGapSouth',
  e: 'treeGapEast',
  w: 'treeGapWest',
};

// Grown again 2026-09-03 (16x12 -> 20x14) alongside replacing the single
// south-ish door with 4 unmarked tree-gap exits, one centered on each
// wall - see docs/superpowers/specs/2026-09-03-town-exits-and-signage-
// design.md. Previously grown 2026-08-29 from the original 8x6 (see the
// history that used to live in this comment) when the viewport itself
// grew in 0.7.1 and made the old size read as tiny. Still just a hub,
// not exploration content - Timothy can hand-tune this layout further
// the same way he did last time.
const ROWS = [
  '##########n#########',
  '#..................#',
  '#....Q.............#',
  '#..................#',
  '#..................#',
  '#...S.........M....#',
  '#..................#',
  'w..................e',
  '#..................#',
  '#.............W....#',
  '#..................#',
  '#..................#',
  '#..................#',
  '##########s#########',
];

export const townMap = {
  id: 'town',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 10, y: 10 },
  encounterChance: 0,
  cacheChance: 0,
  monsterTable: [],
};
