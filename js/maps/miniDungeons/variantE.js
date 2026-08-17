const LEGEND = {
  '.': 'caveFloor',
  '#': 'caveWall',
  '~': 'cavePool',
  E: 'miniDungeonEntrance',
  T: 'miniDungeonTreasure',
};

const ROWS = [
  '##############',
  '#E....~~.....#',
  '#.....~~.....#',
  '#............#',
  '#....####....#',
  '#....####....#',
  '#............#',
  '#............#',
  '#...........T#',
  '##############',
];

export const miniDungeonVariantE = {
  id: 'miniDungeonE',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 1, y: 1 },
  encounterChance: 0.2,
  monsterTable: ['orc', 'wraith'],
};
