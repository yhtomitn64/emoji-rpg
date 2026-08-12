export const TILES = {
  grass: { emoji: '🟩', walkable: true, encounter: true },
  tree: { emoji: '🌲', walkable: false, encounter: false },
  water: { emoji: '🟦', walkable: false, encounter: false },
  townEntrance: { emoji: '🏘️', walkable: true, encounter: false, action: 'enterTown' },
  dungeonEntrance: { emoji: '🕳️', walkable: true, encounter: false, action: 'enterDungeon' },
  shop: { emoji: '🏪', walkable: true, encounter: false, action: 'enterShop' },
  smith: { emoji: '⚒️', walkable: true, encounter: false, action: 'enterSmith' },
  exit: { emoji: '🚪', walkable: true, encounter: false, action: 'exitMap' },
  boss: { emoji: '🐉', walkable: true, encounter: false, action: 'bossBattle' },
};
