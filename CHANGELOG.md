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
- 10 new buff-potion items (data only, not yet purchasable/usable in a
  battle - see follow-up commits) as part of the excess-gold-sink work.

## [0.14.3] - 2026-09-01

### Changed
- Bumped the three GitHub Actions in `.github/workflows/deploy.yml` to
  their latest major versions - `actions/checkout` v4→v7,
  `actions/setup-node` v4→v7, `cloudflare/wrangler-action` v3→v4 -
  clearing the "forced to run on Node.js 24" deprecation warning GitHub
  had started attaching to every deploy run (those actions still
  targeted Node 20 internally). Checked each project's own
  changelog/release notes first: `actions/checkout` v5-v7 are
  Node-24-runtime bumps with no input changes; `actions/setup-node`
  v5/v6's breaking changes (auto package-manager cache detection,
  auto-caching limited to npm) don't affect this workflow, which already
  passes `cache: npm` explicitly and has no `packageManager` field in
  `package.json`; `wrangler-action` v4's only breaking change is
  defaulting the installed Wrangler CLI to v4 instead of v3 - accepted
  as-is (not pinned back to v3) since `wrangler pages deploy`'s basic
  command syntax is unchanged, and verified by watching the next real
  deploy run through to a successful, live result. This repo's own
  `node-version: 20` input (the Node version used to run `npm ci`/`npm
  run test`, unrelated to the actions' own runtime) is untouched.

## [0.14.2] - 2026-09-01

### Added
- A third CI check in `.github/workflows/deploy.yml`: for any push that
  changes non-doc files, `## [Unreleased]` in `CHANGELOG.md` must be
  empty (i.e. actually bumped into a dated section), not just present -
  closes the last gap in this repo's versioning checklist enforcement.
  The existing "CHANGELOG.md was touched" check only required *some*
  entry to exist somewhere in the file; it didn't catch a push landing
  with real content still sitting under `Unreleased` instead of bumped,
  which is exactly the drift class from the `0.7.2` postmortem (the
  in-game footer reads `PLAYER_CHANGELOG[0]` directly, so an un-bumped
  `Unreleased` block means the footer silently falls behind). Raised
  2026-09-01 while confirming the `0.14.1` deploy landed correctly.

## [0.14.1] - 2026-08-31

### Fixed
- Rung-3 gear cleanup (three of the five known follow-ups from the
  2026-08-28 item-quality-tiers review, per Timothy's own scoping - the
  other two, AOE lifesteal/proc stacking per target and the ±1 rounding
  drift on displayed deltas, are deliberate/accepted and left alone):
  - `describeItem` (`js/systems/inventory.js`) now takes `state` and
    factors in the item's own smith-upgrade level via
    `getItemEffectiveStats`, not just its tier - a Superior sword
    upgraded to +2 previously showed the same tooltip stat as a fresh,
    unupgraded one.
  - Added a shared `STAT_LABELS` map + `formatStatDelta` (also in
    `inventory.js`), replacing the two duplicated `formatDelta`
    functions in `inventoryScreen.js`/`shopScreen.js` that printed raw
    camelCase stat keys (`lifestealPercent +15`) whenever an effect stat
    was nonzero. Also applied inside `describeItem`'s own stat listing,
    which had the same underlying bug for any unique-effect item's
    tooltip (Vampiric Fang, Ember Ring, etc.) - not the specific site
    the backlog named, but the same fix.
  - Consolidated the three separate `getEquipmentBonuses(state)` calls
    on `battleScreen.js`'s mount path into one, computed in `mount()`
    and passed into `buildPlayerCombatant`/`buildMonsterCombatant` -
    pure refactor, no behavior change.

## [0.14.0] - 2026-08-31

### Added
- Progression feedback for battle damage: a per-move lifetime-best tracker
  (`state.bestDamage`, keyed by ability id / `'attack'`) pops a distinct
  purple "NEW MAX!" badge (`playNewMaxEffect` in `js/screens/battleScreen.js`,
  reusing the existing `playPerfectTimingEffect` pop-badge mechanics) whenever
  a hit beats its move's own recorded best - persists across battles/saves/NG+
  via the existing `persist()` call at battle end, migrated onto old saves by
  `migrateBestDamage` (`js/state.js`). Also added a live DPS meter in the
  battle sidebar (`#battle-dps`), computed from cumulative player damage over
  `battleElapsedMs` (advanced only inside `tick()`, so pausing the battle
  freezes it for free - no separate pause bookkeeping needed) and reset each
  battle. Raised 2026-08-31 (see `docs/superpowers/BACKLOG.md`).

## [0.13.1] - 2026-08-31

### Added
- Every battle action button now has a real plain-language "what this
  does" description in its hover tooltip, not just name/cooldown/combo/
  damage numbers - matching what Parry's tooltip already had. Attack
  explains its spam-decay mechanic, Item states the exact heal amount
  (`ITEMS.potion.heal`), Flee explains it always works except against
  bosses, and each of Stab/Chop/Slash/Sweep/Super Scream now has a
  `description` field in `js/systems/abilities.js` describing its actual
  effect - Super Scream's damage-boost percentage and duration are
  computed from `ROTATION_BONUS_MULTIPLIER`/`buffDurationMs` at render
  time rather than hardcoded, so they can't drift from the real values.
  Motivated by mid-battle pause (0.13.0): pausing to go read a tooltip
  is only useful if the tooltip actually explains something.

## [0.13.0] - 2026-08-31

### Added
- Mid-battle pause: a pause button docked upper-left of the battle
  dialog (separate from the ability action bar) plus a `P`/`p` keybind,
  both toggling pause/resume. Freezes everything that decides the
  outcome - the 300ms tick (ATB fill, cooldowns, buff duration), a
  monster's windup/parry-zone CSS animation and its real-time parry
  window (shifted forward on resume by however long the pause lasted,
  via `shiftWindupStart()` in `js/systems/parry.js`, so the paused time
  never counts as elapsed windup time), and the ability timing-meter's
  `requestAnimationFrame` loop and sweet-spot pulse. All player battle
  actions (attack, ability, parry, item, flee, target-select) are
  no-ops while paused. A dim overlay + "PAUSED" label spans the whole
  dialog-and-action-bar card (not just the hero/monster area, so the
  ability buttons read as grayed out too), using `pointer-events: none`
  so hovering for a native `title` tooltip - the actual point of
  pausing, per the idea that spawned this - still works right through
  it. Already-committed cosmetic effects (damage numbers, crit shake,
  lunges, death animation, an in-flight ability's AOE stagger) are
  deliberately left running rather than frozen - they don't resolve
  into anything a pause could get wrong, and freezing them had no
  gameplay payoff. See `docs/superpowers/BACKLOG.md`'s "mid-battle
  pause" entry (now moved to BACKLOG_SHIPPED.md) for the raised idea
  and open questions this closed out.

## [0.12.2] - 2026-08-31

### Changed
- Mythic-tier gear now hits noticeably harder: `QUALITY_TIER_MULTIPLIERS.mythic`
  raised from 1.35 to 1.5. A fully maxed Mythic item now tops out at 2.625x
  its base stats (was 2.3625x). Aimed at NG+2 specifically feeling like a
  real payoff for maxing gear out, not just barely survivable.
- `scripts/simulate-balance.js` now models the Rung-3 gear on-hit effects
  (crit% bonus, extra-swing chance, lifesteal, elemental proc, thorns
  reflect) that only ever lived in `battleScreen.js`'s
  `playerEffectBonuses`/`applyOnHitEffects` before — the simulator's
  `makeBuild()` now carries those stats through and `simulateBattle()`
  applies them the same way the real battle screen does. Added a second
  "maxed Mythic L12 (NG+2, +rings)" build alongside the existing
  ringless one so the two ring slots (Ember Ring, Windfury Ring) —
  previously silently absent from the maxed-Mythic ceiling measurement —
  are actually represented. This also surfaced and fixed a second,
  unrelated gap: the simulator never applied `resolveMonsterAttack`'s
  returned `monsterHp` at all, so a thorns reflect was computed but
  silently discarded even before this session. No parry modeling added —
  the simulator still assumes a player who never successfully parries a
  single hit (a known, pre-existing, documented scope limit), which is a
  conservative bias on measured player power, not an optimistic one — see
  `docs/superpowers/BACKLOG.md`'s Multi-zone progression section for the
  fuller story and what's still open (getting to genuinely one-to-three-
  hit kills by end of NG+2 needs a different lever than this multiplier,
  and the parry-rate gap is its own follow-up).

## [0.12.1] - 2026-08-31

### Fixed
- The floating damage number and the PERFECT!/PARRY! badge now get their CSS
  animation duration from the same `DAMAGE_NUMBER_DURATION_MS`/
  `PERFECT_TIMING_BADGE_MS` constants that drive their removal `setTimeout`,
  set inline instead of a second hardcoded value in `css/styles.css` —
  the same "two numbers that only happen to agree" hazard the death
  animation's `--battle-death-anim-ms` fix (0.12.0, below) closed for that
  animation, applied here to the other two spots in `battleScreen.js` with
  the identical shape.

## [0.12.0] - 2026-08-31

### Added
- Battle action row redesigned to icon-only buttons (icon + a small keybind
  chip in the corner, no more wrapping text), and given a Parry button
  (🛡️ S) so the mechanic has a visible reminder and a click target instead
  of being keyboard-only. A red conic-gradient "clock wipe" now shows
  cooldown remaining instead of a countdown number; the ability name,
  cooldown, combo status, and damage estimate that used to sit in the
  button's own text now live in its hover tooltip.
- The action row now docks as its own stationary bar directly under the
  battle dialog instead of living inside it, so it no longer swirls in/out
  with the dialog's own mount/unmount animation.
- That action bar now splits into two rows: the numbered ability keys
  (1, 2, 3, 4, ...) on top, Parry/Attack/Item/Flee below - matching the
  muscle memory of resting fingers on the number row first.
- Both action rows now center their buttons under the dialog instead of
  packing them against the left edge.
- Fixed the dialog rendering narrower than (and misaligned under) the
  action bar - the dialog and action bar are now both fixed-width panels
  inside one shared container, guaranteed to line up exactly.
- The dialog and action bar now swirl in/out together as one unit on
  battle start/end, instead of only the dialog animating while the empty
  action bar sat on screen a beat longer.
- Action buttons now stay visible (though inert) through the post-battle
  pause and fade away together with the dialog, instead of disappearing
  the instant the battle ends.
- The dialog's exit animation now waits for the battle-ending hit's own
  effects (damage number, death animation, revive glow) to finish first,
  instead of starting while they're still playing.
- A dead monster's slot now keeps its space reserved in the dialog
  instead of collapsing, so the dialog no longer resizes/re-centers each
  time a monster dies mid-fight, or visibly shrinks right before its exit
  animation plays on the final kill.
- The monster death animation's visible duration is now driven directly
  from the same timing value that decides when the slot gets hidden,
  instead of two separately-hardcoded numbers that happened to agree -
  retuning one now automatically keeps the other in sync.

## [0.11.1] - 2026-08-30

### Fixed
- Ring-slot items (`slot: 'ring'`) were compared/counted against a
  nonexistent `state.equipment['ring']` key in two places: the Smith and
  inventory item-stat-delta comparison (`getItemStatDelta` in
  `js/systems/inventory.js`) and the Loot Reference "own N" count
  (`js/screens/lootReferenceScreen.js`), which never recognized an
  equipped ring as owned. Both now resolve through the real `ring1`/`ring2`
  keys.
- A save from before Ember Ring was reclassified from `slot: 'accessory'`
  to `slot: 'ring'` could have it stuck equipped in the accessory slot
  forever. `migrateRingSlots` (`js/state.js`) now relocates a
  legacy-equipped Ember Ring into `ring1` on load.
- The Smith screen showed a permanently-empty, permanently-disabled
  upgrade select/button on an equipped ring, since no upgrade material
  exists for ring slots. It's now suppressed for any slot with no
  upgrade material defined at all, while the normal 5 gear slots still
  correctly show a disabled-but-real button when the player just doesn't
  currently hold a material. Empty ring rows also now read "Ring 1:" /
  "Ring 2:" instead of the raw `ring1`/`ring2` key.
- The Stats panel's effects list didn't include Retribution Charm's
  thorns bonus, so it was invisible even when equipped.

## [0.11.0] - 2026-08-30

### Added
- Mythic gear tier (NG+ only): a fourth quality tier above Superior, obtainable via drop luck or a gold + Mythic Essence smith reforge.
- Two new NG+-exclusive unique items: Retribution Charm (reflects damage) and Windfury Ring.
- Two new ring equipment slots (Ring 1 / Ring 2), alongside the existing weapon/head/body/legs/accessory slots. Ring-slot items (Ember Ring, Windfury Ring) only drop from sufficiently tough monsters.

## [0.10.0] - 2026-08-30

### Added
- Animation Lab (`tools/animation-lab/`): a dev-only visual tool for
  designing weapon-swing animations, following the same never-deployed,
  no-build-step pattern as `tools/terrain-painter/`.

### Changed
- Weapon-swing keyframes (Attack/Stab/Chop/Slash/Sweep) are now
  data-driven inside `js/screens/battleScreen.js`, so Animation Lab can
  regenerate them - no visible gameplay change from this alone.

## [0.9.0] - 2026-08-30

### Added
- Monster groups can now reach up to 6 members (up from 3) and mix
  species within one group instead of always-identical copies
  (`js/systems/groupEncounters.js`).
- Two independent pressures push group size toward that cap: NG+ cycle,
  and time spent wandering zone-1 wilderness screens this cycle
  (`state.zone1Steps`, `js/screens/mapScreen.js`). NG+ also raises how
  often a group spawns at all, not just how big it is.

### Fixed
- `#overlay` (the battle dialog's own backdrop) had no `overflow-y`, so a
  6-member group's monster row wrapping onto two lines on a short
  viewport could clip the battle menu with no way to scroll to it.
  Added `overflow-y: auto` as a safety net (`css/styles.css`).

## [0.8.6] - 2026-08-30

### Changed
- Weapon swings (Attack/Stab/Chop/Slash/Sweep) all traveled the full
  distance from hero to target, which read as a projectile flying at the
  enemy rather than the hero's own weapon swinging near them. Attack and
  Chop specifically now stay anchored close to the hero (dx/dy only lightly
  bias the direction) instead of traveling to the target - the target's
  existing hit-flash/shake/damage-number still sells the impact. The hero's
  own emoji also now lunges toward the target on every swing (the same
  lunge-and-snap-back trick monsters already use for their own attacks),
  so the character itself visibly moves into the strike.

### Changed
- Plain Attack's swing (whatever weapon's equipped) redesigned - was
  holding one fixed diagonal orientation with no rotation, which read as
  inert. Now arcs up and over the target along a curved "rainbow" path
  while spinning a full rotation, and carries on through past the target
  rather than retracting - a big tumbling swing, distinct from Stab/Chop's
  precise stop-short thrust.

## [0.8.4] - 2026-08-30

### Changed
- Stab and Chop now stop short of the target's own center (70% of the way
  in) instead of traveling all the way to it - with no way to hide the
  blade tip inside the target sprite, going all the way to center read as
  stabbing/chopping all the way through and out the other side. Slash and
  Sweep are unchanged - a full pass-through already reads correctly for a
  wipe/sweep motion.

