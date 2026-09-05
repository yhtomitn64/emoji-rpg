const LEGEND = { '#': 'tree', '.': 'grass', W: 'mountainWall', T: 'thicket', '~': 'water', M: 'mountain' };

const ROWS = [
  '#.....#######.................',
  '#.....#####...................',
  '##...####.....................',
  '##..#####.....................',
  '###.####......................',
  '########......................',
  '#######............WTW........',
  '#######..WWWWWWWWWWWTWWWWWWWW.',
  '.######WWWWWWWWWWWWWTWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWW~WWWWWWWWW',
  'WWWWWWWWWWWW~~~~~~~~~~~~~~WWWW',
  'WWWWWW~~~~~~~~~~~~~~~~~~~~~~~W',
  'W~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~.~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~...MMM.~~~~~.~~~~~~',
  '~~~~~~~~~~~~.MM.MMM.~~..~~~~~~',
  '~~~~~~~~~.....M..MM.....~~~~~~',
  '~~~~~~~~~.....MMMMM..~~~~~~~~~',
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
