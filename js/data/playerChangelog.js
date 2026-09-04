// Hand-curated, player-facing changelog shown in the in-game "What's New"
// screen. Deliberately separate from the technical CHANGELOG.md (which is
// written in developer prose - file names, function names, internal
// mechanics) - this file only lists things a player would actually notice
// or care about while playing. Keep it in sync manually: add a new entry
// here alongside any CHANGELOG.md entry that's actually gameplay-facing.
export const PLAYER_CHANGELOG = [
  {
    version: '0.23.0',
    date: '2026-09-03',
    highlights: [
      'Changed: Impale, Sever, Lacerate, and Faultline no longer wait on a refilling gauge before you can use them - they now share a quick cooldown that gets faster the higher your Speed stat is, so you can chain abilities much more smoothly.',
      'Changed: Flee now works instantly, every time (except against bosses) - no more waiting for it.',
    ],
  },
  {
    version: '0.22.0',
    date: '2026-09-03',
    highlights: [
      'New: a "Combat Explainers (beta)" toggle in Settings > Feature Flags - flip it on to preview in-battle popups that explain new abilities and combat mechanics as you unlock them. Off by default since the explanations themselves aren\'t written yet.',
    ],
  },
  {
    version: '0.21.1',
    date: '2026-09-03',
    highlights: [
      'Behind-the-scenes: added more automated test coverage for town\'s exits - nothing to see here.',
    ],
  },
  {
    version: '0.21.0',
    date: '2026-09-03',
    highlights: [
      'New: town now has 4 exits, one on each side, instead of a single door - just a gap in the trees, and you\'ll appear on the wilderness map in whichever direction you left from.',
      'Changed: town is a bit bigger to make room for the new exits.',
      'New: the shop, blacksmith, quest board, and well now always show a little wooden sign naming them.',
    ],
  },
  {
    version: '0.20.1',
    date: '2026-09-03',
    highlights: [
      'Added: Lacerate\'s re-press window now flashes brighter right as it hits its sweet spot, on top of the steady glow shown the rest of the time.',
    ],
  },
  {
    version: '0.20.0',
    date: '2026-09-03',
    highlights: [
      'New: a "🚧 Feature Flags" section in Settings, starting with an "Enable Audio (beta)" toggle - flip it on to preview in-progress sound controls (a theme picker and Combat/UI/World/Music volume and mute sliders). Off by default since real sound isn\'t in yet.',
    ],
  },
  {
    version: '0.19.0',
    date: '2026-09-02',
    highlights: [
      'Changed: your 4 combat abilities got new names and new jobs. Impale (was Stab) is your strong single hit. Sever (was Chop) always hits your target plus one random enemy beside it. Lacerate (was Slash) keeps its bleed - press it again right after landing for a damage buff. Faultline (was Sweep) is a weak hit on every enemy that also widens what your other 3 abilities can hit for a few seconds.',
      'Changed: every ability now hits instantly - no more timing-meter bar to wait through or watch for a green zone.',
    ],
  },
  {
    version: '0.18.1',
    date: '2026-09-02',
    highlights: [
      'Fixed: every menu and dialog (Inventory, Settings, Stats, Message Log, Loot Reference, What\'s New, Shop, Smith, Quest Board, and confirmation prompts) now closes with Escape, a corner ✕ button, or by clicking outside it - not just its own "Close"/"Leave" button.',
    ],
  },
  {
    version: '0.18.0',
    date: '2026-09-02',
    highlights: [
      'Changed: Parry now has a 10-second cooldown instead of being usable on every attack.',
      'Changed: in fights against multiple monsters, landing a parry during that cooldown now catches every monster mid-attack at once, instead of needing to time each one\'s narrow window individually.',
    ],
  },
  {
    version: '0.17.4',
    date: '2026-09-02',
    highlights: [
      'Behind-the-scenes: fixed a flaky test that was blocking deploys - nothing to see here.',
    ],
  },
  {
    version: '0.17.3',
    date: '2026-09-02',
    highlights: [
      'Balance: boars, bats, snakes, goblins, frogs, dire wolves, spiders, and scorpions near town hit a bit harder now - they were going completely toothless (0 damage) way too early into leveling up.',
    ],
  },
  {
    version: '0.17.2',
    date: '2026-09-02',
    highlights: [
      'Behind-the-scenes: more complete and durable play-log telemetry (a closed tab no longer loses that session\'s data, potion drops and Mythic reforges are now logged) - nothing to see here.',
    ],
  },
  {
    version: '0.17.1',
    date: '2026-09-01',
    highlights: [
      'Behind-the-scenes: a few stability fixes and a missed telemetry log spot for the shop\'s equip prompt - nothing to see here.',
    ],
  },
  {
    version: '0.17.0',
    date: '2026-09-01',
    highlights: [
      'New: a "Copy Play Log" button in Settings - copies a record of your current session (levels, fights, drops, gear equipped, upgrades) to your clipboard so it can be shared for balance feedback.',
    ],
  },
  {
    version: '0.16.3',
    date: '2026-09-01',
    highlights: [
      'Changed: New Game+ no longer stops at NG+2, and smith upgrades no longer cap at +3 - both keep climbing forever, so there\'s always another cycle and another upgrade to chase.',
    ],
  },
  {
    version: '0.16.2',
    date: '2026-09-01',
    highlights: [
      'Changed: parry timing window narrowed - the wind-up bar now only counts as a successful parry in its last 10%, down from the last 20%. Parry still fully blocks the hit and reflects damage back when you land it.',
    ],
  },
  {
    version: '0.16.1',
    date: '2026-09-01',
    highlights: [
      'Fixed: the pop-up message banner (battle results, well/treasure/gate messages) no longer overlaps the header - it now shows as a small box on the side, with a close button, and hovering it keeps it open.',
    ],
  },
  {
    version: '0.16.0',
    date: '2026-09-01',
    highlights: [
      'New: a fourth guardian-gated tool, the Circle of Ultimate Portaling - drop a portal wherever you\'re standing, warp to town, then warp right back to exactly where you left. The pair disappears once you\'ve made the round trip.',
      'Changed: the town well won\'t heal you while a portal trip back to town is still open - finish the round trip (or drop a fresh portal) first.',
      'New: a Settings screen, with an adjustable option for how long the battle item quick-select menu waits before auto-closing.',
      'Changed: the battle item quick-select menu no longer closes after each potion picked - it now stays open for a short beat (adjustable in Settings) so you can pick several in a row.',
      'Fixed: Power Ring now equips into a ring slot instead of taking up your accessory slot.',
    ],
  },
  {
    version: '0.15.0',
    date: '2026-09-01',
    highlights: [
      'New: 10 buff potions in the shop - 8 give a temporary combat boost (attack, defense, speed, lifesteal, extra swing chance, elemental damage, thorns, or crit chance) and 2 are one-shots (a guaranteed critical hit, or a Second Wind that saves you from a killing blow once per fight).',
      'New: set up a 4-potion loadout from the Inventory screen\'s Potions tab, then press the Item button (i) in battle to pick one mid-fight - battle slows down instead of pausing while you choose.',
      'New: monster kills now have a small chance to also drop a bonus potion.',
    ],
  },
  {
    version: '0.14.3',
    date: '2026-09-01',
    highlights: [
      'Behind-the-scenes: updated the deploy pipeline\'s tooling to its latest version - nothing to see here.',
    ],
  },
  {
    version: '0.14.2',
    date: '2026-09-01',
    highlights: [
      'Behind-the-scenes: a small deploy-pipeline safeguard so version numbers can\'t silently fall behind - nothing to see here.',
    ],
  },
  {
    version: '0.14.1',
    date: '2026-08-31',
    highlights: [
      'Fixed: gear tooltips now show your item\'s real stats including smith upgrades, not just its rarity tier.',
      'Fixed: stat effects in tooltips and equip prompts (lifesteal, extra swing chance, elemental proc, crit chance, thorns) now show readable labels instead of raw code names.',
    ],
  },
  {
    version: '0.14.0',
    date: '2026-08-31',
    highlights: [
      'New: a "NEW MAX!" callout pops up whenever a hit beats your all-time best damage with that move - tracked separately per ability (and for Attack).',
      'New: a live DPS meter in the battle sidebar shows your damage output for the current fight.',
    ],
  },
  {
    version: '0.13.1',
    date: '2026-08-31',
    highlights: [
      'Every battle button (Attack, Item, Flee, and each ability) now explains what it actually does when you hover it - handy to check while paused.',
    ],
  },
  {
    version: '0.13.0',
    date: '2026-08-31',
    highlights: [
      'New: a Pause button (top-left of the battle screen) and P key let you freeze mid-battle to check tooltips, then unpause and keep fighting - the parry window won\'t sneak by while you\'re paused.',
    ],
  },
  {
    version: '0.12.2',
    date: '2026-08-31',
    highlights: [
      'Mythic-tier gear (New Game+) hits noticeably harder now.',
    ],
  },
  {
    version: '0.12.1',
    date: '2026-08-31',
    highlights: [
      'Behind-the-scenes fix to how battle-effect animations time out - nothing to see, just more reliable timing under the hood.',
    ],
  },
  {
    version: '0.12.0',
    date: '2026-08-31',
    highlights: [
      'Battle abilities are now icon buttons with your keybind shown right on them - hover one for its name, cooldown, and damage estimate.',
      'Added a Parry button so you can click to parry instead of only using the S key.',
      'The number-key abilities (1, 2, 3, 4...) now sit in their own row above Parry/Attack/Item/Flee.',
      'The battle screen no longer jumps or resizes as monsters die, and the whole battle window closes smoothly in one motion when a fight ends.',
    ],
  },
  {
    version: '0.11.1',
    date: '2026-08-30',
    highlights: [
      'Fixed rings not showing up as "owned" in the Loot Reference once equipped.',
      'Fixed gear comparisons showing the wrong stat change for rings.',
      'A ring stuck equipped from before ring slots existed now moves into a proper ring slot automatically.',
      'The Smith no longer shows a dead upgrade button on rings (rings can\'t be upgraded there).',
      "The Stats panel now shows the Retribution Charm's thorns bonus.",
    ],
  },
  {
    version: '0.11.0',
    date: '2026-08-30',
    highlights: [
      'New Game+ players can now find and forge Mythic-tier gear, one step beyond Superior.',
      'Two new ring slots — go find some rings to fill them.',
      'Two new rare items only found in New Game+: the Retribution Charm and the Windfury Ring.',
    ],
  },
  {
    version: '0.10.0',
    date: '2026-08-30',
    highlights: [
      'Behind-the-scenes cleanup to how attack animations work internally - nothing to see yet, but it sets up better weapon-swing animations coming soon.',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-08-30',
    highlights: [
      'Monster groups can now have up to 6 members instead of 3, and can be a mix of different enemy types instead of always the same one.',
      'The longer you wander the wilds (or the deeper into New Game+ you are), the bigger and more frequent those groups get.',
    ],
  },
  {
    version: '0.8.6',
    date: '2026-08-30',
    highlights: [
      'Your character now visibly lunges into every swing, and Attack/Chop stay close to you instead of looking like a weapon flying off on its own.',
    ],
  },
  {
    version: '0.8.5',
    date: '2026-08-30',
    highlights: [
      'Plain Attack now arcs your weapon over the enemy in a spinning rainbow swing instead of just poking forward.',
    ],
  },
  {
    version: '0.8.4',
    date: '2026-08-30',
    highlights: [
      'Stab and Chop now stop right at the enemy instead of looking like they punch all the way through.',
    ],
  },
  {
    version: '0.8.3',
    date: '2026-08-30',
    highlights: [
      'Fixed Stab facing the wrong way (was pointing at yourself).',
      "Chop's axe now actually chops into the enemy blade-first instead of falling flat.",
    ],
  },
  {
    version: '0.8.2',
    date: '2026-08-30',
    highlights: [
      'Attack now swings a proper blade instead of a literal tooth/dinosaur/bone when Dragon Fang Blade, Fossil Fang, or Vampiric Fang is equipped.',
    ],
  },
  {
    version: '0.8.1',
    date: '2026-08-30',
    highlights: [
      'Fixed damage numbers, the "PERFECT!" badge, enemy projectiles, and the new weapon-swing effects all silently rendering behind the battle screen instead of on top of it.',
      'Weapon-swing animations are now bigger and slower, on purpose - it reads much better than the original quick/subtle version.',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-08-29',
    highlights: [
      'Attacks now actually swing your weapon at the enemy instead of just popping a damage number - Attack swings your equipped weapon, and Stab/Chop/Slash each get their own distinct swing.',
      'Sweep now visibly swings through every enemy in the group one at a time, instead of everyone taking damage at once with nothing to show for it.',
      'Landing a critical hit (or any Sweep) now leaves a trailing afterimage on the swing.',
      'A critical killing blow can now, once in a while, split the enemy in two instead of the usual spin.',
    ],
  },
  {
    version: '0.7.9',
    date: '2026-08-29',
    highlights: [
      'Landing a parry now flashes a clear gold "PARRY!" over your character instead of shaking the whole battle window.',
      'The shop can now buy back a single Fine or Superior piece of gear, not just plain copies.',
      'Status Log entries after a fight now also list your equipped gear, not just your stats.',
    ],
  },
  {
    version: '0.7.8',
    date: '2026-08-29',
    highlights: [
      'Fixed New Game+ not taking back your axe/mining pick/boat or re-gating the terrain you\'d already cleared with them — you\'ll need to earn your way through zone 1 again each NG+ cycle, same as a fresh save.',
    ],
  },
  {
    version: '0.7.7',
    date: '2026-08-29',
    highlights: [
      'Town is noticeably bigger again, so it doesn\'t look so small in the middle of the wider map view.',
      'The shop now only shows one "Buy" button for weapons/armor/accessories instead of the 1x/5x/10x/100x set — potions still let you buy in bulk.',
    ],
  },
  {
    version: '0.7.6',
    date: '2026-08-29',
    highlights: [
      'Moved the "Sell Duplicate Gear" button from the Inventory screen to the Shop, where selling actually belongs.',
    ],
  },
  {
    version: '0.7.5',
    date: '2026-08-29',
    highlights: [
      'Fixed the Ember Ring\'s bonus fire damage still hitting at full strength even when spamming Attack had decayed your regular hit down to zero — it now falls off right along with it.',
    ],
  },
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