## [0.8.3] - 2026-08-30

### Changed
- Stab's swing was facing back toward the hero instead of the enemy -
  flipped 180 degrees.
- Chop's swing redesigned so the axe blade (on the left side of the 🪓
  glyph, not the right) actually leads into the target: it now approaches
  from the target's own right and swings down-left into it, instead of
  falling straight down from directly overhead.

## [0.8.2] - 2026-08-30

### Fixed
- Attack's weapon-swing sprite (0.8.0) used a weapon's own inventory emoji
  verbatim, which looks fine in a gear list but not for three weapons whose
  icon is a body-part pun rather than a weapon shape - Dragon Fang Blade
  (🦷), Fossil Fang (🦖), and Vampiric Fang (🦴) all swung that literal
  tooth/dinosaur/bone. Added an optional `swingEmoji` override
  (`js/data/items.js`) so these three swing a proper blade (🗡️) instead;
  every other weapon is unaffected.

## [0.8.1] - 2026-08-30

### Fixed
- 0.7.9's `#overlay` z-index bump (raised to sit above `#item-pickup-toast`)
  had an unnoticed side effect: every fixed-position battle effect appended
  directly to `<body>` - damage numbers, the "PERFECT!" timing badge, the
  monster's own ranged-attack projectile, and (as of 0.8.0) the new
  weapon-swing sprites and their afterimage trail - was still sitting at a
  lower z-index than the dialog itself, so all of them had been silently
  rendering *behind* the battle screen instead of over it. Raised each of
  their z-index values above `#overlay`'s (`css/styles.css`) so they're
  actually visible again.

