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
