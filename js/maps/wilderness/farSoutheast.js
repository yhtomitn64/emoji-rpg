const LEGEND = {
  W: 'mountainWall',
  '.': 'grass',
  '#': 'tree',
  T: 'thicket',
};

const ROWS = [
  'WWWW.........................#',
  'WWWWW........................#',
  '.WWWW........................#',
  '..WWWW.......................#',
  '..WWWW.......................#',
  '..WWWWWWWWWWW......WWWWWW....#',
  'W..WWWWWWWWWWWWWWWWWWWWWWWW..#',
  'WW..WWWWWWWWWWWWWWWWWWWWWWW..#',
  'WW........WWWWWWWWWWW.WWWWWWT#',
  'WWWWW...................WWWWT#',
  'WWWWWWW.................WWWWT#',
  'WWWWWWWWWWWW......WWWWW.WWWWT#',
  '..WWWWWWWWWWWWWWWWWWWWW.WWWWT#',
  '.....WWWWWWWWWWWWWWWWWW.WWWWT#',
  '.........WWWWWWWWWWWW...WWWWT#',
  '......................WWWWWWT#',
  'WWWWWWWWWWWWWWWW.....WWWWWWWT#',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWW..#',
  'WWWWWWWWWWWWWWWWWWWWWWWWW....#',
  'WW...........WWWWWWWWWWW.....#',
  '.............................#',
  '##############################',
];

export const farSoutheastMap = {
  id: 'farSoutheast',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: 'eastSoutheast', south: null, east: null, west: 'southSoutheast' },
};
