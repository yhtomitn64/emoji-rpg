# Changelog

All notable changes to this project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/), with a
lightweight versioning scheme suited to a solo personal project (no
public API, no formal release process — commits land straight on
`master`):

- **Versions are `MAJOR.MINOR.PATCH`.** Stay in `0.x` during early
  development.
- **MINOR** bumps for a completed feature/build (new content, new
  systems) — one bump per finished design-doc/plan under
  `docs/superpowers/plans/`.
- **PATCH** bumps for bug fixes, balance tweaks, and small polish that
  aren't their own feature.
- **1.0.0** is reserved for when the game feels like a complete,
  coherent experience — explicitly including the story (see
  `docs/superpowers/BACKLOG.md`, author-written, not AI-generated), not
  just an accumulation of systems.
- Entries land under `## [Unreleased]` while in progress and move into
  a dated version section once the work is done and committed — there's
  no separate release step to wait for.

## [Unreleased]

### Added
- Battle screen transitions and a perfect-timing payoff, closing out the
  "spike up animations" initiative: the battle dialog now swirls in on
  mount (`battle-screen-swirl-in`, `js/screens/battleScreen.js`/
  `css/styles.css`) and swirls out just before the post-battle pause ends
  (`battle-screen-swirl-out`, timed via `EXIT_ANIM_MS` inside `endBattle()`
  so it finishes right as `unmountOverlay()` clears the DOM, not before). A
  landed ability timing-hit or successful parry now shows a distinct
  "PERFECT!" badge (`playPerfectTimingEffect`) instead of just the ordinary
  hit-flash and log suffix; a successful parry also now gets the same
  crit-shake treatment a rolled crit does (`playHitEffect(..., true)` in
  `resolveMonsterWindup`'s parried branch) — a judgment call, not something
  explicitly asked for, on the reasoning that "perfect timing" is exactly
  what landing a parry is.
- A first-time tool pickup (axe/mining pick/canoe) gets a richer
  celebration sequence instead of the plain burst+text pop other
  celebrations use: the tool emoji pops up and loops most of a circle
  (`playToolCelebration`, `celebration-burst-tool-play` in
  `js/screens/celebrationEffect.js`/`css/styles.css`), then a bordered
  speech-bubble callout (`#celebration-tool-callout`) states the
  capability just unlocked (e.g. "Clears mountain gates blocking the
  way!"), timed to land as the orbit finishes. No sprite/pose system
  exists for a literal "hold it overhead" — this is a stylized
  substitute, called out as a design judgment rather than assumed
  silently.
- A level-up that crosses one or more ability-unlock thresholds now
  announces the newly-unlocked ability/abilities (e.g. "New ability
  unlocked: 🗡️ Stab!") right after the existing level-up celebration
  (`js/main.js`). Staggered 1600ms after the level-up banner rather than
  fired in the same tick, since `playCelebration` isn't queued — it just
  overwrites the shared banner/burst elements immediately, so an
  unstaggered second call would clobber the level-up message before it
  was ever seen. Multiple abilities crossed in one battle (a big single
  XP grant can jump several levels via `applyXp`'s loop) combine into one
  message rather than firing once each. Verified in-browser via a
  temporary debug hook driving real `handleBattleEnd` calls: a level 1→2
  jump announced Stab alone, a forced 3→9 jump announced Chop/Slash/Sweep
  together, both correctly sequenced after "Level up!" rather than
  replacing it.
- Terrain painter (`tools/terrain-painter/`): hovering the canvas now
  shows a translucent outline over exactly the cells the current brush
  would paint (`drawBrushPreview`/`brushCells` in `painter.js`), and
  `[`/`]` bump brush size up/down (clamped to the existing 1-15 slider
  range, kept in sync with it). Both close out the "Terrain painter:
  small UX polish items" backlog entry alongside the scroll fix below.
- Wilderness grid grew from 3x3 (9 screens) to 5x5 (25 screens): 16 new
  outer-ring screens (`js/maps/wilderness/*.js`, e.g. `farNorthwest`,
  `northNortheast`, `farSouth`) wired into the existing generic
  `neighbors: { north, south, east, west }` topology, with symmetric
  links verified by `tests/maps.test.js`. The dragon's dungeon entrance
  eligibility moved from the old 3x3 grid's 4 corner screens
  (`northeast`/`northwest`/`southeast`/`southwest`) to the new 5x5 grid's
  4 far-corner screens (`farNortheast`/`farNorthwest`/`farSoutheast`/
  `farSouthwest`, `CORNER_SCREEN_IDS` in `js/systems/dungeonEntrance.js`)
  so it stays at the true edge of the expanded world. All 16 new screens
  use the existing far-corner monster tier (`direWolf`/`spider`/
  `scorpion`, 0.15 encounter chance) — no new spatial difficulty
  gradient yet, that's still open per the backlog. The 16 new screens
  ship today with placeholder terrain only (plain grass, sealed on their
  outer world-edge sides with tree tiles) — the organic terrain (varied
  mountains/lakes/woods, cross-screen-continuous per Timothy's ask) is
  still-pending manual work, not part of what shipped here. A new
  browser-based dev tool, `tools/terrain-painter/` (`index.html` +
  `painter.js`), was added to support that follow-up work: it loads all
  25 screens onto one continuous canvas laid out exactly like the real
  5x5 world so painted terrain reads as connected across screen
  boundaries, and exports one screen's `LEGEND`/`ROWS` at a time to the
  clipboard for pasting back over that screen's file. See
  `docs/superpowers/BACKLOG.md`'s "Zone 1 map expansion + organic
  terrain" entry for what's left.
- A real worn-path trail effect, replacing the old flat "visited tile"
  tint (`js/systems/trail.js`, `js/screens/mapScreen.js`,
  `js/systems/exploration.js`; design doc/plan under
  `docs/superpowers/specs/` and `docs/superpowers/plans/`,
  `2026-08-25-worn-path-trail`). `state.visited`'s per-tile entry is now
  `{ count, dirs }` instead of a boolean - `count` is the walk count
  (drives wear), `dirs` is the exact set of edges (n/s/e/w) the player
  has actually crossed at that tile. Walking over ground leaves a wavy
  dirt-trail stroke reaching toward only those directions - not inferred
  from whether a neighbor happens to also be visited, which produced a
  "ladder" of false connections between separately-walked parallel
  corridors - or a small centered dot when nothing's been crossed yet.
  Each stroke's color gradients from this tile's own wear toward the
  connected neighbor's, and its width is the average of both tiles' wear
  (symmetric, so the two tiles sharing an edge always agree), so wear
  differences between adjacent tiles taper instead of meeting at a hard
  seam. Wear (up to a 10-visit cap) is baked entirely into color - a
  bare-unworn stroke blends into the tile's own ground color, a fully
  worn one is the solid trail color - deliberately not opacity, which
  couldn't stay consistent across a tile border; trail color itself is
  keyed by the underlying terrain (grass, cave floor, water). A tile with
  2+ connected directions (a fork/junction) now paints a solid hub circle
  at its own center, on top of every stroke, sized to the widest connected
  stroke there (`trailHubRadius` in `js/systems/trail.js`) - each
  direction is stroked independently at its own width (SVG can't taper a
  stroke's width along its length), so a fork whose branches carry
  different wear used to show a hard rectangular notch right where a
  thinner stroke met a wider one; the hub covers it so narrower strokes
  now visually emerge from inside it instead. A stroke's color at the tile
  *border* it's reaching toward is now the midpoint between this tile's
  own wear and the neighbor's (`trailBorderFraction`), not the neighbor's
  raw wear - each tile used to taper all the way to the *other* tile's own
  color right at the shared edge, so two different colors landed on the
  same physical point (each side insisting the border already was the far
  side) and produced a hard color wall, confirmed live on a real save,
  even though each side's gradient used matching hex values *somewhere*,
  just at opposite ends. This was the real cause behind several rounds of
  "there's a seam" reports across the session; the hub-notch fix above
  was real too but smaller in effect.
  Exiting town lands the player orthogonally adjacent to the town gate
  instead of diagonal to it, so a first step toward town connects to it
  in one move; the landing tile itself still starts as an isolated dot
  until that first real step, same as any other fresh tile.

### Fixed
- Terrain painter: trackpad two-finger scroll (a `wheel` event on desktop
  Chrome/Firefox, not a touch event, so `touch-action` alone didn't stop
  it) scrolled the page mid-paint-stroke, shifting the canvas under the
  cursor — "it keeps moving around driving me nuts." A non-passive
  `wheel` listener on the canvas now calls `preventDefault()` only while
  a stroke is actively in progress, so scrolling between strokes still
  works normally. `touch-action: none` also added to the canvas
  defensively for real touchscreen input.
- Three map-rendering layering bugs, raised by Timothy 2026-08-25 (see
  `docs/superpowers/BACKLOG.md`'s "Character/tree layering + a real
  worn-path trail effect" entry) and one more he spotted mid-session:
  - The hero could disappear entirely behind a grass decoration
    (clover/flower): `render()`'s branch order in `js/screens/
    mapScreen.js` checked `isDecoratedGrass` before `isPlayer`, so a
    decorated tile the player stood on rendered only the decoration.
    Restructured so the decoration (when present) and the hero/landmark
    marker both render into the same cell, decoration appended first so
    it still peeks out from behind the hero instead of being suppressed.
  - The character always rendered in front of a tall tree's canopy
    overlapping up from the row below, making it look like standing
    inside the tree rather than behind it. Replaced the fixed `.map-tile-
    player { z-index: 10 }` override with per-row depth sorting: each
    `.map-tile` cell's `z-index` is now set to its own row index in
    `render()`, so a cell's content always paints above the row directly
    north of it, matching normal top-down 2.5D depth rules for any
    overlapping content, not just the hero.
  - Town's action tiles - shop, smith, quest board, well, and the exit
    door - rendered as tiny plain text (the bare `.map-tile`'s 1.2rem
    font-size) instead of as full-square landmarks like the wilderness's
    town/dungeon entrances. They were simply missing from `mapScreen.js`'s
    `FULL_SQUARE_MARKERS` set; added.
- Two more map-rendering bugs, raised by Timothy 2026-08-26:
  - Town/wilderness/dungeon landmark tiles (shop, smith, quest board,
    well, exit, town/dungeon entrances) rendered with a dark box around
    them instead of the surrounding grass showing through. Each one is
    its own distinct tile type in a map's `ROWS` grid (not an overlay on
    a separate grass tile), so it never matched `tile === TILES.grass`
    in `render()`'s className logic and fell through to `.map-tile`'s
    bare default background. Added `GRASS_CONTEXT_MARKERS`
    (`js/screens/mapScreen.js`) - the subset of landmark tiles that
    always sit on a grass floor (every map that places them has
    `'.': 'grass'` in its own `LEGEND`) - and give those the same
    `.map-tile-grass` class obstacles already get. Deliberately excludes
    `miniDungeonEntrance`/`miniDungeonTreasure`, which only ever appear
    inside a mini-dungeon's cave-floor interior.
  - A tall obstacle's canopy overlaps upward into the row above it by
    design (see the character/tree layering fix above), but the map's
    own top row and outer columns have no neighboring row/column to
    absorb that overlap into, so it bled straight past the game's own
    border into the HUD/page behind it. `.map-grid` now clips
    (`overflow: hidden`), cutting that bleed at the map's own edge
    without touching any interior overlap.
- Parries against ranged monsters (goblin/spider/dragon/wraith/skeleton/
  Jurassic Jerky) could silently fail even on a well-timed press: the
  earlier themed-attack-animation pass added a 350ms delay after the
  parry wind-up bar completes, before a ranged hit actually landed
  (`RANGED_PROJECTILE_MS`, so the hit-flash would land when the
  projectile visually arrived). But the wind-up bar (and the
  `monster.windup.active` flag a parry press checks) resets to inactive
  the instant it completes, before that delay even starts - so a parry
  press during the delay window (which visually still looks like the
  attack is resolving, since the projectile is still flying) matched no
  active wind-up and was silently ignored, letting the hit land
  unblocked. `monsterAttack` (`js/screens/battleScreen.js`) now resolves
  impact immediately for every attack style, matching how melee always
  worked; the projectile is purely cosmetic and no longer gates the
  mechanical outcome. Found from Timothy's own report ("even when I
  parry sometimes enemies still hit me") rather than a test - this file
  has no unit-test coverage for DOM/timing sequencing (no jsdom in this
  repo), so this class of bug is only ever caught live; see the backlog's
  new Infrastructure entry on that trade-off.

### Changed
- Locked combat abilities are no longer shown disabled — they're hidden
  entirely until unlocked (`abilityButtonsHtml()` in
  `js/screens/battleScreen.js` now maps over `getUnlockedAbilities(state.
  player.level)` instead of the full `ABILITIES` array). The digit-key
  shortcuts (`1`-`4`, `handleKeydown`, same file) now index into that same
  filtered list instead of the full array, so a key's number always
  matches the button showing that number — a fresh level-1 character now
  sees only Attack/Item/Flee, same as Timothy asked.
- Leveling slowed down 4x: `xpForLevel`'s base coefficient (`js/systems/
  leveling.js`) goes 12→48 (the 2026-08-22 balance pass had already taken
  it 10→12; this is a further 4x on top of that, not from the original
  10). Every level's XP requirement scales linearly with the coefficient,
  so this is a uniform 4x at every level including the level-10+ ramp —
  e.g. cumulative XP to reach level 10 goes from 1741 to 6969.
- Attack's spam-decay is now much steeper and its passive recharge much
  slower, per fresh playtesting ("I still find myself just holding down
  attack... the game feels better when I don't use attack so much"):
  `ATTACK_STREAK_DECAY` 0.15→0.35 (`js/systems/combat.js`) so the floor is
  reached by the 2nd consecutive press instead of the 4th, and a new
  `ATTACK_STREAK_RECOVERY_MS` (8000ms) replaces the old "streak resets the
  instant your swing-timer gauge refills" passive reset with a much slower
  real-time-only idle timer — decoupled from the ATB gauge on purpose,
  since that gauge caps at `ATB_MAX` and abilities read the same value for
  their own readiness, so it couldn't represent "recharge slower" on its
  own. Landing an ability still resets the streak instantly, unchanged.
  Mirrored into `scripts/simulate-balance.js`'s `simulateBattle` (which
  had also been silently missing the `unlockedAbilityCount` argument on
  `attackStreakMultiplier` since that mechanic shipped earlier this
  session — fixed as part of this pass, it wasn't modeling the
  ability-scaled floor at all before now).
  **Known trade-off, deliberately accepted rather than tuned away:**
  `geared L6 (full iron)` vs. Dragon tier 0 dropped from 84% win to 0% win
  in the simulator — the two changes compound (less damage per press *and*
  far fewer presses land at full strength over a sustained fight) enough
  to flip some already-close matchups. Timothy's call: keep both changes
  as shipped and revisit with real playtesting data rather than the bot's
  approximation of ability-rotation play, which may not reflect how a
  human actually carries these fights with the rotation.

### Added
- A rare elite encounter: Jurassic Jerky 🦖 (`js/data/monsters.js`), a 5%
  chance (`js/systems/eliteEncounter.js`'s `rollEliteEncounter`) to replace
  any regular wilderness or dungeon encounter, always solo. Stats are 88%
  of the dragon's own tier-0 (hp 132/attack 30/defense 11/speed 10 vs.
  150/34/12/11) — a real near-dragon gear-check, not literally boss-hard.
  Deliberately not flagged `isBoss`, so it's fleeable for free (`playerFlee`
  only blocks fleeing on that flag). Drops a new unique weapon, Fossil Fang
  🦖 (+12 attack, between Iron Sword's 6 and Dragon Fang's 14). Its appear
  line is adaptive instead of a random pick from a fixed pool: a lighter
  in-game win-chance estimate (`getEliteAppearLine`, reusing the same
  average-damage/hits-to-kill technique `isMonsterOutclassed` already uses,
  not a full battle simulation) buckets into outmatched / close-fight /
  favorable framing. Verified live via a forced encounter: correct name/HP,
  the favorable-tier line ("you've got the edge here") against a
  wildly-outclassing test build, Flee enabled, and Fossil Fang landing in
  inventory on kill.

### Changed
- Weak-mob surrender/flee no longer opens the battle dialog at all. The
  pre-fight `resolveWeakMobEncounter` check (`js/systems/combat.js`) moved
  from inside `battleScreen.js`'s `mount()` to `main.js`'s `handleEncounter`,
  running before the overlay ever mounts — previously the dialog always
  rendered first and then auto-closed ~1.2s later even though the outcome
  was already decided. `handleBattleEnd` was already fully self-contained
  (banner/rewards/persist/HUD) and safe to call directly with an empty
  `killedMonsterIds`, so no reward-logic duplication was needed. A new
  `mapScreen.playMonsterFleeEffect(emoji)` shows the monster's emoji flying
  off the player's tile in a random direction (same Web Animations API
  technique as the ranged-attack projectiles) so the player still sees
  something happen instead of nothing at all — matching Timothy's own
  description of the ask. Removed the now-unreachable in-dialog weak-mob
  branch and its `WEAK_MOB_LOG_MESSAGES`/`playWeakMobFleeEffect`/
  `.battle-flee-shrink` (the in-dialog log line is moot with no dialog to
  show it in; `handleBattleEnd`'s existing flavor banner already covers
  the message). Scope unchanged: only solo, non-boss encounters resolve
  this way; multi-mob groups still open the dialog. Verified live via
  computed-DOM polling across several encounters: normal fights still
  open the dialog as before, and a weak-mob resolve showed the flee emoji
  and the correct banner text with `dialogOpen` false throughout.

### Added
- Three new monsters, one per existing tier: Ribbity Ravioli 🐸 (near-town
  wilderness, joins boar/bat/snake/goblin), Spicy Skewer 🦂 (far-corner
  wilderness, joins direWolf/spider), and Bone-in Biscuit 💀 (dungeon-tier,
  joins orc/wraith — ranged 🦴, plus the dungeon-tier-only flavor-line
  treatment). Stats sized to match their tier's existing roster; each drops
  its own new material (Frog Skin 🟢/body, Scorpion Venom 💉/accessory, Bone
  Fragment 🦴/head — picked to fill out the thinnest-covered smith-upgrade
  slots) and is quest-board eligible at its tier's usual kill count. Wired
  into the wilderness `monsterTable`s and the dungeon's. Verified live: all
  three render correctly on the Quest Board with correct name/emoji/reward.
- Regular monster encounters (wilderness + dungeon-tier orc/wraith; the
  dragon is untouched, it already has its own boss-tier system) now roll
  one of 5 named stat variants per spawn instead of always being numerically
  identical: `Puny`/`Lesser`/(baseline)/`Greater`/`Savage`, a +/-15%
  hp/attack spread (`js/systems/monsterVariants.js`'s `pickMonsterVariant`,
  same scaled-override pattern `bossTiers.js`/`ngPlus.js` already use).
  Rolled independently per monster in a multi-mob group. Still the same
  `monsterId` for quest progress/drop tables/kill counts — only display
  name and hp/attack vary. Wired into `handleEncounter` (`js/main.js`),
  gated on the existing `monsterOverridesList === null` branch so boss
  fights (which always pass explicit tier overrides) are unaffected. Caught
  a real bug while wiring this in: `getNgPlusCombatOverrides` only returns
  combat stats, not `name`, so a variant's name was getting silently
  dropped before NG+ scaling was re-layered on top — fixed by carrying
  `name` through separately after that step. Verified live: a wilderness
  encounter showed "Lesser Mega Muffin" at 93 HP (100 base x 0.925,
  rounded), matching the formula exactly.
- Monster attacks are now themed instead of sharing one generic hit-flash:
  each monster's `attackStyle` (`js/data/monsters.js`) is `melee` (a quick
  lunge toward the hero and back, `.battle-monster-lunge`) or `ranged` (its
  own `projectileEmoji` flies from the monster to the hero via the Web
  Animations API before the hit lands — goblin 🍙, spider 🥟, dragon 🔥,
  wraith 🍎; boar/bat/snake/direWolf/orc stay melee). Ranged attacks delay
  the log/HP-bar/hit-flash/outcome-check by the projectile's flight time
  (`RANGED_PROJECTILE_MS`, `js/screens/battleScreen.js`) so the flash lands
  when the projectile visually arrives, not before; melee stays immediate.
  Caught and fixed a real bug while verifying live: `buildMonsterCombatant`
  whitelists which fields carry over from `MONSTERS[id]` onto the in-battle
  combatant object and was silently dropping `attackStyle`/`projectileEmoji`,
  so every monster fell back to the melee lunge regardless of its actual
  style — fixed by adding both fields to that whitelist.

### Fixed
- The killing-blow hit-flash/shake was silently never playing when it also
  triggered a revive: `.battle-hit-shake`/`.battle-revive-glow` both set
  the `animation` shorthand on the same hero-zone element, and
  `.battle-hit-flash`/`.battle-revive-glow` both set `filter` on the same
  emoji element — in both cases only one declaration can win per property,
  and the later-declared `.battle-revive-glow` always did, so the red
  flash/shake never rendered at all on the exact hit that ends a losing
  fight, jumping straight to the green pulse. Confirmed via live
  computed-style polling before and after. Fixed per the backlog's own
  suggested resolution: `playReviveEffect` (`js/screens/battleScreen.js`)
  now only targets the hero emoji, not the whole zone (so it stops
  contending with the shake's `transform` animation), and
  `battle-revive-pulse`'s keyframes (`css/styles.css`) now animate
  `box-shadow` instead of `filter` (so it stops contending with the
  flash). All three effects now render together on the killing blow.
- Starting NG+ now also resets `lossStreak` to 0 (`resetWorldForNgPlus`,
  `js/systems/ngPlus.js`) — previously a streak carried over from the
  prior cycle, so entering NG+ already deep in a loss streak granted the
  full comeback-potion bonus on the first NG+ death despite nothing
  actually going wrong yet in the new cycle. Timothy's call: NG+ is a
  fresh start, matching how every other world-state field already resets.

- Item pickups now show a small toast (e.g. "🐲 +1 Dragon Scale Mail")
  that pops and floats up near the HUD's Inventory button
  (`js/screens/itemPickupToast.js`), instead of no feedback beyond the
  inventory count silently changing. Positioned from the button's live
  `getBoundingClientRect()` rather than living inside `#hud` itself, so
  `renderHud()`'s frequent full rebuilds don't wipe an in-flight
  animation. A literal cross-screen flight path wasn't feasible — the
  drop resolves after the battle screen has already unmounted, so
  there's no live item-icon starting position to animate from — this is
  the lighter toast/pop alternative instead. New-tool pickups keep their
  existing bigger celebration rather than getting both.
- Basic SEO pass: a real `<meta name="description">`, a more descriptive
  `<title>`, Open Graph + Twitter card tags (with a real screenshot-based
  `assets/og-image.png` instead of a placeholder), a canonical link,
  `robots.txt`, `sitemap.xml`, and a `<noscript>` fallback with a
  semantic heading for crawlers/no-JS users. The deploy workflow now
  also stages `robots.txt`, `sitemap.xml`, and `assets/` alongside the
  existing `index.html`/`css`/`js`.
- Level-up now gets its own dedicated effect beyond the shared star-burst
  celebration: the hero's map tile briefly scales up 2.2x
  (`.map-tile-levelup`), a radiating light-ray burst
  (`repeating-conic-gradient`) fans out from it, and a large embossed
  "LEVEL UP!" text pops in over the screen (`#celebration-big-text`,
  `js/screens/celebrationEffect.js`'s `playCelebration` gained an
  optional `bigText` option). All three fire together from
  `handleBattleEnd`'s existing level-up branch in `js/main.js`.
- Wilderness grass tiles are no longer one repeated green square —
  each tile deterministically picks from `🟩`/`🍀`/`🌼` based on its
  (x, y) position (`pickTileVariant` in `js/systems/world.js`), so the
  same tile always renders the same way but the map reads as varied
  instead of uniform. A first attempt using a plain linear hash
  (`x*31 + y*17`) produced visible diagonal stripes across the grid;
  switched to a proper bit-mixing hash for natural-looking scatter.
- Hero emoji picker grew from 8 to 23 options and gained a real skin-tone
  selector (5 Fitzpatrick tones + Default). Every candidate was verified
  by actually rendering base+modifier combinations rather than assumed
  from the Unicode spec — this caught that the already-shipped fencer
  🤺 and zombie 🧟 don't recolor at all, so the tone dropdown now
  auto-disables (and resets to Default) whenever one of those two is
  selected, instead of silently no-op'ing. ZWJ-sequence options
  (astronaut, artist, pilot) needed the tone modifier inserted right
  after the base person codepoint, not appended at the end, or the
  browser renders it as a stray unstyled color swatch instead of
  recoloring the glyph (`applySkinTone` in `js/state.js`).
- Quest turn-ins now scale instead of staying flat-value forever. Each
  monster tracks its own quest level (`state.questLevel`, starts at 1):
  every turn-in requires one more kill than the last
  (`QUEST_REQUIREMENTS[monster] + (level - 1)`) and grants a growing but
  decelerating reward quantity (`1 + floor(log2(level))` — 1, 2, 2, 3,
  3, 3, 3, 4...), so grinding quest levels gets progressively less
  worth it rather than staying flat-value. Quest board shows the current
  level and actual reward quantity per row. Existing saves default every
  monster to level 1, identical to today's behavior until the first
  turn-in.
- Tool-gated tiles (mountain/thicket) now nudge you the first time you
  walk adjacent to one, before you ever bump into it — "Something here
  looks like it'd need an Axe to get through" if you lack the tool, or
  "You're right next to something you could clear with your Axe" if you
  already have it. Fires once per tile ever (`state.toolGateHintsShown`,
  same one-time pattern as `gateRewards`), not every time you walk past.
- Losing a battle now offers a choice instead of always warping home:
  `Return to Town` (free, same as before) or `Warp to Dungeon Entrance`
  for `10 × player level` gold, disabled if unaffordable. HP restore,
  loss-streak increment, and comeback potions all still happen
  unconditionally first — the choice only changes where you land.
  Warping places you at `state.dungeonEntrancePosition` (the wilderness
  tile leading into the dungeon), not the dungeon interior itself, since
  dungeon-interior progress was never preserved across a loss anyway.
- The dragon rematch prompt now lets you choose which tier to fight
  instead of always auto-escalating to the next one. Every tier from 0
  up through your next uncleared tier gets its own button (e.g. `Tier 0
  (1x HP) ⭐`, `Tier 1 (2x HP) ⭐`, `Tier 2 (4x HP)`), so you can replay
  an already-cleared tier instead of being forced up a difficulty step.
  Replaying a lower tier can't lower your progress (`bossTier` only ever
  moves up on a win) and a loss leaves it untouched, same as before.
- Buying a piece of gear you don't already have equipped now offers an
  inline "Equip now?" prompt in the shop, showing the stat delta versus
  what's currently equipped (same delta logic as the Inventory screen).
  `Equip` swaps it in immediately via the existing `equipItem()`;
  `Not now` (or any other shop action, including selling) dismisses it —
  the item just sits in inventory to equip later, same as today. Doesn't
  reverse the earlier decision to remove auto-equip-on-pickup: this is
  opt-in, one purchase at a time.
- A "🚪 Switch Character" HUD button lets you get back to the title
  screen's save-slot list without closing the tab. Opens a confirmation
  overlay (`js/screens/logoutConfirmScreen.js`, modeled on the boss
  rematch prompt's confirm step) since it's an unexpected action if
  triggered by accident, though not a destructive one — state already
  auto-saves on every map move, so there's nothing to lose. Disabled
  during battle, same as the other HUD buttons.
- Dungeon has its first tool-gated shortcut: an axe-gated thicket tile at
  `(15, 7)` connects the interior maze directly into the boss corridor,
  instead of looping back through the top rows. Clearing any tool gate
  (thicket or mountain) with the required tool now shows a flavor banner
  ("You cut through the thicket with an Axe!"), symmetric with the
  existing locked-gate message. First-ever pickup of a tool item
  (`miningPick`, `axe`) now triggers the celebration effect, telling the
  player what they can do with it.
- Outclassed weak mobs can now give up instead of fighting to the death.
  A non-boss monster killable within 3 average hits has a 35% chance per
  encounter to surrender (full win rewards), flee dropping loot
  (gold/item only), or flee empty-handed (nothing) — each with its own
  battle-log line and a shrink-and-slide-away animation on the monster's
  emoji, resolved instantly in `battleScreen.js`'s `mount()` before the
  normal ATB tick loop starts.
- Combat abilities (Phase 1): five fixed-order abilities unlock as you
  level — Stab (2), Chop (4), Slash (6), Sweep (8), Super Scream (10).
  Each ability has its own real-time cooldown, independent of the ATB
  gauge; buttons for all five are always visible (numbered 1-5, with
  matching keyboard shortcuts), greyed out when locked or on cooldown
  rather than appearing/disappearing. Slash lands a delayed follow-up
  "bleed" tick ~0.9s after its initial hit; Sweep briefly reduces the
  target's effective defense. Super Scream is a self-buff (12s window)
  rather than a direct attack: it grants a rotation bonus (+25%) on any
  ability landed during that window (Attack itself is unaffected). Every
  ability use triggers a short, never-fails timing meter — a hit in the
  final stretch adds a damage bonus, a miss (or no input) still resolves
  the ability at its normal value; the log line says so ("Perfect
  timing!") on a hit, and the meter takes a Space/Enter press as well as
  a click. Attack/Item/Flee also gained key-hint labels
  (`(a)`/`(i)`/`(f)`), and Flee now additionally responds to `f`/`F`
  alongside the existing `Escape`. Multi-enemy targeting is explicitly
  out of scope for this phase — today's battles remain one monster at a
  time; Slash/Sweep are built so a future multi-enemy pass can extend
  them without rework.
- The dungeon entrance is no longer a fixed tile. Each new save now rolls
  a random spot among the 4 corner wilderness screens' grass tiles at
  character creation (`state.dungeonEntrancePosition`); the old hardcoded
  southeast `(24, 10)` tile is gone from the map data, and southeast is
  now plain grass like the other 3 corners unless a save's roll landed
  there. Saves created before this shipped keep landing at that historical
  southeast spot unchanged, via a one-time backfill on load.
- Monster attacks now telegraph before landing: a ~1.2s wind-up bar replaces
  the old instant-fire attack, with a parry-able zone in the final 20% of
  the bar (same proportions as the ability timing meter's own sweet
  spot). Press `s` or click the bar during that window to parry — a
  successful parry fully negates the hit and reflects half the incoming
  damage straight back at the monster, bypassing its defense entirely, and
  resets the monster's attack gauge to empty — a second reward beyond the
  reflected damage; missing the window (or not attempting) resolves as an
  ordinary hit, identical to before this feature existed. No cap or cooldown on
  attempts. The wind-up runs on the same tick loop as everything else in
  battle, so Attack, Item, Flee, and abilities all stay fully usable
  while a monster winds up — parrying and managing an ability rotation at
  the same time is the intended challenge.
- Wilderness encounters can now spawn groups of 2-3 of the same monster
  instead of always a lone target. Once you've killed 10+ of a given
  monster type (tracked per-species, forever, in `state.monsterKillCounts`),
  each new encounter with that species has a 30% chance to roll a group.
  Click a monster (or cycle with Left/Right/Tab) to select your target —
  Attack and single-target abilities hit only the selected monster, while every monster
  in the group attacks independently on its own wind-up gauge. The parry
  key (`s`) is a global sweep: it parries every monster currently sitting
  in its parry window at once, regardless of which one is selected, so a
  well-timed press can parry two simultaneous attacks in one keystroke.
  Killing a monster removes it from the row and reflows the rest; if your
  selected target dies, selection auto-advances to the next survivor.
  Fleeing a partially-cleared group banks full rewards (gold/xp/quest and
  kill-count credit) for each monster already killed and nothing for the
  survivors. Solo encounters are unaffected — same single-monster flow as
  before.
- Ability rotation redesign: Sweep now hits every living monster in the
  fight with full damage (plus its existing defense-shred debuff) instead
  of just the selected one, giving it a clear role as the group-fight
  ability now that groups exist. Stab and Chop, and Slash and Sweep, are
  now paired combo lanes — landing the setup (Stab or Slash) primes its
  payoff (Chop or Sweep) for a 1.5x damage bonus and lets it fire even
  before the swing timer is full, both via its button and its number-key
  shortcut; landing the payoff returns a smaller 1.15x bonus to the setup
  in turn, so the lane keeps feeding itself if you alternate. A primed
  ability's button glows and relabels itself ("Combo Ready" / "Bonus
  Ready") so the loop is visible without reading the log. The ability
  timing meter also now shows a "Press Space!" label once its fill enters
  the sweet spot, since that key (not the ability's own number key again)
  is what the meter actually listens for.
- Ability buttons now show an icon and a live estimated damage number
  (e.g. "🪓 Chop (2) ~18"), computed against the currently-selected
  target from an average damage roll plus any active buff/combo bonus —
  crit and timing-meter luck are deliberately excluded since those can't
  be known before pressing. The number updates automatically as you
  switch targets or a combo primes (`estimateAbilityDamage` in
  `js/systems/abilities.js`). Super Scream, a buff rather than a direct
  hit, shows no number. Pressing any ability also triggers a brief
  scale/brighten flash on its own button.
- The start/title screen got its first real visual pass: a dusk-toned
  background scene behind the save-slot panel, a scatter of monster
  emoji (including the dragon) gently floating in the sky, and a
  tree/mountain emoji horizon along the bottom — all pure CSS and emoji,
  no image assets, matching the battle screen's existing gradient-scene
  approach (`.battle-screen-forest`/`-cave`). The save-slot panel itself
  is unchanged functionally, just restyled as a translucent card
  (`.start-panel`) over the scene, and the title got an embossed
  `text-shadow` treatment. The decorative layer is `pointer-events: none`
  so it never intercepts clicks. Confirmed a page refresh already always
  lands here (`mountStartScreen()` runs unconditionally in `js/main.js`
  with no auto-continue path) — no code change was needed for that half
  of the ask.
- Damage numbers and crits got a visual pass. Every damage number is now
  a `position: fixed` element positioned from the target zone's live
  `getBoundingClientRect()` instead of an absolute child of the zone —
  so it's no longer clipped by the battle dialog's `overflow: hidden`
  and can float genuinely above it. Numbers are bigger and last longer
  (0.9s → 1.4s). A crit gets its own distinct treatment: a bigger
  gold/orange number with a glow and an entrance scale-bounce (rather
  than just a larger version of the normal float), plus a stronger
  shake across the whole dialog and a brief sway on the background
  scenery layer (`.battle-decoration`) — normal hits keep today's
  existing subtle per-zone flash/shake unchanged. Applies symmetrically
  whichever direction the crit lands, since both directions already
  share `playHitEffect`. Any damage numbers still animating get cleaned
  up on `unmount()` now that they live on `document.body` rather than
  inside the battle screen's own DOM subtree.
- A killed monster now gets its own death animation — the emoji spins
  in place (720°) while shrinking to nothing and fading out over 900ms,
  triggered the instant its HP hits 0 (`updateHpBars()` in
  `js/screens/battleScreen.js`), timed to finish right before its slot
  is hidden and (for the fight-ending kill) shortly before the dialog
  itself closes. Deliberately in-place, no sideways drift — the
  existing weak-mob flee animation shrinks *and* slides sideways, so a
  real kill now reads visually distinct from an enemy escaping.

### Fixed
- Attack-spam still trivialized fights even after the earlier fix that
  decayed its damage (floor 40%) and knockback (floor 0) per consecutive
  press — Attack has no swing-timer gate, only a flat 500ms real-time
  cooldown, so spamming it forever at 40% power twice a second was still
  likely out-DPSing the ability rotation the balance pass tuned around.
  Found via fresh playtesting. The cooldown itself now grows with the
  streak too (`attackCooldownMsForStreak` in `js/systems/combat.js`,
  `500 + streak × 200`ms, uncapped), so continuing to spam gets
  progressively slower, not just weaker, until an ability lands or the
  gauge refills (both still reset the streak as before). The 40% damage
  floor is unchanged for now — easier to tell what actually fixed it,
  and there's room to lower it further as a follow-up if needed.

### Changed
- Super Scream moved off number key `5` onto Space, and is now usable the
  instant it's off its own 30s cooldown regardless of the swing-timer
  gauge — using it no longer resets the gauge either, so it's a genuinely
  free action layered on top of the rest of the rotation rather than
  costing a turn. Digit keys `1`-`4` still map to Stab/Chop/Slash/Sweep
  unchanged.
- Attack no longer waits on the swing timer either — it's pressable any
  time — but each consecutive Attack (without landing an ability or
  letting the gauge refill to full first) deals less damage than the
  last, down to a floor of 40% of normal, with the live penalty shown
  right on the button (`Attack (a) -30%`). Landing any ability, or simply
  holding off long enough for the gauge to fill back up, resets it to
  full strength.
- Combo priming now requires actually landing the timing window, not
  just using the setup ability. Missing Stab/Slash's timing meter still
  deals normal (un-primed) damage — never-fails is unchanged — but no
  longer lights up Chop/Sweep. Chop/Sweep themselves never show the
  timing minigame at all anymore, whether triggered via a primed
  instant-cast or their own swing timer filling naturally — their
  reward is the 1.5x combo multiplier, not a stacked timing bonus on
  top of it. Landing Chop/Sweep still primes Stab/Slash's smaller
  return bonus unconditionally, since a payoff ability has no timing
  window of its own to gate on.

### Fixed
- Attack-spam exploit: spam-clicking Attack could permanently lock a
  monster out of ever attacking, since each hit's ATB knockback landed
  faster than the monster's own gauge could refill and Attack had no
  gate to slow that down. Fixed two ways: Attack now has a short flat
  500ms real-time cooldown (separate from the swing timer it's
  otherwise still free from), and the knockback itself now decays with
  the same spam streak that already decays damage — reaching exactly 0
  by the 3rd-4th consecutive hit (damage only ever floors at 40%). Once
  knockback is gone, the enemy's gauge grows uncontested regardless of
  click rate, so it's guaranteed to eventually get a turn.

### Changed
- Balance pass (Phase B, player-power side only — see
  `docs/superpowers/specs/2026-08-22-balance-pass-design.md`): abilities and
  leveling were both too strong, following straight from the Phase A
  simulator work that made the "too easy" complaint measurable instead of
  anecdotal. Stab's damage multiplier drops 1.3→0.8 and Chop's 1.8→1.1 (the
  early, spammable abilities that were trivializing low-tier content);
  Slash drops 1.0→0.85 and Sweep 1.5→1.3 (a lighter cut, since dungeon-tier
  was already close to a healthy difficulty for these). Attack growth for
  levels 2-9 now alternates +2/+1 per level (average +1.5, down from a flat
  +2) instead of a uniform gain every level. `xpForLevel`'s base coefficient
  rises 10→12 (20% more XP required at every level) — the "slow leveling
  down a bit" ask.
  Real effect, per the extended simulator: far-corner wilderness win rate
  stayed saturated but real attrition now shows up (HP-left dropped from
  ~84-92% to ~73-91% for a mid-tier build); `reasonable L7`'s dungeon-tier
  win rate came down from 100% to 75-78%; potion usage now shows up in
  several matchups that previously reported zero. Near-town wilderness
  (55-100 HP monsters) stayed at 100% win / 100% HP-left regardless of how
  hard abilities were cut — turns out this is structural, not
  ability-driven: a monster that slow and that squishy dies within a
  handful of player actions no matter the per-hit damage, well before its
  own wind-up ever completes, so it can't be fixed without touching monster
  HP/speed (explicitly out of scope) or crushing player power hard enough
  to break every other tier. Treated as intentional — matches the standing
  "zone 1 should keep getting easier" design call — rather than chased
  further.
  Dungeon-tier and boss-tier-0 for `prepared L9`/`veteran L11` (fully
  "prepared" builds) also proved resistant to win-rate movement even after
  stacking ability cuts with the base-attack-growth cut — real HP/potion
  cost does show up (Dragon tier 0 potions used: 0.5→1.3), but the outcome
  itself stays 100%. Decided to treat this as correct rather than a bug: a
  min-maxed "prepared" build reliably winning the content it prepared for
  is the point of preparation — attrition (HP left, potions burned) is the
  more meaningful signal for these builds, not literal win/loss. Known
  trade-off: `veteran L11` vs. Dragon tier 1 dropped from 57% (the one
  build that could previously touch it at all) to ~0-2% — an unintended
  side effect of the leveling-curve change that wasn't specifically
  protected against; left as-is rather than spending further tuning passes
  chasing a single edge-case matchup, but flagged here for anyone touching
  these numbers again.

### Fixed
- `getItemStatDelta` (`js/systems/inventory.js`) reported `enemySlowPercent
  NaN` for any gear-stat comparison against an empty equipment slot,
  since its empty-slot fallback object omitted that stat while
  `getItemEffectiveStats` always includes it — `0 - undefined = NaN`.
  Visible on both the Inventory screen's unequipped gear list and the
  new shop equip-prompt above; found while building the latter. Fixed by
  adding `enemySlowPercent: 0` to the fallback.
- Cloudflare deploy no longer ships the whole repo. The GitHub Actions
  workflow now stages just `index.html`, `css/`, and `js/` into a `dist/`
  directory and deploys that instead of the repo root, so `tests/`,
  `scripts/`, `docs/`, `package.json`, and other non-game files are no
  longer publicly fetchable from the live site.
- The post-death "Where to?" prompt (`js/screens/postDeathTravelScreen.js`)
  offered a paid warp to the dungeon entrance even when the death happened
  out in the wilderness and the player had never set foot in the dungeon.
  `promptPostDeathTravel` (`js/main.js`) now only offers the warp option
  when `state.map === 'dungeon'` at the moment of death; dying anywhere
  else shows only "Return to Town".

### Changed
- Attack's damage-decay floor (from consecutive spam) now scales down with
  how many abilities are unlocked instead of staying flat at 40% forever:
  `ATTACK_STREAK_FLOOR_PER_ABILITY` (`js/systems/combat.js`) drops the
  floor by 8 points per unlocked ability, reaching a 0% floor once all 5
  are unlocked at level 10. At level 1 (no abilities yet) the floor stays
  40%, since Attack is still the only option. A one-time-per-battle taunt
  line (`ATTACK_TAUNT_LINES` in `js/screens/battleScreen.js`) appears in
  the battle log the first time Attack's decay bottoms out at the floor,
  nudging the player toward the ability rotation instead.

### Added
- Monster kills can now drop tiered (Fine/Superior) equipment or one of
  three wholly new Unique-effect items, both weighted by how tough the
  monster is relative to the rest of the roster
  (`js/systems/itemQuality.js`'s `monsterToughness`, 0-1 by relative xp). Superior
  chance scales 2%→10% and Fine 10%→25% by toughness for an ordinary
  equipment drop (`rollQualityTier`); a separate, independent
  Unique-effect check scales 1%→5% (`rollUniqueEffectChance`), tried
  before and instead of the ordinary drop roll. Boss/elite/tool-dungeon-
  guardian monsters are fully excluded from every roll here, keeping
  their existing guaranteed drop tables untouched. The three new items
  (`js/data/items.js`): Vampiric Fang 🦴 (weapon, +7 attack, 15%
  lifesteal), Swift Strike Charm 🔮 (accessory, 10% chance of a bonus
  Attack swing that's exempt from the attack-spam-decay system and never
  itself re-rolls), and Ember Ring 🔥 (accessory, 20% chance of +6 bonus
  fire damage on hit) — all found-only, never sold. Tier/effect data
  threads through the full inventory model: `state.inventory` entries
  and `state.equipmentTiers` now carry an optional `tier`
  (`js/systems/inventory.js`), Fine/Superior multiply base stats 1.10x/
  1.20x before the existing +25%/level smith-upgrade scaling, and a
  Plain and a tiered copy of the same base item stack separately so
  equipping either one equips exactly that copy. The shop only ever
  sees/sells the Plain stack of anything it also stocks
  (`js/screens/shopScreen.js`), and the smith/inventory screens show
  each item's tier prefix in its name (`tierLabel`) alongside its normal
  stat delta. Lifesteal and the elemental proc are wired into every
  player damage source (`applyOnHitEffects`, called from `playerAttack`
  and both branches of `playerUseAbility`); the extra-swing roll wraps
  `playerAttack`'s body (extracted into `resolveOneAttack`) so a bonus
  swing fires once, at full strength, without advancing or being
  throttled by the attack-streak/cooldown decay
  (`js/screens/battleScreen.js`). Design:
  `docs/superpowers/specs/2026-08-26-item-quality-and-effects-design.md`.
  Plan: `docs/superpowers/plans/2026-08-26-item-quality-and-effects.md`.

### Fixed
- Two stray chance-based tool drops undermined the "no chance, find it"
  tool-gating design: the wraith (Ghost Apple Supreme) carried a leftover
  `{ itemId: 'axe', chance: 0.25 }` and the orc (Super Mean Meatloaf) a
  leftover `{ itemId: 'miningPick', chance: 0.25 }` in their own
  `dropTable`s (`js/data/monsters.js`), alongside the real guaranteed
  (`chance: 1`) drops from `axeGuardian`/`pickGuardian`. The orc one had
  been missed by an earlier pass that searched for the literal string
  `'pick'`, not `'miningPick'`. Both removed — axe/pick/boat are now only
  ever obtainable from their own gated guardian fight. A new data test
  (`tests/data.test.js`) asserts no non-guardian monster carries a
  tool-type drop, so this can't silently regress.
- A mini-dungeon entrance could be revealed on a screen's only crossing
  at a narrow pass between obstacles, forcing the player through its
  interior on every single crossing, both directions, forever. Placement
  now runs a chokepoint check first (`isChokepointTile`,
  `js/systems/world.js` — a pure, DOM-free articulation-point test over
  the screen's live-passable tiles, reusable/testable on its own) via
  `js/screens/mapScreen.js`'s `isScreenChokepoint`, threaded through
  `resolveStepDiscovery`/`shouldRevealMiniDungeon`
  (`js/systems/discovery.js`, `js/systems/miniDungeons.js`); a roll that
  would have placed one there now just falls through instead.
- Leaving a tool-dungeon's interior (or the main dragon dungeon) dropped
  the player at the destination screen's generic `startPosition` instead
  of the exact entrance tile they came in through, so clearing e.g. the
  axe guardian and walking back out landed the player elsewhere on the
  screen with no immediate way to use the new tool's own shortcut.
  `enterMap` (`js/main.js`) now accepts an optional target position, and
  the `exitMap` action handler passes the real dungeon/tool-dungeon
  entrance coordinates instead of relying on the default.
- Combo-priming's timing-bonus "green zone" showed (and could be hit) on
  Stab two full levels before Chop — the ability it primes — actually
  unlocks, since Stab unlocks at level 2 and Chop at level 4. New
  `comboTimingHintUnlocked` (`js/systems/abilities.js`) hides the zone
  until the payoff ability it primes is unlocked; the timing hit is
  still scored underneath so priming works immediately once the payoff
  unlocks, only the visual was misleading.
- A primed payoff ability (e.g. Chop right after a timing-hit Stab) only
  bypassed the swing-timer/ready gate, not its own real-time cooldown —
  so if Chop was still cooling down when Stab primed it, the combo
  couldn't actually fire "right away" as designed. `canUseAbility`
  (`js/systems/abilities.js`) now bypasses both gates for a primed
  payoff; the ability button no longer shows a stale cooldown countdown
  in that state either (`js/screens/battleScreen.js`).

### Added
- Shop and Smith now show an explicit "✕" close button in the top-right
  corner, alongside (not replacing) the existing Leave button
  (`js/screens/shopScreen.js`, `js/screens/smithScreen.js`,
  `css/styles.css`'s new `.screen-close-x`) — raised 2026-08-28: "I keep
  looking for an X and not just the leave button."
- Shop, Smith, and the Quest Board now support a single-key `l` (or `L`)
  shortcut to leave the screen, alongside the existing Tab-based focus
  navigation — raised 2026-08-28: "what else could help like 'l' for
  leave or something?" Skipped while a `<select>` has focus (Smith's
  material picker) so it doesn't hijack the browser's own
  type-ahead-to-select-an-option behavior. Each screen gained real
  `pause`/`resume` lifecycle methods (matching `js/screens/mapScreen.js`'s
  own pattern) so the shortcut doesn't also fire while an unrelated HUD
  overlay (inventory, stats, etc.) is open on top of it.

### Fixed
- The Smith's Upgrade button only dimmed/disabled for missing materials,
  never for insufficient gold — raised 2026-08-28: "Fade out upgrade
  buttons if you can't afford/don't have materials. Well if you don't
  have materials already works like that so just do that for can't
  afford." `js/screens/smithScreen.js` now also disables the button when
  `state.player.gold < cost`, reusing the existing generic
  `button:disabled` fade styling.
- The persistent HUD's HP readout stayed frozen at its pre-battle value for
  the whole fight — it only synced from the battle's own live HP once, at
  `endBattle()`. `updateHpBars()` (`js/screens/battleScreen.js`) now syncs
  `state.player.hp` and fires a new `onHpChange` callback the HUD wires to
  `renderHud` (`js/main.js`) every time it runs, i.e. after every
  player-HP-changing event in battle.
- Impassable mountains (`mountainWall`) rendered undersized with no
  grounding background, unlike `mountain`/`mountainCache` which already
  had that treatment — raised 2026-08-28: "Mountains look small... no
  background under them." `RANDOM_SIZE_OBSTACLES`
  (`js/screens/mapScreen.js`) had excluded `mountainWall` on a stale
  assumption that it was only the auto-sealed world-edge marker, not real
  painted terrain — 10 wilderness screens actually paint it directly via
  their own map `LEGEND` (e.g. `js/maps/wilderness/south.js`'s `'W'`).
  Adding it to that Set gives it both the same obstacle sizing and the
  grass-matched background as every other obstacle in one move, since the
  existing `map-tile-grass` class already keys off the same Set.

### Added
- Clearing a thicket/mountain with the right tool now permanently leaves a
  visible stump 🪵 or rubble 🪨 marker instead of the tile staying visually
  unchanged forever — raised 2026-08-28: "when using axe, pick and walking
  into those blocks they should get cut down and leave a stump or rubble
  or something. water should not do anything from canoe." New
  `state.clearedGates` tracks which specific tiles have been crossed;
  `js/systems/toolGates.js` gained `isGateCleared`/`markGateCleared`, and
  `js/screens/mapScreen.js`'s `tileAt()` swaps in the replacement tile via
  a `CLEARED_GATE_REPLACEMENT` map (thicket/thicketCache → stump,
  mountain/mountainCache → rubble) once cleared. Water is deliberately
  absent from that map, so canoeing across it never changes the tile.

### Added
- DOM/timing test infrastructure for screen modules, starting with
  `battleScreen.js`: `jsdom` added as the project's first-ever npm
  dependency, a shared `tests/helpers/dom.js` setup/teardown helper, and
  `tests/battleScreenDom.test.js` (9 tests) proving real button
  clicks/keyboard shortcuts/timing-minigame interactions can now be
  covered by fast automated tests instead of a live-browser round trip —
  deferred twice before (see BACKLOG_SHIPPED.md's "Testing infra" entry
  for the full history/cost tradeoff). `.github/workflows/deploy.yml`
  gained an `npm ci` step it previously lacked (the project had zero
  dependencies before this, so `npm run test` never needed one).

### Fixed
- `attackCooldownMs` (`js/screens/battleScreen.js`) was never reset in
  `mount()`, unlike every other per-battle Attack counter next to it — a
  battle ending while Attack was mid-cooldown silently disabled Attack for
  a moment at the start of the *next* battle. Found while writing the new
  jsdom test suite above.

### Changed
- `#app`'s dim/undim transition (used by every overlay, including battle)
  now animates smoothly (`transition: filter 0.3s ease`,
  `css/styles.css`) instead of snapping instantly — a first small step
  toward the still-open "battle starts with a cool
  transition/fade" ask. See `docs/superpowers/BACKLOG.md`'s "Level-up and
  general animation pass" entry for the rest of that initiative.

## [0.5.1] - 2026-08-17

### Fixed
- New characters had no idea armor was near-mandatory: a level-1
  character with zero armor wins near-town fights 0-5% of the time
  (confirmed via the balance simulator's new no-armor baseline build);
  the one cloth piece the starting 20g affords jumps that to 97-100%.
  Working as intended by the savage-early-game design, but never
  communicated. Added a first-visit town banner that sets honest
  expectations either way — gear up first, or lean on potions and
  expect a few early deaths, which cost nothing but a trip home.

## [0.5.0] - 2026-08-17

First chunk of the Combat Pass backlog category.

### Added
- Potions are off the turn cooldown (drink anytime without losing your
  turn) and can occasionally crit-heal, reusing the existing attack-crit
  system instead of a new mechanic.
- Landing a hit knocks the target's ATB gauge back (`ATB_KNOCKBACK`),
  both ways — your attacks knock the enemy back, getting hit knocks you
  back. Flat and clamped at 0, not stacking, so neither side can be
  fully locked out.
- Two new items for a "faster me" / "slower them" build choice: Wind
  Greaves (legs, +4 speed) and Frost Charm (accessory, slows the
  enemy's effective speed 15% via a new `enemySlowPercent` stat that
  scales with smith upgrades like every other stat).
- A small damage bonus once the player's speed crosses a threshold
  (20, reachable through leveling and/or the new speed gear), so speed
  stays worth chasing past the point it's already fast enough to act
  often.
- Battle screen visuals: fixed the environmental decoration actually
  spreading across the background (it was one clustered text string,
  not three separate elements — `justify-content` had nothing to
  distribute), made it bigger/more visible/ground-anchored, added a
  landscape ground-tint gradient, and widened the whole battle panel.

### Changed
- `scripts/simulate-balance.js` no longer hand-rolls its own copy of
  the combat math. `js/systems/combat.js` gained
  `resolvePlayerAttack`/`resolveMonsterAttack`/`resolvePotionUse`,
  single functions covering the full crit/damage/knockback/speed-bonus/
  heal sequence, called by both the real battle screen and the
  simulator — the numbers can no longer silently drift apart the way
  they had (the simulator still had the pre-fix turn-priority bug and
  no knowledge of three new mechanics before this).

### Fixed
- Google Translate was offering to translate the page (usually as
  Spanish) despite a correct `lang="en"` — the browser's own
  content-based language detector was getting confused by a page
  that's mostly short labels/numbers/emoji with very little real
  English prose to sample. Added `<meta name="google"
  content="notranslate">` to opt out of the prompt entirely.

## [0.4.0] - 2026-08-17

Clears the entire Feature Requests backlog category in one pass — see
`docs/superpowers/BACKLOG.md` for what's left (Combat Pass, Balance
gaps, Multi-zone, one Open Question).

### Added
- Potions can be drunk from the inventory screen outside of combat, not
  just mid-battle.
- Every non-dragon monster now has a 10% chance to drop a potion.
- Shop: sell-back at half price for any owned catalog item, with
  bulk-buy shortcuts (1x/5x/10x/100x), each disabled unless the full
  quantity is affordable.
- Quest board: a "Turn In All" button.
- Character creation: pick your hero's emoji from a curated list
  (`player.emoji`, backfilled for existing saves).
- Hover tooltips on every map tile, explaining what it is/does.
- Item tooltips everywhere an item renders (shop, inventory, smith,
  quest rewards) via a shared `describeItem()` — closes the "buying
  blind" gap as a side effect instead of a bespoke shop-only fix. Shop
  rows also mark "✓ Equipped" when applicable.
- A new "📖 Loot" HUD screen listing every item, what you own, and
  where it's obtainable (monster drops, shop, mini-dungeon treasure).
- A town well tile for free, unlimited healing outside of combat —
  deliberately not an auto-heal-on-return, to keep the potion economy
  meaningful.
- Battle screen now shows faint environmental decoration (rocks/pickaxe
  in the dungeon, trees in the wilderness) instead of a bare panel.
- Two more mini-dungeon layouts (3 → 5 variants), cutting how often
  cave discoveries repeat the same layout.

### Fixed
- The enemy's attack was blockable indefinitely: once the player's own
  ATB gauge became ready, the enemy could never attack until the player
  spent their turn — a player could sit on a full gauge forever and
  never get hit. The enemy now attacks purely on its own timer.

## [0.3.0] - 2026-08-17

### Added
- First kill and every level-up now trigger a celebration effect (emoji
  burst + flavor banner), via a new screen-independent
  `js/screens/celebrationEffect.js`. First kill is a one-shot flag,
  correctly backfilled for existing characters so it doesn't misfire on
  a save that's already made progress.

## [0.2.2] - 2026-08-17

### Changed
- Buttons across the whole game now have real styling (background,
  border, rounded corners, hover/active/disabled states) instead of bare
  default browser buttons, and overlay panels / shop / smith / quest /
  start screens use much more of the viewport (`min(90vw, 720px)`
  instead of a fixed 480px) so they no longer look tiny on a large
  monitor. Inner scroll areas (message log, inventory) now cap at 55vh
  instead of a fixed 320px for the same reason.

## [0.2.1] - 2026-08-17

### Fixed
- Boss rematch prompt: "Not yet" previously meant "decline the tier
  escalation, but fight anyway" — once a player was already at max
  tier there was nothing to decline, so the same button silently
  started a fight. Buttons are now honest: Fight always fights, Not
  yet always walks away with no fight, New Game+ unchanged.

## [0.2.0] - 2026-08-17

### Added
- Equipment upgrades are now capped at `MAX_UPGRADE_LEVEL = 3` — gear
  could previously be upgraded indefinitely, removing any incentive to
  switch to a new drop.
- The boss rematch prompt now shows which dragon difficulty tiers have
  actually been cleared (stars), now that tier progress only advances on
  a real win.

## [0.1.1] - 2026-08-17

### Fixed
- Boss rematch: `state.bossTier` previously advanced the moment an
  escalation prompt was accepted, before the fight was even fought — a
  loss never rolled it back, so you could lose a tier and still
  "progress" past it. Now only advances on an actual win.
- Inventory panel could grow past the viewport with a long item list,
  pushing the Close button out of reach with no way to scroll to it.

## [0.1.0] - 2026-08-17

Retrospective baseline covering everything built before changelog
tracking started. Not a granular per-commit history — see
`docs/superpowers/plans/` and `docs/superpowers/specs/` for the full
design docs behind each of these.

### Added
- Core loop: emoji-based single-hero RPG — grid overworld, emoji-triggered
  battles, town shop/smith, one dungeon with a boss.
- World expansion: single overworld map replaced by a 3x3 grid of linked
  screens around Town, difficulty rising with distance from Town.
- Battle screen v2: hit feedback (flash/shake/floating damage numbers),
  visible ATB gauges, full scrollable combat log, win/loss pause.
- Terrain density pass: each wilderness screen quadrupled in size with
  distinct layouts, plus first-visit flavor-text banners.
- Boss rematch: opt-in escalating dragon difficulty tiers (capped),
  bigger XP reward per tier.
- Loot caches: ambient chance of finding a small gold/item stash on
  wilderness tiles, each tile marked once found.
- Mini-dungeons: rare discoverable nested sub-maps with their own
  encounters and exit back to the overworld.
- Silly monster names: goofy display names for trash monsters (boss
  keeps its serious name).
- Save slots & New Game+: named multi-slot saves plus a repeatable,
  capped NG+ mode (keep character power, reset world, tougher/better
  rewards).
- Inventory & equipment screen: view unequipped gear, manually choose
  what to equip, compare stats before swapping; auto-equip removed.
- Metroidvania tool-gating: mining pick and axe, dropped by dungeon-tier
  monsters, permanently unlock hand-picked shortcuts/loot pockets in the
  existing wilderness.
- Player growth curve rework: tapered post-level-10 stat gains, steeper
  XP curve, and partial (not full) heal on level-up past that point, to
  stop late-game trivialization.
- Quest board: repeatable quests for specific monster types, rewarding
  guaranteed upgrade materials instead of gold/XP.
- Savage early game: near-town monsters made genuinely threatening,
  armor stops being optional, the near-town → far-corner → dungeon →
  dragon escalation holds throughout.
- Comeback mechanic, status log & hero revival: escalating free potions
  on a losing streak (capped, resets on a win), a scrollable in-memory
  status log fed by every flavor banner, and a green revival-pulse
  animation on defeat.
