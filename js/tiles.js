export const TILES = {
  grass: {
    emoji: '🟩', walkable: true, encounter: true, description: 'Field — wild monsters may appear',
    // Mostly empty - grass renders as a solid green background (see
    // js/screens/mapScreen.js), and these are only the occasional
    // decorative clover/flower drawn on top of it, not a replacement.
    variants: ['', '', '', '', '', '', '', '', '🍀', '🌼'],
  },
  tree: { emoji: '🌲', walkable: false, encounter: false, description: 'Tree — blocks the way' },
  // Blank variant - water renders as a solid blue background (see
  // js/screens/mapScreen.js) instead of a per-tile square emoji, so
  // adjacent water tiles blend into one contiguous body of water.
  water: {
    emoji: '🟦', walkable: false, encounter: false, requiresTool: 'boat', description: 'Water — needs a boat to cross',
    variants: [''],
  },
  townEntrance: { emoji: '🏘️', walkable: true, encounter: false, action: 'enterTown', description: 'Town — shop, smith, and quest board' },
  dungeonEntrance: { emoji: '🕳️', walkable: true, encounter: false, action: 'enterDungeon', description: 'Dungeon — the way to the boss' },
  shop: { emoji: '🏪', walkable: true, encounter: false, action: 'enterShop', description: 'Shop — buy and sell gear' },
  smith: { emoji: '⚒️', walkable: true, encounter: false, action: 'enterSmith', description: 'Smith — upgrade your equipment' },
  exit: { emoji: '🚪', walkable: true, encounter: false, action: 'exitMap', description: 'Door — leave this area' },
  boss: { emoji: '🐉', walkable: true, encounter: false, action: 'bossBattle', description: 'The dragon awaits' },
  caveFloor: { emoji: '⬛', walkable: true, encounter: true, description: 'Cave floor — wild monsters may appear' },
  caveWall: { emoji: '🪨', walkable: false, encounter: false, description: 'Cave wall — blocks the way' },
  cavePool: { emoji: '💧', walkable: false, encounter: false, description: 'Underground pool — blocks the way' },
  miniDungeonEntrance: { emoji: '🪜', walkable: true, encounter: false, action: 'exitMiniDungeon', description: 'Ladder — climb back to the surface' },
  miniDungeonTreasure: { emoji: '💰', walkable: true, encounter: false, action: 'collectTreasure', description: 'Treasure — step here to collect it' },
  questBoard: { emoji: '📋', walkable: true, encounter: false, action: 'enterQuestBoard', description: 'Quest Board — turn in completed quests' },
  well: { emoji: '⛲', walkable: true, encounter: false, action: 'useWell', description: 'Well — rest here to fully heal, free' },
  mountainWall: { emoji: '🗻', walkable: false, encounter: false, description: 'Mountain — a permanent wall, no tool clears it' },
  mountain: { emoji: '⛰️', walkable: false, encounter: false, requiresTool: 'miningPick', description: 'Mountain — needs a mining pick to clear' },
  mountainCache: { emoji: '⛰️', walkable: false, encounter: false, requiresTool: 'miningPick', hasReward: true, description: 'Mountain — needs a mining pick to clear' },
  thicket: { emoji: '🌳', walkable: false, encounter: false, requiresTool: 'axe', description: 'Thicket — needs an axe to clear' },
  thicketCache: { emoji: '🌳', walkable: false, encounter: false, requiresTool: 'axe', hasReward: true, description: 'Thicket — needs an axe to clear' },
  // What a thicket/mountain permanently becomes the first time it's crossed
  // with the right tool - ordinary walkable ground (same encounter odds as
  // grass) with a visible "you cleared this" marker, rather than silently
  // reverting to plain grass or staying the original blocking tile forever.
  // Water is deliberately excluded from this conversion - canoeing across it
  // shouldn't change the tile at all (raised 2026-08-28).
  stump: { emoji: '🪵', walkable: true, encounter: true, description: 'Stump — the thicket here has been cleared' },
  rubble: { emoji: '🪨', walkable: true, encounter: true, description: 'Rubble — the mountain here has been cleared' },
  axeDungeonEntrance: { emoji: '🪓', walkable: true, encounter: false, action: 'enterAxeDungeon', description: 'A guarded passage — the axe lies beyond' },
  pickDungeonEntrance: { emoji: '⛏️', walkable: true, encounter: false, action: 'enterPickDungeon', description: 'A guarded passage — the mining pick lies beyond' },
  canoeDungeonEntrance: { emoji: '🛶', walkable: true, encounter: false, action: 'enterCanoeDungeon', description: 'A guarded passage — the boat lies beyond' },
  portalDungeonEntrance: { emoji: '🌌', walkable: true, encounter: false, action: 'enterPortalDungeon', description: 'A guarded passage — a portal lies beyond' },
  portalOrigin: { emoji: '🌌', walkable: true, encounter: false, action: 'enterPortalToTown', description: 'A swirling portal — steps through to town' },
  portalReturn: { emoji: '🌌', walkable: true, encounter: false, action: 'enterPortalToOrigin', description: 'A swirling portal — steps through back where you left it' },
  guardian: { emoji: '⚔️', walkable: true, encounter: false, action: 'guardianBattle', description: 'A guardian blocks the way — defeat it to claim its tool' },
};
