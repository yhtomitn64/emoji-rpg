const LEGEND = {
  '.': 'grass',
  '#': 'tree',
  S: 'shop',
  M: 'smith',
  Q: 'questBoard',
  E: 'exit',
  W: 'well',
};

// Raised 2026-08-29: "can we have the town be larger again? ... right now
// it looks silly taking up such a small part of the screen." The town's own
// tile grid was actually always this small (8x6, never resized before) -
// what changed was the viewport around it, which grew a lot in 0.7.1 (the
// map now fills the real browser window instead of a fixed 1020x700px cap).
// A town that used to look reasonably sized against a small capped
// viewport now reads as a tiny cluster in the corner of a much bigger one.
// Grown to 16x12 (still nowhere near a full 32x22 wilderness screen - it's
// a hub, not exploration content) with more breathing room between
// buildings. Timothy's own note: other towns can scale differently later -
// this is just town 1.
const ROWS = [
  '################',
  '#..............#',
  '#...Q..........#',
  '#..............#',
  '#..S.......M...#',
  '#..............#',
  '#..............#',
  '#..............#',
  '#..........W...#',
  '#..............#',
  '#......E.......#',
  '################',
];

export const townMap = {
  id: 'town',
  legend: LEGEND,
  rows: ROWS,
  startPosition: { x: 7, y: 9 },
  encounterChance: 0,
  cacheChance: 0,
  monsterTable: [],
};