### Changed
- Weapon-swing sprites (0.8.0) are noticeably bigger and slower than
  originally shipped - confirmed via live testing that this reads much
  better than the original subtle version.

## [0.8.0] - 2026-08-29

### Added
- Player attacks now play a weapon-swing animation instead of resolving as a
  silent number - Attack swings the equipped weapon's own emoji, while
  Stab/Chop/Slash each swing their own ability icon with a distinct motion
  (thrust/overhead chop/diagonal wipe) (`js/screens/battleScreen.js`).
- Sweep now plays as one large traveling swing sprite that visits every
  living target in turn, staggered so each monster's hit lands as the sprite
  actually reaches it, rather than every target taking damage in the same
  instant with no visual to match.
- A crit hit's swing (and Sweep's swing, always) now trails a fading
  afterimage of ghost copies along the same path.
- A crit killing blow has a chance to play an alternate "split in two" death
  animation instead of the usual spin-and-shrink.

### Changed
- Sweep's cooldown/attack-streak/combo bookkeeping now commits at the moment
  the ability is pressed rather than after its (now staggered) hits finish
  resolving, matching this file's existing press-time-semantics convention
  for every other ability.

## [0.7.9] - 2026-08-29

### Fixed
- Shop could never sell a single Fine/Superior copy of a gear item - only
  the Plain stack had a sell button. Each owned tier now gets its own sell
  row in the shop (`js/screens/shopScreen.js`), priced the same as Plain
  (no tier premium, matching the existing Sell Duplicate Gear precedent).

