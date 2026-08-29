// Hand-curated, player-facing changelog shown in the in-game "What's New"
// screen. Deliberately separate from the technical CHANGELOG.md (which is
// written in developer prose - file names, function names, internal
// mechanics) - this file only lists things a player would actually notice
// or care about while playing. Keep it in sync manually: add a new entry
// here alongside any CHANGELOG.md entry that's actually gameplay-facing.
export const PLAYER_CHANGELOG = [
  {
    version: '0.7.4',
    date: '2026-08-29',
    highlights: [
      'Added a "Sell Duplicate Gear" button to the inventory\'s Gear tab — auto-sells every extra unequipped copy of the same item (keeping one) at the usual half price, to clean up clutter.',
      'Fixed the "what you got" popup after a fight sometimes appearing on top of the inventory screen if you opened it while the popup was still fading out.',
    ],
  },
  {
    version: '0.7.3',
    date: '2026-08-29',
    highlights: [
      'Fixed getting thrown into back-to-back fights with barely a step in between — you\'re now guaranteed at least a couple of free steps after any random encounter before the next one can trigger.',
    ],
  },
  {
    version: '0.7.2',
    date: '2026-08-29',
    highlights: [
      'Dragon Fang Blade, Fossil Fang, and Dragon Scale Mail (the dragon\'s own boss-drop gear) got a stat buff.',
      'Fixed upgrading a Fine or Superior copy of gear at the smith sharing its upgrade level with the Plain copy — each quality tier now upgrades independently.',
      'Fixed the inventory list sometimes showing the same stat change for a Plain and a Fine copy of the same item, even though the Fine copy is genuinely stronger.',
      'Fixed the Shop/Smith screen\'s close button overlapping a long title.',
    ],
  },
  {
    version: '0.7.1',
    date: '2026-08-29',
    highlights: [
      'Inventory screen now has switchable tabs (Gear/Materials/Potions/Tools) instead of one long scrolling list, plus a sort control.',
      'The map now fills the actual size of your browser window instead of stopping at a fixed size.',
      'The header now stays visible at the top of the screen instead of scrolling out of view.',
      'The random mini-dungeon map marker no longer uses the same icon as the mining pick, so it\'s no longer confusable with actually receiving one.',
      'Fixed the tool-pickup celebration animation popping up in the middle of the screen instead of around your character, and slowed it down for more effect.',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-08-29',
    highlights: [
      'Exploring the wilderness is now one smooth, continuously-scrolling world instead of separate screens — no more getting stuck invisible inside a mountain or tree right after crossing into a new area, and clearing a tree/mountain with the right tool now works correctly even when you cross into it from the screen next door.',
    ],
  },
  {
    version: '0.6.1',
    date: '2026-08-28',
    highlights: [
      'Fixed the map staying stuck at its old, oversized layout after resizing the browser window on Safari (Chrome was never affected).',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-08-28',
    highlights: [
      "Added an in-game version number and a \"What's New\" changelog screen.",
      'The wilderness map grew from a 3x3 grid to a full 5x5 grid — 16 new areas to explore around town.',
      'Added five combat abilities that unlock as you level up (Stab, Chop, Slash, Sweep, Super Scream) — they combo together for bonus damage and each has its own cooldown and a timing minigame for extra damage on a well-timed hit.',
      'Monster attacks now telegraph with a wind-up bar you can parry — a well-timed parry fully blocks the hit and reflects damage straight back.',
      'Wilderness encounters can now throw multiple monsters of the same type at you at once, once you’ve fought that species enough.',
      'Monster kills can now drop higher-quality Fine/Superior gear, or rare unique items with special effects like lifesteal, bonus elemental damage, extra swings, or a crit chance boost.',
      'A rare, tough elite monster (Jurassic Jerky) can now appear in place of a normal encounter, dropping a powerful unique weapon.',
      'Three new monsters added across the difficulty tiers, each with its own material drop, and regular monsters now come in named variants (Puny, Lesser, Greater, Savage) with different stats instead of always being identical.',
      'Monster attacks now look different depending on the monster — melee monsters lunge at you, ranged ones fire a projectile first.',
      'Monsters you’ve heavily outleveled can now surrender or flee instead of fighting to the death.',
      'Losing a battle now lets you choose between a free trip home or paying gold to warp straight back to the dungeon entrance, and you can choose which dragon tier to fight in a rematch instead of always being pushed to the next one.',
      'The dungeon entrance is now in a random spot for each new character, and clearing a tree/mountain with the right tool now leaves a visible stump or rubble behind instead of looking unchanged.',
      'Quest rewards now scale up the more you turn in (though each level takes one more kill), and the town quest board glows when a turn-in is ready.',
      'A new Switch Character HUD button lets you return to character select without closing the tab.',
      'Buying new gear in the shop now offers to equip it immediately, showing how your stats would change; the shop and smith also got proper X close buttons and an L key shortcut to leave.',
      'Picking up a tool for the first time, your first kill, and every level-up now trigger a bigger celebration explaining what you just unlocked — including announcing any new ability by name.',
      'You can now choose from a lot more hero emoji, including skin-tone options.',
      'The title screen got a real visual makeover, battles now swirl in and out with a bit of flourish, and landing a perfectly-timed hit or parry shows a flashy "PERFECT!" badge.',
      'Damage numbers are bigger and last longer, crits get a distinct glowing gold number with extra screen shake, and killed monsters now spin and fade away instead of just vanishing.',
      'Paths you walk often now wear a visible dirt trail into the ground that carries over into New Game+, and grass tiles vary in appearance instead of all looking identical.',
      'Fixed several map rendering glitches — the hero no longer vanishes behind bushes or trees, and shop/smith/well/quest board tiles display properly instead of as tiny text.',
      'Fixed parries against ranged attackers (goblins, spiders, the dragon, etc.) sometimes not registering even with perfect timing, and the parry bar’s visuals now match its real timing window.',
      'Spamming the basic Attack button is now much less effective and gets progressively slower the more you do it — using your ability rotation is the better strategy.',
      'Leveling now takes noticeably longer and several early abilities deal less damage than before, so early fights should feel less trivial.',
      'The game now hints when you’re near something that needs a tool (axe, pick, etc.) before you actually run into it.',
      'Fixed a mini-dungeon entrance sometimes blocking the only path through a screen, and fixed exiting a tool dungeon dropping you at the wrong spot instead of right at the entrance.',
      'Picking up an item now shows a small popup near the Inventory button confirming what you got.',
      'Fixed your HP shown in the HUD not updating live during a fight, and the Smith’s upgrade button not greying out when you couldn’t afford it.',
    ],
  },
  {
    version: '0.5.1',
    date: '2026-08-17',
    highlights: [
      'New characters now get an honest heads-up in town about how much armor matters early on — going in with none makes early fights brutally hard.',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-08-17',
    highlights: [
      'Potions can now be drunk without losing your turn, and can occasionally crit-heal.',
      'Landing a hit now knocks the target’s action gauge back — works both ways, for you and monsters.',
      'Two new items added for speed-focused builds: Wind Greaves (extra speed) and Frost Charm (slows enemies down).',
      'Being fast enough now grants a small bonus to damage.',
      'Battle screen backgrounds got a visual touch-up, with more spread-out scenery and a wider panel.',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-08-17',
    highlights: [
      'Potions can now be drunk from the inventory screen outside of battle, not just mid-fight.',
      'Every non-dragon monster now has a chance to drop a potion.',
      'The shop now lets you sell back any item you own at half price, with bulk buy/sell shortcuts.',
      'The quest board got a "Turn In All" button.',
      'You can now pick your hero’s emoji at character creation.',
      'Every map tile now has a hover tooltip explaining what it is, and items show tooltips wherever they appear.',
      'Added a Loot Reference screen listing every item, whether you own it, and where to find it.',
      'Added a town well for free, unlimited healing outside of combat.',
      'Battle screens now show environmental decoration (rocks and pickaxes in the dungeon, trees in the wilderness) instead of a bare panel.',
      'Two more mini-dungeon layouts added, so cave discoveries repeat less often.',
      'Fixed the enemy being unable to attack at all once your own action gauge was full — you could previously stall forever without ever getting hit.',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-08-17',
    highlights: [
      'Your first kill and every level-up now trigger a celebration effect.',
    ],
  },
  {
    version: '0.2.2',
    date: '2026-08-17',
    highlights: [
      'Buttons and menus across the game got a real visual style instead of plain browser defaults, and panels now use much more of the screen on large monitors.',
    ],
  },
  {
    version: '0.2.1',
    date: '2026-08-17',
    highlights: [
      'Fixed the dragon rematch prompt’s "Not yet" button sometimes starting a fight anyway instead of actually declining.',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-08-17',
    highlights: [
      'Equipment upgrades are now capped at 3 levels instead of unlimited.',
      'The dragon rematch prompt now shows which difficulty tiers you’ve actually cleared.',
    ],
  },
  {
    version: '0.1.1',
    date: '2026-08-17',
    highlights: [
      'Fixed dragon tier progress advancing even on a loss, instead of only on an actual win.',
      'Fixed the inventory panel being able to grow past the screen with a long item list, hiding the Close button.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-08-17',
    highlights: [
      'The core game: an emoji RPG with a grid overworld, emoji-triggered battles, a town shop and smith, and one dungeon with a boss dragon.',
      'The world expanded from one map into a 3x3 grid of linked screens around town, getting harder the further you go.',
      'Battle screen got hit feedback (flashes, shakes, floating damage numbers), visible action gauges, and a full combat log.',
      'Every wilderness screen quadrupled in size with its own distinct layout and a first-visit description.',
      'Added opt-in dragon rematch tiers with escalating difficulty and rewards.',
      'Added loot caches — a chance to find a small stash of gold or an item out in the wilderness.',
      'Added mini-dungeons — rare, discoverable side areas with their own monsters and loot.',
      'Trash monsters got goofy silly names (the boss keeps its serious name).',
      'Added named, multi-slot save files and a repeatable New Game+ mode.',
      'Added an inventory and equipment screen — see your unequipped gear, compare stats, and choose what to equip.',
      'Added tool-gating: a mining pick and axe, found in the dungeon, permanently unlock shortcuts and loot in the wilderness.',
      'Reworked the player growth curve to stop late-game trivialization.',
      'Added a quest board with repeatable quests for specific monsters, rewarding guaranteed upgrade materials.',
      'Made the early game genuinely tough — armor stops being optional, and difficulty keeps escalating all the way to the dragon.',
      'Added a comeback mechanic (free potions after a losing streak), a status log, and a revival animation on defeat.',
    ],
  },
];
