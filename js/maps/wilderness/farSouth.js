const LEGEND = {
  '#': 'tree',
  '.': 'grass',
  W: 'mountainWall',
  '~': 'water',
};

const ROWS = [
  '#.......................WWWWWW',
  '........................WWWWWW',
  '........................WWWWWW',
  '........................WWWWWW',
  '..............................',
  '..............................',
  '............................WW',
  '...........................WWW',
  'WW.......................WWWWW',
  'WWWWW....................WWWWW',
  'WWWWWWW..................WWWWW',
  'WWWWWWWWWW..................WW',
  '~~WWWWWWWWW................WWW',
  '~~~~~WWWWWWW..............WWWW',
  '~~~~~~~WWWWWW............WWWWW',
  '~~~~~~~~WWWWWW..........WWWWWW',
  '~~~~~~~~~WWWWWW.........WWWWWW',
  '~~~~~~~~~~WWWWW.........WWWWWW',
  '~~~~~~~~~~~WWWW...........WWWW',
  '~~~~~~~~~~~~WWW...........WWWW',
  '~~~~~~~~~~~~WWWW.........WWWWW',
  '~~~~~~~~~~~~WWWW#########WWWWW',
];

export const farSouthMap = {
  id: 'farSouth',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: 'south', south: null, east: 'southSoutheast', west: 'southSouthwest' },
};