### Changed
- Removed the crit/parry battle-dialog shake (`.battle-dialog-shake-crit`)
  - too much motion mid-fight. The character-level sway reaction is
    unchanged. A landed parry now gets its own distinct gold "PARRY!"
    badge plus a brief flash on the hero's own emoji
    (`js/screens/battleScreen.js`'s `playParryEffect`), replacing the
    reused ability-timing-hit "PERFECT!" badge as the "that worked" signal
    now that the shake is gone.
- Status log battle-outcome entries now also record the equipped gear (all
  5 slots) at the moment combat ended, alongside the effective stats
  already snapshotted there - useful for diagnosing whether combat balance
  is behaving as designed without a separate lookup.

## [0.7.8] - 2026-08-29

### Fixed
- NG+ never reset the player's tools (axe/mining pick/boat) or
  `clearedGates`, so a player who'd already earned every tool and cleared
  every tool gate could walk straight to the dungeon entrance on a fresh
  NG+ cycle, skipping zone 1's tool-gated obstacles entirely.
  `resetWorldForNgPlus` (`js/systems/ngPlus.js`) now strips tool items from
  inventory and resets `clearedGates` on every future NG+ transition,
  reproducing the exact same reachability graph a brand-new save starts
  with - re-fighting each tool guardian already worked with zero extra
  code (the guardian tile has no "already defeated" flag). A one-time
  `migrateNgPlusToolCarryover` migration also retroactively strips
  carried-over tools from any save already sitting at `ngPlusCycle >= 1`
  from before this fix (inventory only, not a retroactive `clearedGates`
  revert - re-gating already-cleared terrain out from under a save
  mid-playthrough would be a bigger surprise than this migration is
  meant to cause).

## [0.7.7] - 2026-08-29

### Changed
- Town's own tile grid grown from 8x6 to 16x12 - it was never actually
  resized before, but the viewport around it grew a lot in 0.7.1 (fills
  the real browser window instead of a fixed 1020x700px cap), so the same
  small town started reading as a tiny cluster in a much bigger empty
  viewport. `startPosition` moved to match the regrown layout.
- Shop buy buttons: gear rows (weapons/armor/accessories) now offer a
  single "Buy" button instead of the full 1x/5x/10x/100x set - equipping
  only ever uses one copy at a time, so bulk-buying gear was never
  actually useful. The Potion row (the only `type: 'consumable'` in the
  shop) keeps the full bulk-quantity set.

## [0.7.6] - 2026-08-29

### Changed
- "Sell Duplicate Gear" (added in 0.7.4) moved from the Inventory screen to
  the Shop screen - Timothy's own correction: selling belongs in the shop,
  not something available anywhere/anytime. Same behavior otherwise (sells
  every unequipped duplicate copy of a gear item, keeping one, at half
  price), scanning the player's whole inventory rather than just
  `SHOP_CATALOG`.

## [0.7.5] - 2026-08-29

### Fixed
- Spamming basic Attack decays its own damage down to a 0% floor (once
  all 5 abilities are unlocked), but Ember Ring's `elementalProcDamage`
  is a flat stat unrelated to the hit's own damage number, so it kept
  dealing its full fixed proc damage even on a fully-decayed 0-damage
  spammed swing - defeating the point of the spam throttle.
  `applyOnHitEffects` (`js/screens/battleScreen.js`) now scales the
  elemental proc's damage by the same streak multiplier as the attack
  itself; ability hits (never spam-decayed) are unaffected.
  `lifestealPercent` needed no equivalent fix - it's already a
  percentage of the real, already-decayed hit damage.

## [0.7.4] - 2026-08-29

### Added
- Inventory's Gear tab now has a "🧹 Sell Duplicate Gear" button - sells
  every unequipped duplicate copy of the same gear item (keeping one),
  same half-price sale as the shop. Gear-only: materials/potions are meant
  to stack past 1, and equipping an item already removes its own inventory
  copy (`equipItem`), so a gear entry's quantity can only be >1 from owning
  multiple unequipped copies in the first place. New
  `sellDuplicateGear` in `js/systems/inventory.js`.

### Fixed
- The post-fight "what you got" item-pickup toast (anchored near the HUD
  Inventory button) could render on top of the inventory screen if opened
  while the toast's 1.2s fade was still playing - `#item-pickup-toast` had
  an explicit `z-index: 30` but `#overlay` (every overlay screen: inventory,
  shop, smith, etc.) had none, so the toast painted above it. `#overlay`
  now sets `z-index: 35`.

## [0.7.3] - 2026-08-29

### Fixed
- Random wilderness/dungeon encounters had no memory of the last one, so
  two fights on consecutive steps was always possible - rare per single
  pair of steps (e.g. 15% * 15% = 2.25%), but noticeable over a real play
  session and felt bad whenever it landed. `mapScreen.js`'s `tryMove` now
  tracks a new `state.encounterCooldown` counter: any random encounter
  (including the rare elite roll) sets it to `ENCOUNTER_COOLDOWN_STEPS`
  (2), and it ticks down once per real step regardless of tile type,
  suppressing the encounter roll entirely until it reaches 0 - guaranteeing
  at least 2 encounter-free steps after every fight. Doesn't apply to
  tile-triggered fights (guardians, the boss), which aren't random rolls.

## [0.7.2] - 2026-08-29

### Changed
- Dragon Fang Blade (attack 14→16), Fossil Fang (attack 12→14), and Dragon
  Scale Mail (defense 10→12, maxHp 15→18) all buffed - these named boss/elite
  drops are excluded from the Fine/Superior quality-tier system entirely, so
  a stat bump was the only way to make them feel a bit stronger.

### Fixed
- Smith-upgrade level was keyed by bare itemId, so every tier of the same
  base item (Plain/Fine/Superior) shared one upgrade level - equipping a
  freshly found Fine Iron Helm could show it already maxed just because the
  Plain copy had been upgraded. Now keyed by itemId+tier, so each tier
  upgrades independently. Existing saves migrate automatically on load: a
  legacy level moves to whichever tier is currently equipped in that slot,
  or Plain if nothing matching is equipped.
- The inventory list could show the identical stat delta for a Plain and a
  Fine copy of the same item (e.g. both reading "attack -16") even though
  the Fine copy is genuinely stronger - `getItemStatDelta` rounded the
  final subtracted difference instead of rounding each side first, so two
  raw deltas less than 1 apart could land in the same rounding bucket.
- The Shop/Smith screen's close-x button could overlap a long title (e.g.
  "Smith (Gold: 6401)") - the title now reserves room for it.
