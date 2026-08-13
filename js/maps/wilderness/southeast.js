const LEGEND = { '.': 'grass', '#': 'tree', '~': 'water', D: 'dungeonEntrance' };

const ROWS = [
  '..............#',
  '..............#',
  '..............#',
  '......~~......#',
  '......~~......#',
  '..............#',
  '............D.#',
  '.........##...#',
  '..............#',
  '..............#',
  '###############',
];

export const southeastMap = {
  id: 'southeast',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 7, y: 5 },
  encounterChance: 0.15,
  monsterTable: ['direWolf', 'spider'],
  neighbors: { north: 'east', south: null, east: null, west: 'south' },
};
