const LEGEND = { '~': 'water', W: 'mountainWall', '.': 'grass', '#': 'tree', M: 'mountain' };

const ROWS = [
  '~~~~~~~~WWWWWWWWW~~~~~........',
  '~~~~~~~WWWWWW.....~~~~........',
  '~~~~~WWWWWW.......~~~~........',
  '~~~~WWWWW.........~~~~~.......',
  '~~~WWWWW...........~~~~.......',
  '~~~WWWW............~~~~.......',
  '~~WWW..............~~~~.......',
  '~~WWW...............~~~.......',
  '~WWW................~~~.......',
  '#WW.................~~~.......',
  '#W..................~~~.......',
  '#..................~~~~MMM....',
  '#..................~~~~MMM....',
  '#..................~~~~MMM....',
  '#........###.......~~~MMMM....',
  '#........####......~~~MMMM....',
  '#........####.....~~~MMMMM....',
  '#........####.....~~~MMMM.....',
  '#........####....~~~~MMMM.....',
  '#........####....~~~MMMM......',
  '#.......####.....~~~MMMM......',
  '#.......####....~~~MMMMM......',
];

export const westNorthwestMap = {
  id: 'westNorthwest',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 15, y: 11 },
  encounterChance: 0.15,
  cacheChance: 0.03,
  miniDungeonChance: 0.005,
  monsterTable: ['direWolf', 'spider', 'scorpion'],
  neighbors: { north: 'farNorthwest', south: 'farWest', east: 'northwest', west: null },
};