- rpg.burghertime.com could keep serving a stale cached copy of `js/`/`css/`
  files for hours after a deploy, even though the origin was already serving
  the current files (confirmed via direct curl diff) - `_headers` now sets
  `Cache-Control: no-cache` on both, so browsers always revalidate with the
  server (a cheap 304 if unchanged) instead of trusting a long local cache.
- CI now fails a deploy if non-doc files changed in a push but
  `CHANGELOG.md` wasn't touched in that same push, so a code change can't
  ship without at least an `## [Unreleased]` entry.
- The in-game footer/"What's New" screen (`js/data/playerChangelog.js`,
  read by `PLAYER_CHANGELOG[0]` in `js/main.js`) was stuck showing `v0.7.0`
  even after `0.7.1` shipped - the dev-facing `CHANGELOG.md` got its version
  bump, but the separate player-facing changelog never got a matching entry,
  so there was no way to tell which version was actually live. Backfilled
  the missing `0.7.1` entry and added `tests/versionSync.test.js`, which
  fails `npm run test` (and therefore CI) whenever `CHANGELOG.md`'s newest
  dated version and `PLAYER_CHANGELOG[0].version` drift apart, so a future
  version bump can't ship without updating both together.

## [0.7.1] - 2026-08-29

### Added
- Inventory screen now has switchable tabs (Gear/Materials/Potions/Tools)
  instead of one long scrolling list, plus a per-tab sort control
  (Alphabetical/Quantity, with Rarity added on the Gear tab). Equipment
  stays always-visible above the tabs since it's a fixed 5-slot status view,
  not a growing list. Defaults to the Gear tab, alphabetically sorted.

