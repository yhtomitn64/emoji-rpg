# Worn-Path Encounter Discount — Design

## Purpose

Trail wear (`docs/superpowers/specs/2026-08-25-worn-path-trail-design.md`)
is purely cosmetic today — a tile you've walked 10+ times looks like a
real dirt path but is exactly as dangerous as one you've never set foot
on. Raised 2026-09-12 (`docs/superpowers/BACKLOG.md`'s "Worn paths
could reduce encounter chance over time" entry): the more a tile's been
walked, the safer it should read as — "a road you've built" — so wild-
encounter chance on it should taper down as it wears in, up to a cap.

Designed as a collaboration in-session; decisions below are Timothy's
own calls, made when this doc's questions were put to him directly
(2026-09-12).

## Decisions

1. **Curve matches the visual trail exactly, no separate constant.**
   The discount multiplier is a direct function of `trailWearFraction`
   (`js/systems/trail.js`, capped at `TRAIL_WEAR_CAP = 10` visits) — the
   same fraction that already drives stroke width/color. Timothy: "I
   feel like [this] so it matches the visual indicator exactly." He's
   explicitly fine with a heavily-trafficked tile (e.g. a town
   chokepoint) reaching max discount within its first 10 crossings —
   his own read is that a player deliberately paving ground for the
   discount is already leveling up in the process anyway.

2. **Discount is capped at 50% off, per-tile, and that's the only
   safeguard.** No per-screen aggregate budget, no "only one core route
   gets the discount" restriction. Timothy floated a core-route-limiting
   idea live but immediately deferred it: "I'm not sure this seems like
   it's getting much bigger. I think [a flat per-tile cap] sounds good
   for now. I can always change/tweak/tune later." A fully-paved screen
   reading as meaningfully safer is accepted as the intended feel
   ("you've tamed this area"), not a bug to guard against. The core-
   route idea is recorded in `BACKLOG.md` as a parked follow-up, not
   built.

3. **No NG+ tempering.** The discount cap and curve are identical at
   every NG+ cycle — Timothy's call, explicitly "No special NG+
   handling." Trail/visit data already persists across NG+ resets
   (`js/systems/ngPlus.js`'s `resetWorldForNgPlus`, deliberately not
   cleared), so an experienced player re-entering a well-trodden zone-1
   screen in NG+2+ gets the discount immediately, same as pre-NG+. This
   is a real, known consequence — not an oversight — and matches
   Timothy's own expectation that reaching that state took real,
   sustained play regardless of cycle.

4. **On by default, with a Settings opt-out.** `state.settings.
   wornPathDiscountEnabled` (default `true`) toggles the whole effect
   off for players who'd rather every tile stay at full danger.

5. **A one-time in-game hint**, shown the first time a discount actually
   applies to a step (not merely the first visit to any tile), using
   Timothy's own wording: "Did you notice you're making a trail? Stay on
   the trail to reduce monster encounters!" Not attributed to a named
   character/NPC — this project's narrative content is explicitly
   author-written only (see `BACKLOG.md`'s "Story / narrative" entry),
   and a voiced line would cross into that. This is plain system UI
   copy, the same category as the existing tool-gate proximity messages.
   Suppressed entirely when the setting is off (telling a player who
   disabled the discount to "stay on the trail" would be wrong), and
   gated on a one-time flag so it never repeats.

## The ring/charm question

`BACKLOG.md`'s Multi-zone progression section separately floats "a ring
that suppresses random encounters entirely" (raised 2026-09-05, never
designed). Timothy's call this session: design both together, but only
the worn-path discount ships now — the ring is scoped, not built.

**Do they compose, or does one replace the case for the other?** They
compose, and they're doing different jobs:

- The worn-path discount is a **passive, universal reward for ordinary
  play** — every character gets it for free just by walking around, capped
  modestly (50%), and it reflects the *place* (this specific tile), not
  the player. It never fully removes risk anywhere you haven't already
  tamed.
- A suppression ring is a **deliberate, equipped choice with an
  opportunity cost** (it occupies a ring slot instead of a combat/loot
  ring) that reflects the *player's* current loadout, works anywhere
  including unwalked ground, and can go further than 50% — up to full
  suppression if that's the effect Timothy wants once it's actually
  designed.

Building the discount doesn't remove the case for the ring (it solves
"reward exploring the same ground," not "let me choose to skip
encounters somewhere new"), and the ring doesn't remove the case for the
discount (most play never equips it). Two findings worth recording so
the ring is cheap to add later:

- **Cache/mini-dungeon discovery is a separate roll** (`js/systems/
  discovery.js`'s `resolveStepDiscovery`), gated on `tile.encounter` the
  same way the wild-encounter roll is, but never touches
  `mapConfig.encounterChance`. Suppressing wild encounters — worn-path
  discount, a future ring, or both — never touches cache/mini-dungeon
  discovery odds.
- **The discount is implemented as a multiplier on the roll threshold**
  (`Math.random() < mapConfig.encounterChance * wornPathMultiplier`),
  not a restructuring of the roll itself. A future ring effect is just
  another multiplier folded into the same expression
  (`encounterChance * wornPathMultiplier * ringMultiplier`) — no new
  branch, no reordering of the existing `Math.random()` call sequence
  other tests already depend on. The seam is already there; the ring
  doc, whenever it's written, just needs to define `ringMultiplier` and
  where it comes from (equipment stats, existing pattern in
  `js/data/items.js`'s unique-effect items — `ngPlusOnly: true` and the
  superboss-exclusive-drop pattern are the existing precedents for
  gating an effect this strong).

Not designed this round: the ring's exact strength, drop source, or
whether it's NG+-gated. Left for a future pass when it's picked up.

## Balance-simulator relevance

`scripts/simulate-balance.js` is combat-numbers-focused only (party
stats, monster stats, win rates) — it has no encounter-frequency or
pacing model, so there's nothing in it for this change to hook into or
update.

## Implementation shape

- `js/systems/trail.js`: `WORN_PATH_MAX_DISCOUNT = 0.5` and
  `wornPathEncounterMultiplier(visitCount)`, pure function, same module
  that already owns `trailWearFraction`.
- `js/screens/mapScreen.js`'s `tryMove`: capture the tile's visit count
  *before* `markVisited` records the current step (not after) — a
  never-before-walked tile should get zero discount on the very step
  that first walks it; the discount reflects pre-existing wear, not the
  step in progress. Fold `wornPathEncounterMultiplier(priorVisitCount)`
  into the existing encounter-roll comparison at the same call site,
  gated on `state.settings?.wornPathDiscountEnabled !== false`.
- `js/state.js`: `DEFAULT_WORN_PATH_SETTINGS`, folded into
  `createNewGame()`, plus a `migrateWornPathSettings` one-time migration
  (same shape as `migrateHudSettings`) wired into `main.js`'s migration
  pipeline.
- `js/screens/settingsScreen.js`: a checkbox under the existing Display
  section (same style as `showXpInHud`).
- One-time hint banner: reuses the existing `showFlavorBanner` /
  one-shot-flag pattern (`flags.firstKillCelebrated` etc.) — a new
  `flags.wornPathHintShown`, no migration needed since `undefined` reads
  as "not shown yet" for existing saves too, which is the correct
  behavior.
- `js/systems/ngPlus.js`: the comment on `resetWorldForNgPlus` claiming
  visit data is "purely cosmetic ... nothing else reads it as a per-cycle
  completion signal" becomes false and needs rewriting to describe the
  new, deliberate gameplay effect.

## Out of scope (this round)

- The suppression ring itself (item, drop source, balance).
- Any per-screen aggregate cap or "one core route" restriction.
- Any NG+-specific tempering curve.
- A real tutorial/NPC system for the hint — it's a plain banner, not a
  character.
