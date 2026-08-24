const LEGEND = {
  '#': 'tree',
  '.': 'grass',
  W: 'mountainWall',
  M: 'mountain',
  '~': 'water',
};

const ROWS = [
  '#.....#######................#',
  '#.....#####...................',
  '##...####.....................',
  '##..#####.....................',
  '###.####......................',
  '########......................',
  '#######............WMW........',
  '#######..WWWWWWWWWWWMWWWWWWWW.',
  '.######WWWWWWWWWWWWWMWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWW~WWWWWWWWW',
  'WWWWWWWWWWWW~~~~~~~~~~~~~~WWWW',
  'WWWWWW~~~~~~~~~~~~~~~~~~~~~~~W',
  'W~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
];

export const southSouthwestMap = {
  id: 'southSouthwest',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: 'southwest', south: null, east: 'farSouth', west: 'farSouthwest' },
};