### Fixed
- The map viewport was capped at a fixed 1020x700px regardless of the actual
  browser window size, wasting most of a large desktop window. `#app` now
  fills the real remaining space below the HUD/above the footer (a flex
  column on `body`), and `.map-viewport` fills all of `#app` — so
  `computeViewportTileCount` (`js/screens/mapScreen.js`), which already
  measured the viewport's real rendered size, now shows meaningfully more of
  the world on a large window instead of stopping at 21x13 tiles.
- `#hud` is now `position: sticky; top: 0`, so it stays visible instead of
  scrolling out of view.
- The random mini-dungeon map marker no longer reuses the mining pick's own
  `⛏️` emoji (confusable with actually receiving a pick) — swapped to `🥾`.
- The tool-pickup celebration's orbiting emoji now anchors to the player's
  actual on-map tile instead of always popping up at viewport-center
  (mirrors `mapScreen.js`'s existing `playMonsterFleeEffect` pattern), and
  the orbit animation is twice as slow as before for more effect.

## [0.7.0] - 2026-08-29

### Added
- Continuous camera-following viewport replaces discrete per-screen map
  rendering: the wilderness's 25 linked screens (and town/dungeon interiors,
  through the same mechanism) now stitch into one global tile-coordinate
  space (`js/systems/worldGrid.js`) that the camera pans across, rather than
  swapping to a fresh full-screen render at each screen boundary.
  `js/screens/mapScreen.js`'s `render()`/`tryMove()` were rewired onto this
  grid (`screenToGlobal`/`globalToScreen`) in place of the old teleport-based
  edge-transition path.

