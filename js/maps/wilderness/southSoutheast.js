const LEGEND = { W: 'mountainWall', '.': 'grass', K: 'mountainCache', M: 'mountain', '#': 'tree' };

const ROWS = [
  'WWWW..WWWWWWWWWWWWWWWWWWWWWWWW',
  'WWWW...WWWWWWWWWWWWWWWWWWWWWWW',
  'WWWWWWKMWWWWWWWWWW............',
  'WWWWWWWMWWWWWWW...............',
  '.WWWWWWMWWWWWWW...WWWWWWW.....',
  'WWWWWWWMWWWWWW.....WWWWWWWWWWW',
  'WWWWWWWMWWWWWW......KWWWWWWWWW',
  'WWWWWWWMMMK...........WWWWWWWW',
  'WWWWWWWWWWW............WWWWWWW',
  'WWWWWWWWWW..............WWW.WW',
  'WWWWWWWW................WWW..W',
  'WWWWWWWW...............KWWW...',
  'WWWWWWW................WWWW...',
  'WWWWWWWWW..............WWWW...',
  'WWWWWWWWWWWKWWWWWW...WWWWW....',
  'WWWWWWWWWWWWWWWWWWWWWWWWWW....',
  'WWWWWWWWWWWWWWWWWWWWWWWWWW...W',
  'WWWWWWWWWWWWWWWWWWWWWWWW.....W',
  'WWWWWWWWWWWWWWWWWWWW.........W',
  'WWWWWWWWWWWWWWWWWWWW.........W',
  'WWWWWWWWWWWWWWWWWW............',
  'WWWWWWWWWWW###################',
];

export const southSoutheastMap = {
  id: 'southSoutheast',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: 'southeast', south: null, east: 'farSoutheast', west: 'farSouth' },
};
