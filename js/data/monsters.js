export const MONSTERS = {
  // Near-town roster (boar/bat/snake/goblin/frog) and far-corner roster
  // (direWolf/spider/scorpion) had their attack raised 2026-09-02.
  // calculateDamage floors at 1 once defense >= attack
  // (js/systems/combat.js), and these were still at their original ~9-14
  // attack while player defense climbs every level - by ~L4-5 combat was
  // already 0-potion floor damage. A bump big enough to still clear the
  // full-iron-gear defense band (~19-22, the bar orc/wraith/skeleton
  // below were tuned to) turned out to make the very first L1 fight
  // dangerously swingy instead (a flat monster attack has to work across
  // the whole L1-to-full-iron defense spread, and that spread is too
  // wide for one number to be safe at both ends) - see
  // docs/superpowers/specs/2026-09-01-balance-tuning-roadmap-handoff.md's
  // Session 3. Settled for a smaller bump that keeps L1 safe and pushes
  // the trivialization point later into leveling, accepting these floor
  // out again by full iron gear same as before - by then the player has
  // moved on to dungeon-tier content anyway.
  boar: {
    id: 'boar', name: 'Snorty McPigface', emoji: '🐗',
    hp: 77, attack: 15, defense: 1, speed: 4,
    xp: 16, goldRange: [4, 8],
    dropTable: [{ itemId: 'leatherScrap', chance: 0.3 }, { itemId: 'potion', chance: 0.1 }],
    attackStyle: 'melee',
  },
  bat: {
    id: 'bat', name: 'Spooky Pancake', emoji: '🦇',
    hp: 55, attack: 13, defense: 0, speed: 7,
    xp: 11, goldRange: [2, 7],
    dropTable: [{ itemId: 'batWing', chance: 0.25 }, { itemId: 'potion', chance: 0.1 }],
    attackStyle: 'melee',
  },
  snake: {
    id: 'snake', name: 'Slippery Breadstick', emoji: '🐍',
    hp: 60, attack: 15, defense: 1, speed: 5,
    xp: 16, goldRange: [4, 9],
    dropTable: [{ itemId: 'snakeFang', chance: 0.25 }, { itemId: 'potion', chance: 0.1 }],
    attackStyle: 'melee',
  },
  goblin: {
    id: 'goblin', name: 'Mean Meatball', emoji: '👺',
    hp: 67, attack: 15, defense: 2, speed: 4,
    xp: 22, goldRange: [5, 13],
    dropTable: [
      { itemId: 'goblinClub', chance: 0.15 },
      { itemId: 'ironScrap', chance: 0.2 },
      { itemId: 'potion', chance: 0.1 },
    ],
    attackStyle: 'ranged', projectileEmoji: '🍙',
  },
  direWolf: {
    id: 'direWolf', name: 'Mega Muffin', emoji: '🐺',
    hp: 100, attack: 19, defense: 3, speed: 6,
    xp: 32, goldRange: [8, 15],
    dropTable: [{ itemId: 'wolfPelt', chance: 0.3 }, { itemId: 'potion', chance: 0.1 }],
    attackStyle: 'melee',
  },
  spider: {
    id: 'spider', name: 'Eight-Leg Eggroll', emoji: '🕷️',
    hp: 85, attack: 17, defense: 2, speed: 5,
    xp: 29, goldRange: [7, 14],
    dropTable: [{ itemId: 'spiderSilk', chance: 0.3 }, { itemId: 'potion', chance: 0.1 }],
    attackStyle: 'ranged', projectileEmoji: '🥟',
  },
  frog: {
    id: 'frog', name: 'Ribbity Ravioli', emoji: '🐸',
    hp: 58, attack: 13, defense: 1, speed: 6,
    xp: 13, goldRange: [3, 8],
    dropTable: [{ itemId: 'frogSkin', chance: 0.3 }, { itemId: 'potion', chance: 0.1 }],
    attackStyle: 'melee',
  },
  scorpion: {
    id: 'scorpion', name: 'Spicy Skewer', emoji: '🦂',
    hp: 90, attack: 18, defense: 3, speed: 6,
    xp: 30, goldRange: [7, 15],
    dropTable: [{ itemId: 'scorpionVenom', chance: 0.3 }, { itemId: 'potion', chance: 0.1 }],
    attackStyle: 'melee',
  },
  // Tool-dungeon guardians: guaranteed (chance: 1) single-item drop, so
  // placing their dungeon is a reliable way to gate progression on a specific
  // tool. forceFullBattle skips the usual solo-weak-mob pre-fight
  // surrender/flee roll (js/main.js handleEncounter) - deliberately NOT
  // isBoss, since isBoss also sets state.flags.dungeonBossDefeated (which
  // would falsely unlock NG+ before the real dragon is ever fought) and
  // blocks fleeing mid-battle, neither of which apply here. Stats sit a step
  // above the corner-tier roster (direWolf/spider/scorpion) since a
  // guaranteed-reward mini-boss should feel tougher than an ordinary
  // wilderness encounter, but well under dungeon-tier (orc/wraith) so an
  // early gate doesn't require end-game gear.
  axeGuardian: {
    id: 'axeGuardian', name: 'Axe Guardian', emoji: '🪓',
    hp: 140, attack: 18, defense: 5, speed: 7,
    xp: 45, goldRange: [15, 25],
    dropTable: [{ itemId: 'axe', chance: 1 }],
    forceFullBattle: true,
    attackStyle: 'melee',
  },
  pickGuardian: {
    id: 'pickGuardian', name: 'Pick Guardian', emoji: '⛏️',
    hp: 140, attack: 18, defense: 5, speed: 7,
    xp: 45, goldRange: [15, 25],
    dropTable: [{ itemId: 'miningPick', chance: 1 }],
    forceFullBattle: true,
    attackStyle: 'melee',
  },
  // Sits behind a gate meant to require axe + pick already (Timothy's map
  // design, not enforced in code - see TOOL_DUNGEON_ENTRANCES's boat entry
  // placement), so a step tougher than the axe/pick guardians.
  boatGuardian: {
    id: 'boatGuardian', name: 'Boat Guardian', emoji: '🛶',
    hp: 175, attack: 24, defense: 7, speed: 8,
    xp: 55, goldRange: [18, 28],
    dropTable: [{ itemId: 'boat', chance: 1 }],
    forceFullBattle: true,
    attackStyle: 'melee',
  },
  // Sits behind a gate meant to require axe + pick + boat already
  // (Timothy's map design, not enforced in code) - a step tougher than
  // boatGuardian, since "free repeatable trip to/from town from
  // anywhere" is the strongest of the four tools. See
  // docs/superpowers/specs/2026-09-01-portal-scroll-design.md.
  portalGuardian: {
    id: 'portalGuardian', name: 'Portal Guardian', emoji: '🌌',
    hp: 210, attack: 28, defense: 9, speed: 9,
    xp: 65, goldRange: [22, 32],
    dropTable: [{ itemId: 'portalCircle', chance: 1 }],
    forceFullBattle: true,
    attackStyle: 'melee',
  },
  dragon: {
    id: 'dragon', name: 'Dragon', emoji: '🐉',
    hp: 150, attack: 34, defense: 12, speed: 11,
    xp: 200, goldRange: [65, 100],
    dropTable: [
      { itemId: 'dragonScaleMail', chance: 0.6 },
      { itemId: 'dragonFang', chance: 0.4 },
    ],
    isBoss: true,
    attackStyle: 'ranged', projectileEmoji: '🔥',
  },
  // Dungeon tier. Attack is deliberately set well above the ~19-22 defense a
  // player reaches with the full iron shop set, so stacking cheap defense no
  // longer drops these to the calculateDamage 1-point floor. See
  // scripts/simulate-balance.js for the tuning evidence.
  orc: {
    id: 'orc', name: 'Super Mean Meatloaf', emoji: '👹',
    hp: 180, attack: 32, defense: 8, speed: 8,
    xp: 60, goldRange: [18, 28],
    dropTable: [{ itemId: 'orcTusk', chance: 0.3 }, { itemId: 'potion', chance: 0.1 }],
    attackStyle: 'melee',
    // Optional field: dungeon-tier only. ~35% chance to replace generic "A wild X appears!" (see pickAppearLine in js/systems/combat.js).
    flavorLines: [
      'You smell burnt garlic bread. Super Mean Meatloaf has entered the room.',
      'Super Mean Meatloaf lumbers out of the shadows, still steaming with rage.',
      'Super Mean Meatloaf glares at you like you insulted its secret recipe.',
    ],
  },
  wraith: {
    id: 'wraith', name: 'Ghost Apple Supreme', emoji: '👻',
    hp: 170, attack: 32, defense: 4, speed: 11,
    xp: 63, goldRange: [18, 30],
    dropTable: [{ itemId: 'wraithEssence', chance: 0.3 }, { itemId: 'potion', chance: 0.1 }],
    attackStyle: 'ranged', projectileEmoji: '🍎',
    flavorLines: [
      'A chill rolls in. Ghost Apple Supreme has come for seconds.',
      'Ghost Apple Supreme drifts through the wall, unnervingly translucent and smelling faintly of cinnamon.',
      'Ghost Apple Supreme rattles its core ominously.',
    ],
  },
  skeleton: {
    id: 'skeleton', name: 'Bone-in Biscuit', emoji: '💀',
    hp: 175, attack: 32, defense: 6, speed: 9,
    xp: 61, goldRange: [18, 29],
    dropTable: [{ itemId: 'boneFragment', chance: 0.3 }, { itemId: 'potion', chance: 0.1 }],
    attackStyle: 'ranged', projectileEmoji: '🦴',
    flavorLines: [
      'Bones rattle in the dark. Bone-in Biscuit clatters toward you.',
      'Something crunches underfoot — Bone-in Biscuit was already here.',
      'Bone-in Biscuit assembles itself from the rubble, grinning without lips.',
    ],
  },
  // Rare elite, injected by js/systems/eliteEncounter.js at a flat 5% chance
  // whenever a regular encounter would fire (wilderness or dungeon), always
  // solo. Deliberately not isBoss - playerFlee() only blocks fleeing when
  // isBoss is set, so this stays fleeable for free. Stats are 88% of the
  // dragon's own tier-0 stats (150/34/12/11): a real near-dragon gear-check,
  // not literally boss-equivalent.
  jurassicJerky: {
    id: 'jurassicJerky', name: 'Jurassic Jerky', emoji: '🦖',
    hp: 132, attack: 30, defense: 11, speed: 10,
    xp: 160, goldRange: [55, 90],
    dropTable: [{ itemId: 'fossilFang', chance: 0.5 }, { itemId: 'potion', chance: 0.15 }],
    attackStyle: 'ranged', projectileEmoji: '🍖',
    isElite: true,
  },
};