### Fixed
- Crossing a screen boundary directly onto a tool-gated tile (mountain/
  thicket) with the right tool now correctly converts it to a stump/rubble
  marker — previously this conversion only fired when the gate was cleared
  mid-screen, not when the very first tile stepped onto after a screen
  transition was itself the gated tile, since the old teleport path
  (`handleEdgeTransition`) never ran the gate-clearing check at all.
- A tile's worn-path trail no longer leaks per-screen local coordinates
  across a screen boundary: `edgeOwner`, the trail gradient id, and the
  neighbor-wear lookup in `js/screens/mapScreen.js` now resolve against
  GLOBAL coordinates instead of the current screen's local ones, so two
  screens' tiles visible in the same viewport can no longer disagree on a
  shared edge (a visible seam/kink) or collide on gradient ids.

## [0.6.1] - 2026-08-28

### Fixed
- Resizing the browser window (grow then shrink) left the map area stuck
  at its old, larger size until a full page reload — Safari-only; Chrome
  and Firefox never had this bug. Root cause: Safari doesn't reliably
  re-run CSS Grid's track-sizing algorithm when a grid whose tracks size
  `aspect-ratio` children (`.map-grid`'s `repeat(N, 1fr)` tracks /
  `.map-tile`'s `aspect-ratio: 1`, `css/styles.css`) has its own container
  shrink on a live resize — confirmed via Timothy's own Safari screenshots
  (grid stayed large after a grow-then-shrink resize; reproduced the same
  scenario in Chrome with no issue). Fixed with a `resize` listener
  (`js/screens/mapScreen.js`) that forces a synchronous reflow of
  `.map-grid` (toggling `display: none` → `''` before the next paint, so
  nothing visibly flashes), which makes Safari redo the track-sizing pass
  against the grid's corrected size. Closes the backlog's "Responsive
  layout: browser window resize gets stuck" entry.

## [0.6.0] - 2026-08-28

### Added
- In-game version number and changelog: a footer at the bottom of the page
  shows the current version and opens a new "What's New" overlay
  (`js/screens/changelogScreen.js`) listing player-facing highlights per
  version. Deliberately backed by a new hand-curated data file
  (`js/data/playerChangelog.js`), not a runtime fetch/parse of this file —
  Timothy's call: this file's own entries are written in developer prose
  (file/function names, internal mechanics) and aren't fit to show
  players directly, so the in-game view stays a separate, manually
  maintained translation instead. Closes the backlog's "Version display in
  the UI" entry. Everything below this line that had been sitting under
  `Unreleased` is folded into this same `0.6.0` release, cut now as part of
  shipping this feature (a MINOR bump — it bundles several completed
  systems, per this file's own versioning rule above).
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
- The town quest board tile (📋) now glows (`map-tile-quest-ready`,
  a looping gold `box-shadow` pulse) whenever at least one quest is
  turn-in ready, so it's noticeable from a distance on the town map
  instead of only discoverable by walking up and checking. New
  `hasAnyQuestReady(state)` helper in `js/systems/quests.js` reuses
  `canTurnInQuest` across every `QUEST_REQUIREMENTS` entry; wired into
  `js/screens/mapScreen.js`'s per-tile render.
- Worn-path trails (`state.visited`) now carry over across NG+ cycles
  instead of resetting to blank like every other world-progress field
  (`js/systems/ngPlus.js`'s `resetWorldForNgPlus`) - Timothy wants the
  trails he's walked kept between playthroughs. Purely cosmetic data
  (per-tile walk history for trail rendering), nothing else reads it as
  a per-cycle completion signal, so nothing else changes.
- A new rung-3 unique-item effect: crit chance. `rollCrit` now accepts an
  optional bonus fraction on top of the base 10% `CRIT_CHANCE`, threaded
  through `resolvePlayerAttack`/`resolveAbilityUse`/`resolvePotionUse`
  (`js/systems/combat.js`/`abilities.js`) from a new `critChancePercent`
  equipment stat (`js/systems/inventory.js`'s `STAT_KEYS`). New drop:
  Keen Eye (👁️, accessory, `critChancePercent: 8`), added to
  `UNIQUE_EFFECT_ITEM_IDS` (`js/systems/loot.js`) alongside Vampiric
  Fang/Swift Strike Charm/Ember Ring — same rare monster-kill-drop pool,
  same "found only, never sold" rule. Deliberately scoped to the player's
  own crit rolls only, not `resolveMonsterAttack` — a monster's crit
  chance is its own, unaffected by the player's gear. Not modeled in
  `scripts/simulate-balance.js`, matching the same scope gap already
  accepted for lifesteal/extra-swing/elemental-proc.
- Parry's red zone and the ability timing meter's green sweet spot now
  flash (`battle-zone-pulse`, a `filter: brightness()` pulse) the exact
  real-time instant their moving fill crosses into the actionable zone,
  instead of only ever showing a static color change. Timed via
  `animation-delay` set at windup/meter start (delay = zone-start-percent
  × duration) rather than polled each tick/frame, so it can't lag behind
  like a polled trigger would — same real-time-not-polled approach as the
  parry fill fix below. `js/screens/battleScreen.js`/`css/styles.css`.

### Fixed
- Parry's visible red zone could lag noticeably behind the real accept
  window ("I feel like I hit before the red section and it parries").
  The keypress check itself already used real elapsed wall-clock time
  (fixed 2026-08-25), but the *visible* fill was still painted from a
  300ms-tick JS snapshot smoothed by a `transition: width 0.3s linear`,
  so what was drawn could trail the real value by up to ~600ms. The
  windup fill now animates via a CSS `@keyframes` animation
  (`battle-windup-fill`, duration = `PARRY_WINDUP_DURATION_MS`) started
  at the same instant the windup begins, painted continuously by the
  browser instead of polled — matching what `resolveParryAttempt`
  actually checks at keypress. `js/screens/battleScreen.js`/
  `css/styles.css`.
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
