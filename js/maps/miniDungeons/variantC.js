const LEGEND = {
  '.': 'caveFloor',
  '#': 'caveWall',
  E: 'miniDungeonEntrance',
  T: 'miniDungeonTreasure',
};

const ROWS = [
  '##############',
  '#E...........#',
  '#.##.....##..#',
  '#.##.....##..#',
  '#............#',
  '#..##.....##.#',
  '#..##.....##.#',
  '#............#',
  '#...........T#',
  '##############',
];

export const miniDungeonVariantC = {
  id: 'miniDungeonC',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 1, y: 1 },
  encounterChance: 0.2,
  monsterTable: ['orc', 'wraith'],
};
