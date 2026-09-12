# Backlog

Ideas, bugs, and follow-ups raised mid-session that aren't part of the
current plan. Not prioritized — just captured so nothing gets lost.
Shipped items have moved to
[BACKLOG_SHIPPED.md](BACKLOG_SHIPPED.md) to keep this list to what's
actually still open.

## Index — read this section first

One line per open thread, grouped by the section it lives in below. For
a "what's open / what's next" check, read only this index — it's a small
fraction of the file's token cost. Only open the linked section when a
specific item needs its full context (history, code pointers, decisions
already made). Keep this index in sync whenever an item ships or a new
one is raised — that's the whole point of it.

**Balance-tuning queue, decided 2026-09-01 — all three sessions now
run:** parry window + simulator parry-rate (session 1, shipped
2026-09-01, see BACKLOG_SHIPPED.md's Multi-zone progression section),
NG+ loot ceiling (session 2, **numeric-cap half shipped 2026-09-01 as
0.16.3** — item-design half + NG+/zone-2 direction questions still
open, see the handoff doc's Session 2 section for the split), and
defense scaling/near-town pacing (session 3, **investigated and
partially shipped 2026-09-02 as 0.17.3** — the literal damage-floor bug
is fixed, but the deeper "nothing feels dangerous" complaint turned out
structural, not a tuning gap: no static near-town monster stat block
can be both safe at L1 and threatening at L9+, so it can't be fixed by
further stat tuning at all. See "The player outpaces near-town/far-
corner content" thread further down for the full investigation and
where the complaint should actually be redirected instead). The
item-design half of session 2 is the only piece of this queue still
genuinely open — see `docs/superpowers/specs/2026-09-01-balance-tuning-
roadmap-handoff.md`'s Session 2 section before starting it.

**New threads raised 2026-09-01, same session as the NG+ uncap (not part
of the three-session balance queue above — separate initiative):**
- ~~**Local + live playthrough telemetry logging.**~~ **Shipped
  2026-09-01/02 (0.17.0, 0.17.1, 0.17.2).** See
  BACKLOG_SHIPPED.md's "Local + live playthrough telemetry logging"
  section for the full history and code pointers.
- **Dev-facing tunable balance-config layer** — expose the constants we
  keep hand-editing (NG+ multipliers, upgrade cost curve, drop-tier
  chances) as live-adjustable rather than source-edit-and-redeploy.
  Scoped to the constants actually iterated on, not literally everything.
  Not started.
- **Player-facing Easy/Normal/Hard difficulty presets** — named bundles
  of the config-layer knobs above. Depends on that layer existing first;
  don't build before it. Not started.
- **De-addiction settings** — Timothy's own idea (bike ride, 2026-09-01):
  let players dial down flashy buttons/CTAs/notifications if they notice
  themselves overplaying. Distinct concern from balance tuning (UX/ethics
  design, not numbers) — deserves its own brainstorm when picked up. Not
  started.
- **Google Analytics + consent/opt-out banner** — if GA4 (or ads) is ever
  added, Timothy wants an explicit banner explaining what it's for and a
  no-strings-attached full opt-out. Back-burner, tied to whenever GA4
  itself gets revisited (see telemetry thread above — GA4 was explicitly
  passed over for now).
- **Querying GA4 via connectors** — sounds doable in principle (Timothy's
  own assessment) but back-burner, same as the GA4 line above — only
  relevant if GA4 actually gets added later.
- ~~**Partial walk-back of the 2026-09-01 upgrade-level uncap, raised
  2026-09-04**~~ **shipped 2026-09-04 (0.24.2)** — `getMaxUpgradeLevel`
  (3 at NG+0, +2/cycle) enforced again in `upgradeItem`. See the fuller
  entry in the Multi-zone progression section below (under the original
  uncap bullet).
- ~~**Deploy workflow: pin the wrangler CLI version**~~ **shipped
  2026-09-04 (0.24.2, hotfixed as 0.24.3 the same day)** — the minor CI
  cleanup (`--commit-dirty=true`) is still deferred, not urgent.
  See the Infrastructure / deployment section below.
- **Puzzle mechanics, raised 2026-09-04** — water picked as the flavor to
  explore first; a first brainstorming pass this same session captured
  trench-fill/poison-drain (share one flood-fill engine, no new painter
  tooling needed), a player-placeable dam, and a strategic block/unblock
  maze idea (both bigger, more dynamic, not designed). Timothy wants to
  keep adding his own notes before this becomes a real design - not
  ready for a spec yet. See the dedicated Puzzle mechanics section below.

- ~~**UI consistency: universal Escape-to-close + aligned dialog chrome.**~~ **Shipped 2026-09-02 (0.18.1)**, extended to also cover click-outside per the same request. See BACKLOG_SHIPPED.md's "Bugs" section for the full audit and file list.
- **Story / narrative** — game needs a real story; Timothy writes it himself, engineering support only.
- **Pacing / progression** — early ramp / dragon-fell-quickly thread: level-12 dragon kill reads as right pacing, but even 3-star dragon was too easy; Timothy's own read is gear, not level, is the driver. Ties to defense-scaling and Mythic-tier items below.
- **Multi-zone progression** (big, needs its own design pass) — zone 2/3/4 identity, spatial difficulty gradient, healing-enemies zone-2 idea, tool-gated zone unlocks, NG+ state carry-over into zone 2, town NPC hints (needs landmarks first). NG+ tools-reset piece already shipped; town south-exit/expand/signage shipped 2026-09-03 (0.21.0), see the Multi-zone progression section below.
  - ~~**NG+ loot stale at the gear ceiling — the hard cap half.**~~ **Shipped 2026-09-01 (0.16.3).** See the detailed bullet lower in this section for the still-open item-design half.
  - **Dragon NG+ better drops** — not designed.
  - **NG+ monsters appearing "out of place"** — raw idea, not designed.
  - **Boss tier / NG+ cycle ceiling** — confirmed fine as-is for now, revisit later.
  - ~~Mythic gear tier NG+2 shortfall~~ — **resolved 2026-08-31 (0.12.2)**: simulator now models ring/on-hit effects, `mythic` multiplier moved 1.35→1.5.
  - **Real goal is "feel powerful by end of NG+2" (2-3 hit kills), still open** — a flat multiplier doesn't get there; needs its own design pass with a different lever.
  - New: NG+ cycle should raise axe/pick/canoe drop chance from regular mobs (raw idea); possibly ties to roaming enemies gated to NG+2+ (raw idea).
  - ~~**Parry window/simulator-trust gap, sharpened**~~ — **Shipped 2026-09-01 as session 1 of the balance-tuning queue (see the top summary above).** Duplicate leftover index line, never removed when that shipped.
  - Terrain painter: zone-switcher (deliberately deferred), dungeon-interior painting (in progress/done, check session history).
  - Staged/tool-sequence-aware reachability checker — still open, algorithm not designed.
  - Non-store zone-1 loot (unique finds outside the shop) — open.
- **Painter tool: paint monster placement** (big idea, not designed) — per-tile/region monster tables as paintable layers.
- **Roaming visible enemies + dragon difficulty scaling** (big, needs design pass) — visible overworld entities, cross-screen movement, opt-in power-scaling dragon mode (standard dragon fight stays fixed). Possible dependency on a scrolling/camera rendering rewrite (also raised independently for mobile-responsive viewport).
- **Fog-of-war reveal map** (`m` keypress) — raw idea, not scoped.
- **New terrain: sand/tarpit/water enemies** — raw idea; needs per-tile-kind monster tables + a move-speed-modifier mechanic, neither exists today.
- **Hand-placed zone-1 loot + shop rebalance** (big, needs design pass) — weaker shop gear, a placement-dropdown system for world loot, possibly tied to hand-placed mini-dungeons.
- **In-game tutorials / mechanic explainers** — **engineering implemented 2026-09-03 (0.22.0)**: both trigger points (ability-unlock popup, mid-battle attack-falloff popup) are wired and gated behind a `mechanicExplainersBeta` Settings toggle. Remaining: Timothy writes the actual explainer copy (`js/data/abilityExplainers.js`, currently empty), then flip the flag on by default. **Re-confirmed still wanted, 2026-09-07:** "maybe a thing should pop up saying 'press again' or something because I don't recall anything explaining what to do when I got the new ability" (Lacerate's retrigger) - exactly what the ability-unlock popup trigger already covers, just no copy written yet and the flag's still off. The settings toggle he asked for the same session ("if we add wording we should make a toggle to turn it off") already exists too (`settings-flag-mechanic-explainers-beta`). Nothing new to build here - just write the copy and flip the flag when ready.
- **Combat pass ideas** — several independent threads, none scheduled:
  - ~~Slower combat / reconsider the timing-minigame layer entirely~~ — **shipped 2026-09-03/04 as the ability GCD rework (0.23.0, graduated per-ability cooldowns in 0.23.1)**, same idea as the "Ability global-cooldown rework" bullet further down this section (also marked shipped there) - Attack + abilities 1-4 came off the swing timer/ATB gauge in favor of a shared, speed-scaled global cooldown, with the timing minigame kept only for Lacerate's retrigger, exactly as sharpened here 2026-09-03.
  - ~~**Ability rotation v2.**~~ **Shipped 2026-09-02 (0.19.0).** See BACKLOG_SHIPPED.md's "Combat pass ideas" section.
  - **Debuff visual effects** (raised 2026-09-02) — a bleed tick should show a falling blood droplet, every enemy debuff deserves its own distinct effect rather than just a status bar. Raw idea, not designed.
  - ~~**Lacerate retrigger sweet-spot flash**~~ — **Shipped 2026-09-03 (0.20.1).** See BACKLOG_SHIPPED.md's "Combat pass ideas" section.
  - Monster inter-buffs/synergies, overlapping/varied monster sizing, background illustration — still-open deferred sub-projects of the bigger-groups work (sizing 1-2 already shipped; the larger-battle-screen sub-project is fulfilled by the separately-shipped "Bigger battle dialog," 0.26.2 — see the Combat pass ideas section below).
  - Rung-3 gear effects: parry window trade-offs (undecided direction). Of the known v1-ship follow-ups, the tier-aware-tooltip, camelCase-stat-key, and redundant-`getEquipmentBonuses`-call items **already shipped in `b8a5d33`** (found stale while doing an unrelated backlog pass 2026-09-03 — this line was never updated when that commit landed) — only AOE lifesteal/proc stacking per target (deliberate, not a bug) and the ±1 delta display rounding (cosmetic, not worth blocking anything on) are still open, and neither is scheduled.
  - Hold-to-block shield, timer-speed items, bonus damage at high swing speed — all raw/tentative ideas.
  - Progressive shrinking parry window per successful landed parry, raised and scrapped in the same session, 2026-09-03 — see Combat pass ideas below for the calibration discussed before it was dropped.
  - Research: alternatives to raw stat-number power creep — rough research question, unblocked but unstarted.
  - ~~**Defense scaling needs work** (player outpaces near-town content thread)~~ — **investigated 2026-09-02, damage-floor half shipped as 0.17.3; the rest is a documented structural dead end, not an open task.** See "The player outpaces near-town/far-corner content" section below for the full writeup.
  - **Ability uses should charge Attack toward a bigger payoff instead of instantly resetting it to full, raised 2026-09-07** — see the Combat pass ideas section below for the full idea and Timothy's own wording. Explicitly shelved until after his current playthrough; not scoped.
- **Mobile/touch combat should be turn-based** — raw idea, explicitly scoped to touch input only.
- **Open question: faster battle timer against weaker enemies?** — needs a decision (is it a speed problem or a power problem), not just an implementation.
- **Infrastructure** — a friend's lag report (too vague to act on, watch for recurrence); pixel-level visual regression test for the trail renderer (good idea, not started, needs its own small design pass); `battleScreenDom.test.js` carries the same fixed-delay CI-flakiness pattern fixed elsewhere 2026-09-07, not urgent (see Infrastructure / deployment section below).
- **Discoverability / monetization** — AdSense (blocked on Google review; placement plan already decided); Cloudflare traffic analytics (waiting on a token from Timothy); opt-in gameplay analytics + local play-data export (not designed, tied to the same difficulty-by-tool-gate tuning question).
- **Input / accessibility** — controller support, raw idea, not investigated.
- **Quests / economy** — manual sell-materials path still deferred (no real pain yet); **excess-gold sink resolved** — buff potions (10-item roster + loadout + battle quick-select) shipped 2026-08-31 as 0.15.0 as the answer. NG+-scaled purchasable store gear considered for the same gap and explicitly deferred (needs a rule for staying below earned/reforged gear first). **New big thread, raised 2026-09-07 (hold for playthrough feedback):** loot/gold/gear economy rework - cap smith upgrade levels per NG+ cycle tighter than today, gate the quest board + blacksmith behind story progress (a rescue-the-blacksmith beat behind the axe/mountain, with a broken/lost sign as the map breadcrumb), merge the quest-giver and blacksmith into one NPC, tier loot drops by enemy strength with more drops overall, halve gold from weak enemies. Timothy's doing a full playthrough first before committing to the structural pieces - see the full Loot/gold/gear economy rework entry in the Quests / economy section below. The quest board's own "auto-grant + flying items + townsfolk NPC" visual polish (originally being brainstormed this same session) is paused, tangled up in whether the quest board survives this redesign in its current form.
- **Audio / sound** — full Web Audio engine (SFX + music crossfade + category volume/mute + theming) **shipped 2026-09-03 (0.20.0)**; **first real audio assets shipped 2026-09-10 (0.31.0)** — 21 clips covering the basic attack hit, all four ability swings, Faultline's own per-enemy impact, and a battle-start stinger, plus `SOUND_VARIANTS` rotation so a repeated sound doesn't replay one identical file. Still gated off by default behind the Settings "🚧 Feature Flags" → `audioBeta` checkbox. Still open: **only 7 of ~55 catalogued sounds have audio** (music generated but none picked; 4 sounds want CC0 curation not generation; `eliteEncounterSting`/`celebrationGeneric` have no candidates yet), **the shipped ability sounds are 1.0s and want re-rendering to 250-500ms** for combat that fast, Lacerate's 8 takes mix three styles and want narrowing to one, wiring the rest of the catalog into gameplay call sites (menu/dialog/potion/walking/parry/timing/discovery/elite/area-music — deliberately deferred past the first plan), additional themes (metal/symphony/chiptune — plumbing ready, no content), a `playMusic` re-entrancy fix needed before area-music transitions ship, and flipping the flag's default on only after Timothy's own playthrough with real sound. Generation/audition tooling lives in its own repo at `C:/Users/tim/git/emoji-rpg-audio` (see its `HANDOFF.md`). See the section below for full detail and doc pointers.
- ~~**Ability global-cooldown rework**~~ — **shipped 2026-09-03/04 (0.23.0, graduated per-ability cooldowns in 0.23.1)**, stale "not yet executed" note found while doing an unrelated backlog pass 2026-09-04. Removed the player ATB "swing timer" gate on abilities 1-4 in favor of a shared, speed-scaled global cooldown (Attack's own decay system, monster ATB, Super Scream, Lacerate's retrigger, and parry all left untouched, as planned). See `docs/superpowers/plans/2026-09-03-ability-gcd-rework.md` (spec: `docs/superpowers/specs/2026-09-03-ability-gcd-rework-design.md`) for the original design; same underlying idea as the "Slower combat / reconsider the timing-minigame layer" bullet in Combat pass ideas above.
- ~~**Bug raised 2026-09-03**~~ — **investigated 2026-09-07, confirmed not a bug.** An old save (level 11) shows far more smith-upgrade levels available than expected before max level. See "Bugs / open questions, raised 2026-09-03" below for the finding.
- ~~**Smith screen doesn't show the player's current NG+ cycle**~~ — **shipped 2026-09-07 (0.26.7)**, surfaced by the investigation above. Reuses the Stats panel's own `.ngplus-badge`. See "Bugs / open questions, raised 2026-09-03" below.
- ~~**"NEW MAX!" battle callout overlaps other text, hard to read**~~ — **shipped 2026-09-04 (0.24.5)**, alongside the broader damage-number-stacking fix it turned out to share a root cause with. See the Bugs / open questions section below.
- ~~**Portal graphic/trail overlap + instant teleport + sucking-in effect**~~ — **shipped 2026-09-06 (0.26.3)**, all three in one pass: full-size marker rendering + a real background glow fixed the trail-on-top bug and the "looks bad" complaint; a brief pull animation now plays before a portal action fires, instead of firing in the same tick as the step. The return-portal walk-off-and-back-on was left as-is - turned out to be existing designed behavior, not a bug. See BACKLOG_SHIPPED.md's Bugs section.

**New threads raised 2026-09-04, overnight session (0.25.0 shipped the
same-day items below; these are the ones left open):**
- ~~**Lacerate's retrigger window can drop if another ability is pressed in
  between**~~ — **investigated 2026-09-07, confirmed not a state bug.**
  "Seems like sometimes if I do another ability in between hitting 3 and
  hitting again for the timing then I don't get the buff." Explicitly
  deferred by Timothy at the time ("for after").

  Traced every path that touches `lacerateRetriggerOpen`
  (`js/screens/battleScreen.js`): it's only ever cleared by a successful
  re-press (`handleLacerateRetriggerPress`) or by real-time expiry in
  `tick()`. Pressing a different ability in between never clears it, and
  the digit-key handler, the mouse handler, and `playerUseAbility` all
  correctly check `retriggerWindowOpen` per-ability before falling back
  to the shared GCD - no state bug found. The actual mechanism: Lacerate's
  sweet spot (`js/systems/abilities.js`) is `sweetSpotStartPercent: 80` to
  `100` of a `windowMs: 1200` - i.e. only the *last 240ms* of the 1200ms
  window counts. Pressing another ability first burns exactly the
  reaction time there's no margin for. It's a genuinely tight, unforgiving
  timing window, not a bug - closed, no code change. If the "sometimes I
  don't get it" feel keeps coming up, widening the window or the
  sweet-spot percentage is the lever, not a fix.
- ~~**Ring slots (ring1/ring2) have no upgrade path at all**~~ —
  **shipped 2026-09-10 (0.28.0)**, alongside a lowered ring drop floor
  and a second Charm slot. See BACKLOG_SHIPPED.md's "Ring smith-
  upgrades, better ring drops, and a second Charm slot" entry.
- ~~**Make Lacerate's retrigger buff visually distinct from Super Scream's
  buff**~~ — **shipped 2026-09-07 (0.26.7)**. `activateBuff()`
  (`js/systems/abilities.js`) now tags the shared `buffState` with a
  `source`; the battle buff indicator swaps to Lacerate's own established
  red when that's the active source. Icon/color swap only, no new flavor
  text invented.
- **Battle group size should keep climbing further, and the battle
  window/monster-count cap should grow too** — "the more you kill
  enemies the more chances there are for them to come in packs" (i.e.
  `groupSpawnChance` scaling with total kills, not just NG+ cycle) "and
  also let's make battle window larger as well as bump up number that
  can show to like 8 after you have killed enough." Distinct from (and
  layered on top of) the per-species size ramp shipped this session
  (`killCountSizeCap`) - that ramp caps the roll, this is about raising
  `GROUP_SIZE_MAX_CAP`/`GROUP_SIZE_MAX_BASE` itself past today's ceiling
  of 6, plus the battle screen's own layout needing to actually fit that
  many monster zones. Not designed - needs both a balance pass (does 8
  monsters trivialize AoE abilities?) and a layout pass.
- ~~**Guardian HP bump needs a real tuning pass**~~ — **shipped 2026-09-05
  (0.25.1)**: Axe/Pick/Boat/Portal Guardians and the Dragon each got a
  real per-target-level stat pass (attack/defense too, not just HP),
  validated against a throwaway Monte Carlo script built on the real
  combat/abilities/parry functions and reconciled against Timothy's own
  telemetry first. See that version's CHANGELOG.md entry for the numbers
  and methodology (including a real finding: `scripts/simulate-balance.js`'s
  damage math is byte-identical to the shipped game, but its simulated
  player has zero reaction latency, making its own win-rate/HP-remaining
  output systematically optimistic vs. real play - worth remembering for
  any future tuning pass that leans on it).
- **"Everything feels pretty easy so far" (fresh telemetry through
  level ~14 / early NG+1, shared 2026-09-04)** — re-raises the same
  complaint as "The player outpaces near-town/far-corner content" below,
  already investigated 2026-09-02 and found to be a structural dead end
  (no static near-town monster stat block can be both safe at L1 and
  threatening at L9+). **Two concrete answers now exist, neither built
  yet** - see the two dedicated entries immediately below (distance-based
  wilderness scaling, and the special/super-boss pass) - rather than the
  dev-facing balance-config-layer/difficulty-presets route floated
  earlier, which is still valid but more speculative.
- **Distance-from-town wilderness difficulty rings — designed, on hold
  pending playtest, raised 2026-09-06.** Timothy, 2026-09-06: "Do we
  really need the difficulty rings after we did a tuning pass already?
  Maybe I need to play the game first. Then we get back on that." The
  guardian/dragon tuning pass (0.25.1) and the super-boss content pass
  (0.26.0) both landed since this was designed (2026-09-04/05) and may
  already have addressed what "everything feels too easy" was pointing
  at - don't build this next session; wait for Timothy to actually play
  a stretch of the current build and confirm the complaint still holds
  before picking this back up. Design below is unchanged/still valid if
  and when that happens. Full design agreed 2026-09-04/05 in a
  brainstorming session (not written up as a formal spec doc): wilderness
  monster stats scale
  by how far the player's current tile is from town's own fixed exit
  anchor (`center` screen, tile 14,12 - `TOWN_ENTRANCE` in
  `js/systems/world.js`), banded into rings (0-9 tiles baseline, 10-19,
  20-29, 30+), each ring multiplying whatever monster already spawns
  there rather than replacing the existing near-town/far-corner species
  split. Confirmed buildable with data already on `state` - no new field
  needed (`screenToGlobal`/`globalToScreen` in `js/systems/worldGrid.js`
  already do the local→global conversion; distance is Chebyshev/Euclidean
  between that and the town anchor's own global position). Only
  meaningful in the open wilderness cluster - town/dungeons are separate
  map clusters with no comparable distance. Explicitly **not** paired
  with any gold/gear/economy changes - Timothy deferred that whole
  thread ("let's hold off on changing any gold related/gear stuff for
  now"). First-pass multiplier curve floated in discussion (~x1.0 → x1.3
  → x1.6 → x2.0+ per ring) but never validated - needs the same
  simulator-plus-reconciliation treatment the guardian pass got before
  committing real numbers.

  **First live playtest data point, 2026-09-07:** Timothy, mid-
  playthrough: "even at level 5 it's far too easy to mow through the
  enemies on the way to the axe" - "I can provide log later too." This is
  the exact confirmation this thread was waiting on ("wait for Timothy to
  actually play... and confirm the complaint still holds"), and it's
  pointing at the near-town/early-game end specifically (not far-corner).
  Not enough on its own to restart design - wait for the fuller log he's
  planning to bring back before picking this back up, but worth flagging
  as the first real signal since the "hold" call was made.
- **Special/super-boss pass + map editor dungeon-drawing, raised
  2026-09-05 - the next thing to pick up.** "There is not much
  interesting in the world to try and fight besides the regular game" -
  wants ~10 hand-placed (not randomly spawned) optional super-bosses,
  each roughly a 3000+ HP wall requiring full best-in-slot gear, every
  potion, and real ability/parry play to clear, dropping loot better
  than anything currently in the game (today's best is Mythic-tier
  upgrades of existing gear - this implies a new tier or genuinely new
  unique items, not yet designed). Timothy wants to place these himself
  via `tools/terrain-painter/` once it's extended to support it - it
  already places the four tool-dungeon entrances (just used tonight to
  place the Portal Dungeon, 0.25.2) and paints existing dungeon
  interiors, but doesn't yet support (a) dropping a new kind of
  standalone "super-boss" encounter marker anywhere in the wilderness
  (distinct from the tool-guardian pattern - these aren't tied to a
  specific required tool), or (b) drawing brand-new named dungeon
  interiors from scratch for the bosses that should have one (some may
  be open-wilderness encounters, others gated behind their own small
  dungeon - Timothy's call per boss). Needs real design work before
  implementation: what "even better awesome loot" actually looks like
  (ties into the still-unresolved economy/itemization thread from
  2026-09-04, deliberately shelved that same session), the map-editor
  UI/data-model changes (a new entrance-marker type + dungeon-authoring
  workflow parallel to the existing tool-dungeon one), and the same
  Monte-Carlo-plus-telemetry-reconciliation tuning approach the guardian
  pass established for hitting a real "requires everything you've got"
  difficulty bar. Timothy is starting a fresh session for this rather
  than continuing here - see this repo's own session handoff/kickoff
  prompt for the fuller brief. **Design done, spec written** - see
  `docs/superpowers/specs/2026-09-05-superboss-pass-design.md`.
  **System + first worked example shipped 2026-09-05 (0.26.0):** the
  registry, tile kinds, dungeon-authoring tooling, special-attack system,
  and `apex` item tier all landed, plus `superBossOne` itself, hand-placed
  and tuned to `hp: 3000, attack: 55, defense: 24` (10% win rate/17% avg
  HP remaining/6.0 potions used for the maxed build - see CHANGELOG's
  0.26.0 entry for the full methodology). Only the first of ~10 planned
  bosses - the rest are future content on this same system. Four concrete
  follow-ups came out of the final whole-branch review before this shipped
  (raised 2026-09-05), captured as their own bullets below rather than
  blocking this branch on them:
  - **NG+1/NG+2 ceiling on `superBossOne`.** The maxed best-in-slot build
    (every slot Mythic+3, both superboss-only rings) cannot beat
    `superBossOne` once it's also NG+1/NG+2-scaled (0% win rate at both
    cycles per the simulator - see the in-code comment above
    `MONSTERS.superBossOne`). Confirmed as a pre-existing characteristic
    shared with the already-shipped Dragon tier 2, not a defect specific
    to this monster, and accepted for now per Timothy's own live guidance
    during this review pass: the real bar is "never one-shot despite best
    gear," not raw win-rate at NG+ - an "unbeatable for now" ceiling is
    fine, to be revisited via future chase-gear/itemization work rather
    than retuned away today. Same open thread as the existing "Boss tier /
    NG+ cycle ceiling" bullet further down (Multi-zone progression
    section) - worth deciding together whenever chase gear is designed.
  - ~~**Click-vs-keyboard parry timing asymmetry, sharpened by
    superbosses.**~~ **Investigated and fixed 2026-09-07 (0.26.7).** A jsdom
    repro found the real mechanism was narrower than this note's own
    framing: both paths already enforced the same zone check by default
    (`requireZone` defaults `true` either way) - the actual bug was that
    `resolveMonsterWindup` falls through to `monsterAttack()` on a *failed*
    zone check regardless of caller, but the keyboard path
    (`attemptParry`) only ever calls it after `resolveParryAttempt` has
    already passed, so a keyboard miss just leaves the wind-up alone to
    finish naturally. The per-monster ATB-bar/parry-hint click handlers
    called `resolveMonsterWindup` unconditionally, so a mistimed click
    forced that failed-zone-check branch (an immediate, unblocked hit) to
    fire right away instead. `attemptParryOnMonster()`
    (`js/screens/battleScreen.js`) now gives clicks the same
    pre-check-then-call shape as the keyboard path. Regression test in
    `tests/battleScreenDom.test.js`.
  - **Three of the four new superboss unique items are unassigned.**
    `parryMasterRing`, `unshakenCharm`, and `stormringOfHaste` (
    `js/data/items.js`) exist as an extensible drop pool - a deliberate
    design decision this pass, so future superbosses have ready-made
    guaranteed drops to assign - but only `ferocityFang` is actually wired
    to a monster's `dropTable` today, so the other three are currently
    unreachable in real play. Assign them to superbosses as more get
    authored.
  - **`stun` is unmodeled in `scripts/simulate-balance.js`'s superboss
    simulation.** Only `slow` and `cooldownOverload` are modeled in the
    simulator's superboss matchup path - a known, documented gap from when
    the simulator was extended to cover special attacks at all. Worth
    closing if a future superboss leans heavily on `stun` (as
    `superBossOne` itself does - 25% chance/turn), since today's win-rate
    numbers for any stun-heavy fight are measured without the simulator
    ever actually losing a turn to it.
- **Ring/charm idea backlog, raised 2026-09-05 in passing while approving
  the super-boss pass spec above** - three risk/reward accessory ideas,
  none designed yet, explicitly not part of the super-boss pass itself:
  (1) a ring that suppresses random wilderness/dungeon encounters entirely
  (pure convenience/QoL, no combat-balance angle to it) - **its
  composition with the worn-path encounter discount was designed
  2026-09-12** alongside that discount (see
  `docs/superpowers/specs/2026-09-12-worn-path-encounter-discount-
  design.md`'s "ring/charm question" section: they stack multiplicatively
  and don't replace the case for each other), but the ring itself
  (strength, drop source, NG+ gating) is still not scoped or built; (2) a ring that
  deliberately makes monsters harder (an opt-in difficulty-up accessory -
  presumably paired with better rewards for wearing it, which needs its
  own design rather than just a flat downside); (3) a ring/charm that
  raises loot-drop chance/quality odds directly (would touch
  `js/systems/itemQuality.js`/`js/systems/loot.js` - the same files the
  super-boss pass's new tier and the Mythic drop-rate rework above land
  in, so this should be designed *after* those two ship and reconcile
  against whatever rates they settle on, not compound blindly on top of
  today's numbers).
- **A second shop-purchasable ring, beyond Power Ring, raised 2026-09-10
  in passing while shipping ring upgrades/better ring drops (0.28.0).**
  Power Ring (`js/data/items.js`) is still the only ring in
  `SHOP_CATALOG`, and every other equipment slot has a Cloth→Iron shop
  progression (e.g. `clothTunic`→`ironArmor`) that rings never got - just
  the one 40g/+2 attack item. Deliberately left out of the 0.28.0 pass to
  keep it scoped to the upgrade-path/drop-floor/charm-slot asks actually
  made; also worth noting while designing one: Power Ring's own
  price-to-stat ratio (40g for +2 attack) is already worse than
  `ironSword`'s launch pricing (30g for +6 attack), so a new "iron-tier"
  ring should probably not just extrapolate from Power Ring's numbers
  without a second look at those too.
- ~~**Micro-pause once per step while walking, raised 2026-09-10.**~~ —
  **mostly fixed 2026-09-10 (0.32.2).** Two clocks disagreeing: steps
  fired on a `setInterval` while the hero's stride advanced on
  animation-frame deltas, and a timer is a floor rather than a target
  (never early, usually a few ms late), so the stride finished first and
  the hero stood still waiting. Steps now accumulate frame time, so both
  cross their thresholds on the same frame. Frozen frames 1.5% → 0.5%,
  spread of per-frame movement 0.17 → 0.07. **A small residual remained,
  and was fixed in turn by 0.32.4 — see "Residual walk micro-stutter"
  below, including why that entry's own diagnosis was wrong.**
  - Worth carrying forward as a method, not just a fix: the candidates
    were **simulated before one was picked**, and the measurement
    overturned the plan. `computeHeroStep` is exported, so 20s of
    held-key walking against realistic timer jitter can be replayed
    offline in a few seconds. Exponential smoothing scored *best* on
    frozen frames but far worst on movement spread (1.32 against 0.07) —
    it avoids freezing by lurching, which is its own stutter, and the
    obvious single metric would have shipped it. Do this again before
    optimising anything in this loop.
- **Delete the DOM map renderer scaffolding, raised 2026-09-10.** See
  the "Delete the DOM map renderer scaffolding" section below.
- ~~**Residual walk micro-stutter, raised 2026-09-10.**~~ — **fixed
  2026-09-10 (0.32.4).** It was not the two-rAF-loops thing this entry
  used to blame, and merging those loops was measured and found to buy
  nothing. The camera was a third clock: it aimed at the hero's logical
  tile, so it surged and crawled between steps while the hero's stride
  ran at constant speed. See the section below.
- **Hero draws over obstacles in the row below, raised 2026-09-10.** A
  deliberate tradeoff taken to stop the character being sliced in half;
  see the section below.
- ~~**Map render performance, raised 2026-09-09.**~~ — **canvas rewrite
  shipped 2026-09-10 (0.29.0)**, with the movement/feel follow-ups in
  0.32.0 and 0.32.2. The map's tile rendering (only that — HUD, battle
  and overlays stayed DOM/CSS) now draws to a single `<canvas>` from a
  pure draw list (`js/systems/mapDrawList.js`), painted by
  `js/screens/mapCanvasRenderer.js`. See BACKLOG_SHIPPED.md's "Map
  render performance / canvas map renderer" section for the full
  investigation and elimination log. **Two follow-ups from it are still
  open — see "Delete the DOM map renderer scaffolding" and "Hero draws
  over obstacles in the row below" below.**
- ~~**Boat proximity-hint text said "clear" the water, which doesn't make
  sense for a boat**~~ — **shipped 2026-09-09 (0.26.14)**. See the fuller
  entry in the Bugs / open questions section below.
- **Player's own marker renders at guardian-boss size (2.2x) when
  standing on a guardian tile, raised 2026-09-09** — one-line fix
  identified (`js/screens/mapScreen.js:681` needs an `&& !isPlayer`
  guard) but not applied, same reason as the dev-server bug below
  (file has active uncommitted changes elsewhere). See the Bugs section.
- ~~**`resolveStaticFilePath` (tools/dev-server.mjs) fails its own
  path-traversal check on Windows, raised 2026-09-09**~~ — **fixed
  2026-09-09** (`rootDir` is now normalized before the `startsWith`
  check, exactly as this entry's own earlier fix-identified note
  described). `npm run test` is fully green (1031/1031). See the Bugs
  section below for the original diagnosis.
- ~~**Cross-device save sync, raised and built 2026-09-09**~~ **Shipped
  2026-09-09 (0.27.0, follow-up in 0.27.2)** — one-shot 60-second
  transfer codes (Cloudflare Workers KV, rate-limited), loading a code
  adds a new character slot rather than overwriting anything. Google
  Sign-In was scaffolded then deliberately removed the same session.
  0.27.2 added the same import flow to Character Select itself (no need
  to start a throwaway character first) and same-character detection via
  a new `characterId` (offers to overwrite in place instead of always
  duplicating). See the dedicated section near the end of this file for
  the full history.

**New threads raised 2026-09-10:**
- ~~**`battleSpecialAttacks.test.js` flakes under parallel load.**~~
  **Shipped 2026-09-12.** Raised 2026-09-10; flaked again the same way on
  2026-09-12 (timed out at 20.3s, just past the 20000ms deadline a prior
  fix, 8e74e53, had raised it to) - confirming the earlier fix only
  bought margin rather than removing the race. Rewrote the whole file
  onto `node:test`'s built-in `t.mock.timers` (`setInterval`/`setTimeout`/
  `Date`), so `battleScreen.js`'s real `setInterval(tick, 300)` only ever
  fires when the test explicitly advances a fake clock - no real
  waiting, no CI-load dependency. `battleScreen.js` itself is unchanged.
  Runtime dropped from 20-40+ real seconds to well under 1 second.
  Surfaced one genuine, unrelated hazard along the way (not a mock-timer
  bug): with the fake clock reliably driving the monster through
  multiple attack turns per test, an occasional critical hit for exactly
  the player's starting 20 HP could end the battle mid-assertion -
  fixed by giving the player effectively unkillable HP in this file's
  fixtures, since these tests are about whether a special-attack effect
  lands, not survival odds. `tests/battleScreenDom.test.js` had its own,
  separate real-wall-clock timing tests (89 subtests, 42+ of the suite's
  ~43 real seconds) - converted the same day in a follow-up pass (see the
  next entry below) once this file's own conversion proved the approach
  out.
- **`tests/battleScreenDom.test.js` converted to `t.mock.timers` too,
  same day.** 42+s -> ~9s. Six Lacerate-retrigger-window subtests
  deliberately left on real timers - that mechanism reads
  `performance.now()`, not `Date.now()`, and `mock.timers` has no
  `performance` entry in its supported apis on this Node version
  (confirmed by direct experiment: `enable({apis:['performance']})`
  throws `ERR_INVALID_ARG_VALUE`). Landed via a PR
  (`test/battle-screen-dom-fake-timers`) rather than straight to `main`,
  specifically so the suite could be re-run repeatedly against GitHub's
  own runner - the actual environment this class of flake shows up in,
  not a local machine - before merging; see the new
  `.github/workflows/test.yml` (tests-only, no deploy, `pull_request`-
  triggered) added alongside it for exactly that.
- **The suite's last two real-wall-clock waits converted too, same
  day** (`tests/celebrationEffect.test.js`, `tests/mapScreenDom.test.js`
  - simple single `setTimeout` calls, no `Date.now()`/chaining
  complexity). Doesn't move the full suite's wall-clock time - both
  waits were already shorter than `battleScreenDom.test.js`'s own
  runtime under `node --test`'s file-level concurrency, so they were
  already hidden behind it - but removes their own residual flake risk.
  The suite's real remaining bottleneck is unchanged: the six Lacerate
  `performance.now()`-based tests, ~7.6s of the ~9-10s total. Fixing
  that for real means either changing `lacerateRetriggerStartedAt`
  (`js/screens/battleScreen.js`) from `performance.now()` to
  `Date.now()` (a real, if probably safe, production-code clock-source
  change - not done without discussing it first) or hand-rolling a
  second fake clock just for `performance.now()` in tests only. Neither
  attempted yet - raised, not started.
- **Worn-path trail costs a full repaint every frame, raised 2026-09-10
  (after 0.32.4).** Timothy: "when I make the window really really big
  and walk around I get frame drops ... when I walk away from an area
  with no paths then performance back to top speed fps." Measured, not
  inferred: at a maximised window with fully-walked ground the map costs
  **7.70ms/frame of JS and 46,668 canvas ops**, against 0.76ms/3,537 ops
  on unwalked ground — the trail is ~92% of all draw calls, and window
  area multiplies it. 7.70ms is 46% of a frame budget *before* the
  browser rasterises any of it. Cause: `frame()` rebuilds and repaints
  the whole draw list every frame, including every trail stroke, for
  content that only changes when the player steps on a tile. Fix is a
  static-layer offscreen cache — but the cut is static-vs-animated, NOT
  floor-vs-sprite, because paint order is per-cell interleaved (see the
  plan for why the naive split changes obstacle overlap and trail ends).
  Full measurements, the design, the invalidation scheme and the traps
  are in `docs/superpowers/plans/2026-09-10-static-layer-cache-plan.md`.
  Not started. Pre-existing, not caused by 0.32.4.
- ~~**Battle screen overflows on big group encounters**~~ — **shipped
  2026-09-10 (0.30.0)**. The card's vmin scale ramp is now capped by a
  measured fit-to-viewport factor, so a wrapped monster grid scales down
  instead of pushing the action bar off screen. See BACKLOG_SHIPPED.md.
- ~~**Instant-resolve (no fight dialog) only fires on very weak solo
  mobs**~~ — **shipped 2026-09-10 (0.30.0)**. Groups now qualify too,
  when every monster in them is outclassed. See BACKLOG_SHIPPED.md.
- **Faultline's chain blocks every other input while it resolves** —
  you can't act until the sweep has finished walking the whole enemy
  row. See the "Faultline's sweep locks out other abilities" section
  below. Not started.
- **Watch whether 20s buff potions stack too hard** — duration went
  12s → 20s in 0.27.4. Since different potions stack, a two- or
  three-potion opening now comfortably spans a whole fight rather than
  only overlapping part of it. Flagged at the time as the thing to watch
  after playing it. If it reads as too strong the knob is the bonus
  magnitudes in `js/data/items.js`, **not** the duration — walking the
  duration back re-creates the original complaint (a paid, consumed
  potion buying no more uptime than the free, cooldown-gated Super
  Scream buff). Not investigated; needs play time, not analysis.
- **Internal-only changes are forced to invent a player-facing
  changelog line** — `tests/versionSync.test.js` requires the newest
  dated `CHANGELOG.md` version to have a matching
  `PLAYER_CHANGELOG[0]` entry, and the deploy workflow requires any
  non-doc change to be bumped out of `## [Unreleased]`. "Non-doc" is
  `grep -v '\.md$'`, so a test-only or tooling change trips both — but
  `CLAUDE.md`'s own step 3 says to skip internal-only changes in the
  player changelog. The rules collide, and 0.32.1 (a test-hardening
  fix) had to ship a player-facing line describing an internal
  problem. Note `js/data/playerChangelog.js` is itself non-doc, so
  even *correcting* such a line needs its own version bump and deploy.
  Options if it becomes annoying: let the version-sync check accept an
  explicitly-marked internal entry, or treat `tests/**` as doc-like in
  the workflow's non-doc filter. Not urgent — it has cost one awkward
  entry, not a broken deploy.

**New threads raised 2026-09-12:**
- **Canvas map rendering is soft at non-100% browser zoom, raised
  2026-09-12** while chasing the dpr-resync bug below. Timothy, after
  confirming that fix worked: "it all gets better again if I go back to
  default 100% browser zoom size" - the softness reappears at any other
  zoom level and clears instantly on its own once back at 100%, with no
  refresh needed, which rules out a caching bug (that variant is the one
  just fixed - see 0.33.2 in CHANGELOG.md). This looks like the ordinary,
  near-universal canvas-rendering characteristic: at a fractional device
  pixel ratio, tile edges and glyphs land on fractional device pixels and
  the browser blends rather than draws them crisply; 100% zoom (or any
  other zoom landing back on a whole-pixel ratio) has nothing to blend.
  Properly addressing it would mean snapping every draw position to a
  whole device pixel at arbitrary zoom levels - a materially bigger,
  more invasive change than the resync fix, and arguably chasing a
  limitation most canvas-based tile renderers just have. Not started;
  not diagnosed further than the theory above.
- **Boss/guardian-marker tile shows a black square background, sized
  like an ordinary tile instead of the 4x guardian size, raised
  2026-09-12** with a screenshot (a snake-emoji marker on a plain dark
  square). Not yet investigated - unclear if this is `TILES.guardian`
  itself misbehaving for a specific monster, a different marker tile
  entirely, or something save/debug-character-specific. Timothy: "this
  dragon should not have a background and be 4x the size like the tool
  bosses."
- **Horizontal line artifact two tiles below the player, raised
  2026-09-12** with a screenshot (a thin seam across the worn-path
  trail). Timothy's own hunch: "I think the horizontal line is related
  to the cache issue" (the static-layer cache from 0.33.0) - plausible
  given the cache's patch/scroll code works in tile-row strips, but not
  yet investigated.
- ~~**Worn paths could reduce encounter chance over time.**~~ **Shipped
  2026-09-12.** Raised same-day; designed as a live collaboration (see
  `docs/superpowers/specs/2026-09-12-worn-path-encounter-discount-
  design.md`) rather than handed down as a spec. Discount matches the
  visual trail-wear curve exactly (Timothy: "matches the visual
  indicator exactly"), capped at 50% off per tile, no per-screen
  aggregate cap, no NG+ tempering - all explicit calls, not oversights.
  On by default with a Settings opt-out, plus a one-time hint banner
  using Timothy's own wording. See CHANGELOG.
  - **Parked, not built: limiting the discount to one "core route" per
    screen** instead of a flat per-tile cap - Timothy floated this live
    then deferred it ("I can always change/tweak/tune later"). Revisit
    only if the flat per-tile cap turns out to feel too generous once a
    screen gets fully paved.
  - **Parked, not built: a ring/charm that suppresses random
    encounters** - designed alongside the worn-path discount in the
    same spec doc (composes multiplicatively, doesn't replace the case
    for the per-tile discount) but not scoped or implemented this
    round. See the Multi-zone progression section's own bullet for
    this, and the spec doc's "ring/charm question" section for the
    reasoning.

## Story / narrative

### The game needs an actual story
Right now there's no real narrative — just mechanics (town, dungeon,
boss tiers, NG+). Timothy wants a story layer but **wants to write the
narrative content himself, not have it AI-generated** — this is
explicit and important: don't draft plot, lore, dialogue, or NPC
writing unprompted. Implementation support (wiring whatever text he
writes into dialogue screens, quest text, flavor lines, etc.) is fair
game once there's something to wire up — the boundary is authorship of
the words, not the engineering around them.

## Pacing / progression

*(First-kill and level-up celebrations shipped 2026-08-17 — see
CHANGELOG. Both fire from a new shared, screen-independent celebration
effect: `js/screens/celebrationEffect.js`. The "Fun animation for items
landing in inventory" idea from this section has since shipped too —
see BACKLOG_SHIPPED.md.)*

### Early-game pace ramps up too fast; the dragon fell quickly
Timothy's read: the early game *felt* good — genuinely hard, then you
visibly get stronger — but the ramp accelerates too fast and he had the
dragon down quickly. Worth noting: `docs/superpowers/specs/2026-08-16-
player-growth-curve-design.md` already reworked the curve, but
specifically to fix *post-level-10* trivialization (tapering stat gains
starting at level 10) — it deliberately left levels 1-9 untouched,
reasoning "already tuned, nobody complained about it." This is new
feedback that may reopen that boundary, or may be a different axis
entirely (time/levels-to-reach-the-dragon, not per-level power vs. a
fixed monster).

**Update (2026-08-17):** Timothy separately reported a fresh new game
feeling like "can't actually beat any guys until you die a few times" —
possibly the opposite complaint (too hard at the very start) rather
than too easy. Investigated with `scripts/simulate-balance.js` (which
this session also fixed to share its combat math directly with
`js/systems/combat.js` instead of a hand-rolled, drifted copy — see
CHANGELOG). Real numbers for a level-1 character with the one armor
piece the starting 20g affords, 3000 trials each: boar 100% win (57%
HP left avg), bat 100% (54%), snake 97% (39%), goblin 100% (54%). Every
near-town matchup in isolation is genuinely winnable.

The simulator only tests fights **in isolation** — full HP and full
potions every trial. Real play doesn't work that way: HP/potions carry
over fight to fight until a town trip (winning doesn't heal; the only
free out-of-combat heal is the town well added earlier this session),
so a string of several 97%-favorable fights back to back can plausibly
compound into real death risk even though no single matchup is unfair.
**Resolved (2026-08-17):** confirmed directly — Timothy's first
playthrough skipped armor entirely and leaned on potions. Added a new
"no armor" baseline build to the simulator and re-ran it: 0-5% win rate
against every near-town monster with zero armor, vs. 97-100% with the
one 20g cloth piece the starting gold affords. Not a gradual curve — a
cliff, and an *intentional* one (the savage-early-game design doc says
outright "buying at least minimal armor stops being optional"). The
gap was never the numbers, it was that the game never told the player
this before they found out the hard way.

Fixed with a first-visit town banner (`js/data/flavorText.js`'s new
`town` key) that doesn't push armor as the only good choice — Timothy
was explicit that potions-only is a fine playstyle — but sets honest
expectations: expect to die a few times figuring it out, and a loss
just sends you home to rest (full HP, no real penalty), not to ruin.
The dragon-fell-quickly half of this item (the very first paragraph
above) is still open — that's a different axis (late-game pace, not
first-fight difficulty) and wasn't part of what got resolved here.

**Update (2026-08-23):** a direct lever pulled on the levels-1-9 boundary
this note flagged as never revisited — `xpForLevel`'s base coefficient
went 12→48 (4x slower leveling at every level, on top of the earlier
10→12 balance-pass bump), raised alongside the same session's Attack
rebalance ("holding down attack" feeling too strong). Not marked resolved
yet — this is the mechanism, not confirmation the pacing now *feels*
right; needs real playthrough data same as the armor-cliff half of this
item did before it got marked resolved above.

**Update (2026-08-28):** Timothy: "Level 4 is a huge boost of power so I
think our area away from town need to get quite a bit harder. You should
still feel strong and battles go quicker but once I hit level 4 I got
real strong quick." Read carefully, this pulls in a different direction
than the standing "zone 1 should keep getting easier over time, not
track the player" call (see "The player outpaces near-town/far-corner
content" thread, Combat pass ideas section below) — that call was
specifically about *not* scaling regular monster stats to match the
player. This new note isn't asking for monster scaling, though; it reads
more like farther-from-town content should simply be tuned harder at its
own fixed difficulty, independent of the player's level — which is
compatible with, and could be the same lever as, the already-open
"spatial difficulty gradient" idea (Multi-zone progression, below:
harder named monster variants the further from town). Not investigated
yet whether level 4 specifically is the real inflection point or just
where Timothy happened to notice it — worth checking against
`docs/superpowers/specs/2026-08-16-player-growth-curve-design.md`'s
levels-1-9 numbers directly.

**Update (2026-08-28), fresh dragon data point:** Timothy: "I beat the
dragon at level 12 which actually seems okay level wise but even the
3-star dragon was too easy. I think I got the mining pick at level 10
or so and canoe at 11 if that helps with anything. It's really the gear
which makes you super strong I think." So: level-12 dragon kill reads
as roughly the right pacing target, but even the escalated 3-star boss
tier (`js/systems/bossTiers.js`) wasn't a real threat at that point —
and Timothy's own read is that equipment/gear power, not character
level itself, is the likely driver. Ties directly into the still-open
"defense scaling needs work... might tie into our other scaling work"
note in the Combat pass ideas section below — worth investigating
gear's contribution to effective power (via the balance simulator,
same tool used earlier in this thread) rather than treating this as a
level-curve problem specifically.

**Update (2026-09-04), overall difficulty still open after the ability
GCD rework + per-ability cooldowns:** Timothy's own words: "the game
needs to get way harder. I kind of like how hard it is at level 1... but
then you get way too strong. However I still have not tried it with
ability cooldowns so that needs to go up." He hasn't yet played the
0.23.1/0.23.2 changes shipped this same session (graduated per-ability
cooldowns, the 5% ATB-knockback-chance change) - explicitly wants to do
a fresh playthrough on the new build before deciding whether this is
still open or was already meaningfully addressed. His own play log from
this session (pre-0.23.1) confirmed the shape of the complaint precisely:
genuinely dangerous at level 1 (two real deaths), then from level 4 on -
once a full ability rotation plus stacked smith upgrades kicked in -
essentially risk-free for the rest of the session (dozens of straight
100%-HP wins, including 5-monster group fights, 4-8 second fight
durations). Explicitly deferred, not tackled same-session - revisit once
the fresh playthrough happens. Also connects to the still-open "partial
walk-back of the upgrade-level uncap" item above (Multi-zone progression
section) - unlimited smith upgrades are plausibly part of the same
"too strong too fast" complaint.

## Multi-zone progression (big idea — needs its own design pass)

Several related ideas raised together about giving zones 2/3/4 distinct
identities instead of "more of zone 1, but harder." This is bigger than
a quick backlog item — flagging the shape of it now so it's not lost,
but it should get a real design doc before implementation, not a
one-off task.

- **Each new zone is allowed to be a partial gear-check reset.** Explicit
  permission from Timothy: it's fine if reaching zone 2 requires more
  zone-1 grinding even after beating the first boss — a new zone doesn't
  have to be immediately viable the moment its gate unlocks.
- **A spatial difficulty gradient — harder enemies the further from town /
  closer to the dragon, raised 2026-08-22.** Timothy, referencing Dragon
  Warrior's own map design as the inspiration: distance from town (or
  progress toward the dungeon/dragon) should itself gate difficulty, so
  gearing/leveling is required to keep pushing outward rather than every
  screen being equally approachable once you've cleared the nearest one.
  Concretely floated: named tiers like "level 1, level 2" enemies rather
  than the current flat roster. This is a *fixed spatial* gradient (tougher
  monsters live further out, always), not monsters scaling to match the
  player's own level — compatible with the standing "zone 1 should keep
  getting easier over time, not track the player" call in "The player
  outpaces near-town/far-corner content" thread further below, since
  nothing here makes any single screen's monsters get harder as you level.
  Natural implementation hook: named stat variants per monster type
  (Combat pass ideas — shipped 2026-08-23, see BACKLOG_SHIPPED.md; ~5
  named variants per monster with distinct stats) is exactly the
  mechanism this would need — variants could be distributed by
  distance-from-town instead of purely at random. Needs its own design
  pass alongside the rest of this zone-identity work — not ready to spec
  yet (how "distance" is measured — screen-grid position? a new explicit
  tier per wilderness ring? — is undecided), captured here as the raw
  idea only.
- **Zones shouldn't share the same gameplay loop.** Wants variety
  zone-to-zone: puzzle-solving, a labyrinth, new abilities/mechanics,
  other metroidvania-style ideas beyond straight combat — not just a
  reskinned wilderness grid with tougher numbers.
- **Zone identity candidate, raised 2026-08-18: healing/redeeming
  enemies instead of killing them.** Timothy's own pitch — "something
  really unique that ties into the story like you actually heal enemies
  and save them and turn them nice." Explicitly not ready to design yet
  (zone 2's overall identity isn't decided), and this ties directly into
  the story layer Timothy has reserved to write himself (see "The game
  needs an actual story" above) — captured as the raw idea only, no
  mechanic details or narrative framing invented here. Revisit once zone
  2's identity is actually being designed.
  - **Mechanic shape, added 2026-08-18 (Timothy's own words):** track
    every distinct enemy type killed in zone 1; in zone 2, walking around
    is how you heal them back to full, one by one. As more get healed,
    more of the zone 2 map opens up, letting you venture further to find
    the remaining mob types still needing healing. Still gated on zone
    2's overall identity/design pass before implementation — captured
    here as mechanic shape only, no narrative/dialogue invented.
- **Zone unlocks gated by tools earned from boss kills.** Builds directly
  on the tool-gating system already shipped
  (`docs/superpowers/specs/2026-08-16-metroidvania-tool-gating-design.md`
  — mining pick and axe, dropped by dungeon-tier monsters, currently
  unlock shortcuts/loot *within* the single existing 9-screen wilderness
  grid). That doc explicitly scoped out "any new map screens, zones, or
  terrain features" — this idea is the natural next step past that
  scope: new tools (or the existing ones) unlocking entirely new zones
  after a boss kill, not just backtracking loot in the current one.
  - **Concrete drop idea, raised 2026-08-24: the dragon drops something
    (Timothy floated a diamond) that unlocks the gate into zone 2.**
    Directly slots into the bullet above — a specific item, specific
    source (the dragon kill itself, zone 1's own final boss), specific
    purpose (the zone 2 gate). Not implemented — there's no zone 2 gate
    mechanic to unlock yet, and adding the item alone would just be
    inert inventory clutter until that exists. Revisit once zone 2's
    own design pass produces an actual gate to key it to.
  - **How should NG+ strength carry into a new zone, raised 2026-08-28?**
    Timothy: "I am wondering if we can save a state when someone does
    NG+ so they can go back to pre NG+ so that when they go to zone 2
    they go back to pre NG+ character so they are not too strong. Or
    maybe when going to a new zone you just revert or something. Not
    sure how to handle it. Or we scale all future zones to NG+ state.
    Not sure. But let's put this in backlog to figure out." Three
    distinct directions floated, none decided: (a) snapshot/restore a
    pre-NG+ character state so entering zone 2 reverts the player to it
    (so zone 2 isn't trivialized by NG+-boosted stats/gear), (b) some
    other automatic revert-on-new-zone mechanic, or (c) don't revert
    anything — instead tune zone 2+ difficulty to assume an NG+-strength
    character from the start. Directly entangled with the still-open
    "each new zone is allowed to be a partial gear-check reset" bullet
    above and the "spatial difficulty gradient" idea above — worth
    deciding together with those once zone 2's own design pass happens,
    not in isolation. No mechanism exists today for snapshotting
    pre-NG+ state at all (`js/systems/ngPlus.js`'s `resetWorldForNgPlus`
    only ever resets forward, never stores what it overwrote).
    - **Restated and extended, 2026-09-01, still the same three
      undecided directions above plus two genuinely new pieces:**
      Timothy, thinking out loud: NG+ should "keep going" as an ongoing
      concept rather than a one-off; he still likes the idea of
      resetting/reverting before zone 2 so you have to earn zone 2 the
      way you earned zone 1, unless the rest of the game just scales to
      NG+ instead, or — as the game grows past zone 1 — "NG+" itself
      comes to mean having finished the *whole* game once, not just
      zone 1's dragon. New: he does like the idea of **each zone having
      its own NG+** (rather than one global NG+ cycle spanning every
      zone). Also new, and a real divergence from this section's own
      framing so far (which has generally assumed zone 2 is new map
      screens with its own identity): zone 2 might not be new screens
      at all — "it's just an extension of existing map and maybe
      changes to existing map like mountains move, new stream appears,
      need an updated canoe, stronger axe, etc." — i.e. zone 2 as zone
      1's *same* map reshaped/escalated, with upgraded versions of the
      existing tools required to cross the changed terrain, rather than
      a separate zone-2 map+tool set. None of this is decided — still
      needs the "own design pass" this whole section has always been
      waiting on, now with more shape to work from.
  - ~~**NG+ doesn't reset the player's tools.**~~ **Shipped 2026-08-29 —
    see BACKLOG_SHIPPED.md.** `resetWorldForNgPlus` now strips tool items
    and resets `clearedGates` each cycle, plus a one-time migration for
    saves already mid-cycle.
  - ~~**NG+ loot ceiling — the hard upgrade-level/cycle cap.**~~ **Shipped
    2026-09-01 (0.16.3) — see BACKLOG_SHIPPED.md.** `MAX_NG_PLUS_CYCLE`
    and `MAX_UPGRADE_LEVEL` are no longer enforced; both climb forever.
    Deliberately the narrowest fix, not the item-design pass below - kept
    open for exactly that reason.
  - ~~**Partial walk-back of the upgrade-level uncap above, raised
    2026-09-04.**~~ **Shipped 2026-09-04 (0.24.2).** Timothy played a
    fresh NG+0 save through to level 9 and was surprised `ironSword` had
    climbed to upgrade level 8 (`newLevel:8` in his own play-log
    telemetry) - he remembered the old pre-NG+ cap (`MAX_UPGRADE_LEVEL =
    3`, no longer enforced per the entry directly above) and wanted it
    back, specifically a real cap on upgrade level that rises with NG+
    cycle rather than staying flat forever. Landed as
    `getMaxUpgradeLevel(ngPlusCycle)` in `js/systems/inventory.js` — 3 at
    NG+0, `+UPGRADE_CAP_STEP_PER_CYCLE` (2) per cycle after that —
    enforced in `upgradeItem`, with `smithScreen.js` disabling and
    labeling the maxed slot. Applies prospectively only: an existing save
    already above the new cap (like Timothy's own `ironSword +8`) keeps
    its level, it just can't climb further until the cap rises on the
    next NG+ transition. The interaction with `tier` (fine/superior/
    mythic) upgrade paths needed no extra work — `upgradeKey` already
    tracks upgrade level per itemId+tier, so the cap is checked and
    enforced against whichever tier is actually equipped.
  - **NG+ loot still feels stale without new/better *items*, just numbers
    now — the item-design half of the above, still not done.** Same
    underlying gap as "Should the dragon drop better items in NG+?" just
    below: today's drop tables, quality tiers, and unique-effect items are
    completely unchanged by the 2026-09-01 uncap - only how high a smith
    can push a given item's level, and how many NG+ cycles exist, changed.
    Timothy's own call 2026-09-01: start with the plain numeric uncap
    alone and only invest in new/better items if the endless upgrade climb
    on its own turns out boring. Revisit this bullet if/when that happens.
  - **Should the dragon drop better items in NG+? Raised 2026-08-29.**
    Timothy: "can we make the dragon drop better items in NG+?"
    `scaleDropTable` (`js/systems/ngPlus.js`) already scales
    non-tool drop *chances* up per NG+ cycle
    (`NG_PLUS_DROP_CHANCE_MULTIPLIER`), but doesn't change *which*
    tiers/items are in the table at all — so this would need either new,
    higher-tier loot table entries gated to NG+ cycles, or some other
    tier-boosting mechanism, neither of which exists today. Not
    designed.
  - **NG+ monsters could appear "out of place," raised 2026-08-29.**
    Timothy's own words: "maybe in NG+ monsters start appearing from the
    wrong places. Like dragon out of nowhere in a random fight or
    something like that." A wilderness/dungeon random encounter today
    always rolls from that screen's own fixed `monsterTable`
    (`js/screens/mapScreen.js`'s `tryMove`) — there's no path for a
    boss-tier monster (or any monster from a different tier/zone) to show
    up in a regular encounter roll at all, in NG+ or otherwise. Explicitly
    floated as a backlog idea, not for now. Raw idea only — not designed:
    which monsters could appear where, how rare it'd be, whether it scales
    with NG+ cycle, and how a felt-appropriately-terrifying "the dragon
    just showed up in a random field encounter" moment would even resolve
    (a real fight? an instant flee prompt? guaranteed-loss with an escape?).
  - **Boss tier / NG+ cycle ceiling, raised 2026-08-30.** Timothy hit the
    top of both escalation dials at once - `MAX_BOSS_TIER = 2`
    (`js/systems/bossTiers.js`, three "star" difficulties per cycle) and
    `MAX_NG_PLUS_CYCLE = 2` (`js/systems/ngPlus.js`) - and asked whether
    the boss fight starting immediately instead of showing the
    tier/NG+ choice prompt was a bug. It isn't:
    `shouldPromptForRematch`/`canStartNgPlus` correctly have nothing left
    to offer once both caps are maxed, so `handleBossBattle`
    (`js/main.js`) skips straight to the fight. Confirmed as the intended
    end-state for now - "I think we are good with this ceiling for now" -
    but flagged as something to revisit later (raise either cap further)
    once there's a reason to. Not designed, not scheduled.
  - ~~**Mythic gear tier's headroom is real but not enough at NG+2
    hard-tier monsters — measured, 2026-08-30, needed a retune
    decision.**~~ **Resolved 2026-08-31 (0.12.2) — see BACKLOG_SHIPPED.md.**
    The simulator's missing-2-of-7-slots confound is fixed and
    `QUALITY_TIER_MULTIPLIERS.mythic` moved 1.35 → 1.5.
  - **The real goal is "feel powerful by the end of NG+2," and a
    multiplier alone doesn't get there — raised 2026-08-31, still open.**
    Timothy, walking through his own playthrough arc: slow start (fine),
    picked up fast once abilities landed (felt a little too strong), NG+
    still felt strong, but by the end of NG+2 he "wasn't quite as strong
    as I wanted and enemies took longer than I wanted" - his actual bar is
    fights resolving in 2-3 hits, sometimes a one-shot, not a competent
    win. Explicitly: "we don't need to go wild with tuning right now."
    Checked against the resolved item just above with a throwaway
    hits-to-kill probe (not committed - an always-Attack policy, cruder
    than the real ability-rotation policy `scripts/simulate-balance.js`
    actually uses): even pushing the mythic multiplier all the way to
    3.0x (double the shipped 1.5) only brought average hits-to-kill on
    NG+2 hard-tier monsters down from ~33 to ~9-11, nowhere near 2-3. A
    flat tier-multiplier is the wrong lever for this specific ask - it
    moves win-margin/HP-left a lot (which is what closed the item above)
    but barely dents hit-count, because attack streak decay, ability
    cooldowns, and monster HP pools all bound how fast a kill can happen
    regardless of raw attack stat. Getting to "2-3 hits, sometimes a
    1-shot" by end-of-NG+2 needs its own design pass with a real lever in
    mind - candidates nobody's picked yet: a late-NG+-cycle player-power
    multiplier separate from gear tiers, an execute/overkill mechanic
    past some HP threshold, trimming monster HP scaling at high NG+
    instead of only ever raising it, or armor-piercing crits. Ties
    directly into the still-open "research: how do other games avoid pure
    exponential stat inflation" idea in Combat pass ideas below - same
    underlying question, now with a concrete target number attached.
  - **Increase axe/pick/canoe drop chance from regular mobs as the NG+
    cycle climbs, raised 2026-08-31.** Timothy's own words: "maybe we
    could extend NG+ and/or starting with NG+ and moving through NG+2, 3
    and so on there is more and more of a chance of getting the axe,
    pick, canoe from mobs or somewhere else then the defined locations on
    the map to spice things up so folks can move through it quicker."
    Today tools only ever come from their one fixed guardian per
    playthrough cycle (see the shipped "tool-dungeon guardian drops
    undermine the 'no chance, find it' design intent" fix in
    BACKLOG_SHIPPED.md, which deliberately went the other direction -
    removed stray chance-drops so tools stayed guardian-only). This asks
    for that to loosen specifically at higher NG+ cycles, once a player
    has already proven they can do the guardian-hunt the intended way
    once - a returning-player convenience, not a change to a first
    playthrough. Raw idea, not designed: what chance curve, whether it's
    per-monster-kill or a distinct drop table, and how it avoids
    re-contradicting the guardian-only fix's own stated intent for a
    fresh NG+0 save.
  - **Tie roaming enemies to NG+2+ specifically, raised 2026-08-31 in the
    same note as the item above.** Timothy's own tentative link: "also
    maybe this ties into making roaming monsters as part of NG+2 and
    above or something like that." Connects two already-separate open
    ideas (the big "Roaming visible enemies" section further below, and
    NG+ cycle-gated content generally) rather than proposing new
    mechanics of its own - explicitly a "maybe," not a decision. Needs
    both dependencies (roaming enemies existing at all, and a real
    zone/cycle-gating shape) before this is more than a raw idea.
  - **Parry window narrowing + simulator parry-rate modeling — shipped
    2026-09-01.** See BACKLOG_SHIPPED.md for the full history (original
    2026-08-26 ask, the 2026-08-31 sharpened concern) and CHANGELOG.md's
    0.16.2 entry for the shipped detail. Two remaining open threads below
    weren't part of that session's scope.
  - ~~**Third candidate lever, raised 2026-09-01:** a cooldown after a
    parry attempt, so you "can't just do all the damage all the time."~~
    **Shipped 2026-09-02 (0.18.0) — see BACKLOG_SHIPPED.md's Multi-zone
    progression section.** A shared 10s cooldown now gates every parry
    input, solo and multi-mob alike, starting whether or not the attempt
    lands — resolves this and the multi-mob-clunky thread together (see
    "Rhythm-style multi-hit parry" in Combat pass ideas below).
- **The terrain painter tool should be able to grow into new zones'
  editors too, raised 2026-08-24.** Timothy wants the tool
  (`tools/terrain-painter/`) built so it's not permanently zone-1-only —
  eventually a zone dropdown ("zone 1 gives you zone 1's stuff") picking
  between different screen sets and different tile/asset palettes per
  zone. Deliberately not built now: zone 2 doesn't exist yet, so a real
  zone-switcher has nothing real to switch to, and its actual shape
  depends on decisions zone 2's own design pass hasn't made (how many
  zones, whether they share a tile palette at all, whether the 5x5-grid
  layout convention even carries over). The near-term compromise: keep
  the tool's zone-1 map list and tile palette reasonably data-driven as
  it grows (e.g. the dungeon-interior painting support planned for
  2026-08-24, below) rather than deeply hardcoded, so extending it later
  isn't a rewrite — without speculatively building the zone-switching UI
  itself ahead of zone 2 being real.
- **The terrain painter tool should be able to paint dungeon interiors
  too, not just the 25 wilderness screens — raised and actually planned
  2026-08-24.** Unlike the zone-switcher idea above, this one *is*
  being built now: the main dragon dungeon (`js/maps/dungeonMap.js`) and
  the 5 mini-dungeon interior variants
  (`js/maps/miniDungeons/miniDungeon{A-E}.js`) are real, existing maps
  today, so adding them to the painter as more paintable maps (with
  their own cave-appropriate tile palette — floor, wall, pool, boss
  tile, etc., distinct from the wilderness palette) is a same-scope
  extension, not new architecture. Tracked here only so the "why now
  vs. why not the zone-switcher" split has a written record; see
  session history around this date for the actual implementation.
- **Staged/tool-sequence-aware reachability checker still open.** (The
  guaranteed-drop "tool dungeons" mechanic and placement UI this depends
  on already shipped 2026-08-24 — see BACKLOG_SHIPPED.md.) "Check Map"
  still only checks the *main* dungeon's toolless/tooled reachability
  from town - it doesn't yet verify that each tool dungeon itself is
  reachable using only tools earned from *earlier*-placed tool dungeons,
  cascading until the main dungeon is confirmed reachable at the end of
  the chain. Design not finalized - algorithm shape still needs real
  design work before implementation.
- Currently there is exactly one zone (the 3x3 wilderness grid from
  `docs/superpowers/specs/2026-08-12-world-expansion-design.md`) and one
  boss (the dragon, with 3 tiers via the existing boss-rematch system).
  "Zone 2/3/4" means genuinely new content, not reuse — a much bigger
  scope than anything else currently in this backlog.
- **Non-store equipment earned from the whole zone, to prep for the next
  one.** Timothy wants unique gear obtainable other ways than the shop:
  a random cave find, clearing tree/mountain terrain with a tool, a
  special encounter reached via a puzzle, or repeated dragon kills —
  so a player is meaningfully geared up by the time a new zone opens,
  not just leveled. Partial precedent already exists: the dragon's own
  drop table (`js/data/monsters.js:41-49`) already grants unique,
  zero-price gear (`dragonScaleMail`, `dragonFang`) — but that table is
  identical across all 3 boss-rematch tiers, so grinding harder tiers
  gets better odds/XP, not new gear. Mini-dungeon treasure
  (`js/systems/miniDungeons.js`) is the closest existing "random cave
  find" analog — layout variety was fixed 2026-08-17 (3 → 5 variants,
  see CHANGELOG), but the *reward* pool is still the same small 6-item
  set shared across every variant; expanding that (or adding a genuinely
  new reward tier) is still open. No puzzle-triggered special-encounter
  mechanic exists at all yet.
- ~~**Town layout: south exit instead of a "door," expand town, and
  per-shop signage.**~~ **Shipped 2026-09-03 (0.21.0).** Raised
  2026-08-28, Timothy: "Door of town should be at the bottom of town or
  not even a door just a break in the trees in the south of town. Also
  can we expand town a bit and have a signpost or something or a label
  above each shop type or feature in town. Also when you exit town then
  you should appear in the map below the town if exit in south and for
  future towns maybe you can exit in multiple directions. Actually in
  first town let's have an exit in all directions and that's the
  direction you appear on the map." All four pieces shipped together:
  (a) the door is gone, replaced by 4 unmarked tree-gap exits
  (`TILES.treeGapNorth/South/East/West`, `js/tiles.js`); (b) town grew
  16x12 -> 20x14 (`js/maps/townMap.js`); (c) shop/blacksmith/quest
  board/well each show an always-on wooden signpost
  (`SIGN_LABEL_BY_TILE`, `js/screens/mapScreen.js`); (d) all 4
  directions exit town, each landing 1 tile out from the `@` entrance on
  `center` in the matching direction. One narrowing from how (d) reads
  above: exits land just outside town on the same `center` screen, not
  on a separate "correspondingly-adjacent wilderness screen" - decided
  during brainstorming (2026-09-03) as the simpler, still fully correct
  reading of "appear in the map below the town," since `center` already
  *is* the wilderness map immediately around town. See
  `docs/superpowers/specs/2026-09-03-town-exits-and-signage-design.md`
  and `docs/superpowers/plans/2026-09-03-town-exits-and-signage.md`.
- **Town NPCs that hint at where to go next, using landmarks rather
  than naming the tool location outright, raised 2026-08-28.** Timothy:
  "I think we should have towns folks and one of them should give you
  hints as to what to next. So if you don't have axe yet then something
  about where to go. I think I will need to make something unique about
  the map they can't hint at like a skull mountain or circle lake or
  trees in certain shape so it's not ultra obvious. Also our icons on
  the map clear show pick/canoe/axe. Well at least in the editor not
  sure what they look like on the game because I have not got there
  yet." Two pieces: (1) an NPC/hint system that reacts to which tools
  the player still lacks and points toward the right tool-dungeon using
  in-world landmark descriptions rather than direct coordinates — this
  needs distinctive, nameable map features to exist first (Timothy's own
  examples: a skull-shaped mountain, a circular lake), which is itself
  unbuilt; (2) worth separately checking whether tool-dungeon entrance
  icons are currently visible/distinct in actual gameplay (not just the
  terrain-painter editor) — flagged by him as an open question, not yet
  checked. **Authorship note:** per the standing "no AI-generated
  narrative" boundary (see "The game needs an actual story" above), the
  actual hint *text*/dialogue is Timothy's to write — this item is
  scoped to the engineering (hint-selection logic, landmark detection,
  NPC wiring), not drafting what the NPC says.

## Painter tool: paint which monsters can appear where (big idea — not designed yet)

Raised 2026-08-24. Timothy's own words: "let me paint the monsters that
can appear. so will have multiple layers or something, one layer for
each monster and you can select multiple layers to show at once so you
know all the ones you put down. not quite sure the best way to do this.
will have to be transparent layers or something. I just want control
over where the challenging monsters appear so I can more target harder
areas and things. I still think the tuning is the hardest part of all
this."

Today `monsterTable`/`encounterChance` are screen-level fields (same
gap already noted under "sand and tarpit" below) - every encounter-
eligible tile on a screen rolls against the same fixed roster, no
per-tile or per-region control at all. What Timothy's describing is a
real per-tile (or per-region) monster placement system, visualized as
paintable/toggleable layers in the terrain painter, one per monster
type. Explicitly flagged by him as not thought through yet ("not quite
sure the best way to do this") - captured as the raw idea and the real
underlying gap (screen-level, not tile-level, roster control) only. No
mechanic or UI shape decided.

## Roaming visible enemies + dragon difficulty scaling (big idea — needs its own design pass)

Raised 2026-08-24, while the zone 1 map expansion terrain was being
hand-painted. Two related but separable ideas — flagging the shape now,
not ready to implement.

Timothy's own words: "roaming enemies that are very strong that drop
unique loot and maybe the stronger you are before the dragon the harder
the dragon is so that dragon is always a tough encounter. What I mean by
roaming enemies is something you can see and have to walk around to
avoid them. have them walk pretty slow though but still should feel
scary and also you have to stay a block or two away or they will chase
you until you are 5 blocks away. and they can travel through map
borders. I am thinking at some point we might not have the game load
one screen at a time and the whole map just move as you move around."

- **Roaming enemies as visible, persistent overworld entities.** Today's
  encounter system has no on-map presence at all — `encounterChance` is
  a per-step random roll (`js/systems/groupEncounters.js` /
  `js/systems/combat.js`) that resolves straight into a battle screen;
  nothing is ever rendered walking around the wilderness. This idea
  needs an actual new subsystem: an entity with a position, a slow
  movement tick, an aggro radius (~1-2 tiles triggers a chase), a
  chase-break radius (5 tiles), and rendering on the map screen
  alongside the player. Very strong, with a unique drop table distinct
  from the regular per-screen `monsterTable` roster.
- **"They can travel through map borders."** The current world is 25
  discrete screens (`js/maps/wilderness/*.js`), each with its own local
  30x22 coordinate space — there's no single global position an entity
  could hold that's valid across a screen boundary today. A roaming
  enemy crossing screens means either teleporting it between two
  screens' local coordinate systems at the boundary (doable within the
  current architecture) or an entity position expressed in world-space
  from the start.
- ~~**The dragon scaling with the player's own pre-fight strength, so the
  final boss is never a pushover.**~~ **Steer, 2026-08-26: nixed as
  replacing the standard fight — kept as a separate, optional bonus mode
  instead.** Timothy's call: there should still be a standard, fixed
  power-level dragon fight the player can reliably prepare for and beat —
  don't make the "real" dragon a moving target based on player strength.
  Instead, offer power-scaling dragon as *another option you can fight*
  alongside the standard one (and the existing boss-rematch tiers, which
  scale *after* each kill, not based on pre-fight player strength) — a
  distinct, harder, opt-in bonus encounter for a player who wants the
  fight to always be tough regardless of how strong they've gotten,
  without changing what the base dragon fight is. Still not designed:
  what "how strong before the fight" measures (character level? gear
  score? both?), how that maps to a difficulty curve, and how a player
  chooses to enter this mode (a new option in `bossPromptScreen.js`
  alongside the existing tier-select buttons?) are all undecided. Doesn't
  touch the already-shipped "zone 1 should get easier over time, not
  track the player" call for regular wilderness monsters (see "The player
  outpaces near-town/far-corner content" thread below) — this is scoped
  to this one optional dragon-fight mode only.
- **Possible bigger dependency, flagged but not committed to:** cleanly
  doing "roaming enemies that cross screen borders" might be much
  easier — maybe even want — under a continuous single-map-that-scrolls-
  as-you-walk architecture instead of the current discrete-screen-swap
  model (`handleEdgeTransition` in `js/main.js`, `computeEdgeLandingPosition`
  in `js/systems/world.js`). That would be a significant rendering/engine
  rewrite, well beyond this feature alone — Timothy floated it as a
  "maybe eventually," not a requirement for roaming enemies to ship.
  Worth deciding explicitly, in the design pass, whether roaming enemies
  ship first on the current screen-based world (with the border-crossing
  piece handled as a special case) or wait for/motivate the bigger
  rendering change.
- **Raised again independently, 2026-08-25, with a clearer shape:**
  Timothy's own words: "in the future thinking we want to move away
  from the only show one square of map at a time. I think I want the
  game to go in a direction of the character always centered until you
  get closer to an edge so the whole map moves as the character walks
  around. Might need to a/b test this on myself. But I also think that
  could solve different screensizes as well and we could design the
  game to be more aware of the screen size you are on. So on mobile you
  might get less of the land showing or osmething." Same underlying
  architecture change as the bullet above (continuous scrolling world
  instead of discrete screen-swap), but now framed with its own
  motivation independent of roaming enemies: a hero-centered camera that
  only pans near world edges, and using it to make the visible viewport
  responsive to actual screen size (mobile sees less land, desktop sees
  more) rather than a fixed 30x22 grid regardless of device. Explicitly
  uncertain and exploratory - Timothy flagged wanting to A/B test the
  feel on himself before committing. Not designed - still needs its own
  pass whenever this gets picked up, likely alongside or after the
  roaming-enemies dependency above since they'd share the same
  rendering rewrite.

## Fog-of-war reveal map, brought up with a keypress, raised 2026-08-26

Timothy's own words: "a map that is slowly revealed as you walk over the
ground. you can bring up map with m when you want."

Two pieces: (1) a full-map overview screen, toggled on/off with a keypress
(`m`), showing the wilderness/dungeon layout; (2) that overview stays
fogged/blank except for ground the player has actually walked over,
revealed progressively as new tiles get explored - a classic fog-of-war
minimap.

Real prior art already exists to build this on: `state.visited`
(`js/systems/exploration.js`) already tracks per-tile walk history per
screen (walk count + which edges have been crossed, added for the
worn-path trail effect) - a fog-of-war reveal map could read this signal
directly for "which tiles has the player actually explored" rather than
needing a whole new tracked-exploration data structure. Not designed -
still open: what the overview actually renders (all 25 wilderness screens
zoomed out at once, or one screen at a time?), whether dungeon interiors
get their own separate fog-of-war map or are excluded entirely, and
whether landmarks (town, dungeon entrance) are always visible on the map
even before being walked past. Raw idea only, not scoped.

## New terrain types: sand and tarpit, each with their own monsters

Raised 2026-08-24, while drawing zone 1 terrain in the painter tool.
Timothy's own words: "let's expand our map options with sand (different
monsters), tarpit makes you walk slower (has different monsters too)."
Explicitly flagged by him as backlog, not for now.

Two distinct mechanical gaps this would need to close, neither of which
exists today:

- **Per-tile-kind monster tables.** `monsterTable`/`encounterChance` are
  screen-level fields today (`mapConfig.monsterTable`, checked in
  `js/screens/mapScreen.js` regardless of which walkable tile you're
  standing on) — every encounter-eligible tile on a given screen
  currently rolls against the same roster. "Sand has different
  monsters [than grass on the same screen]" needs that moved to (or
  duplicated at) the tile-kind level instead, at least for whichever
  kinds want a distinct table.
- **A movement-speed modifier.** There's no concept of variable move
  speed today — movement is a fixed one-tile step per key press,
  uniform across every walkable tile. "Tarpit makes you walk slower"
  needs a real mechanic: multiple keypresses per tile, a move-cooldown,
  or something else — undecided.

Both are also new tile kinds for the terrain painter tool
(`tools/terrain-painter/`) to support once they exist in `js/tiles.js` -
whatever palette/brush addition mechanism the tool ends up with for
future terrain types (see the "map editor should support new zones and
assets" thread the same day) should cover these too.

**Same gap, raised again 2026-08-28 for water specifically:** Timothy's
own words: "when on water need water theme enemies." Water (`TILES.water`)
already exists and is already walkable-with-a-canoe, so unlike sand/
tarpit this doesn't need a new tile kind — it needs exactly the same
missing piece called out above (per-tile-kind `monsterTable`, since
today's roster is screen-level and doesn't distinguish grass from water
on the same screen). Not designed, just confirms this is the same
underlying gap rather than a separate one.

## Hand-placed zone 1 loot, rebalanced around it (big idea — needs its own design pass)

Raised 2026-08-24, while placing tool dungeons and reviewing the check-map
progression. Timothy's own words: "I want a bunch of other loot for zone
1 even if we have to redo our loot. I want loot I can put in various
locations on the map. So maybe you make the store gear much weaker so
that the stuff we find can be better. I want a bunch of pieces I can
select from dropdowns and place in different places behind some tool
unlocks." Explicitly framed as backlog/whenever, not for now.

Two things bundled together here, both real design work:

- **A rebalance of the shop's gear**, deliberately weaker than it is
  today, so hand-placed world loot has room to be the exciting upgrade
  path instead of the shop being the main gearing loop. Touches
  `js/data/items.js` (shop-purchasable items) and whatever balance specs
  already govern shop pricing/stats
  (`docs/superpowers/specs/2026-08-16-inventory-equipment-design.md`
  and related) - not a small tweak, a real rebalance pass with its own
  playtesting.
- **A hand-placement system for world loot**, parallel to the existing
  tool-dungeon-entrance placement UI: pick an item from a dropdown (like
  `toolDungeonSelect`) in the terrain painter, click a wilderness tile to
  place it there, and have that persist into the real map data alongside
  the dungeon/tool-dungeon markers already in `js/data/toolDungeons.js`-
  style config. Explicitly wants pieces placeable "behind some tool
  unlocks" - i.e. sitting on/behind thicket, mountain, or water tiles, so
  finding an item can itself be gated by which tools you already have,
  same shape as the mini-dungeon-cache system
  (`js/systems/miniDungeons.js`) but player-curated per item/location
  instead of randomized.

Not designed here - needs its own brainstorming pass (item pool, how
placement data is structured/stored, whether it reuses or replaces the
existing cache-reward system, how the shop rebalance numbers actually
land) before implementation.

**Update (2026-08-28):** Timothy reiterated the same underlying ask,
framed around exploration purpose rather than the shop-rebalance half:
"a few more things in our map tool place. Maybe a few special loot items
or just a loot dropdown and I can place dungeons with that loot in it,
or come up with more special items I can place via dungeons or
something. I guess need a design pass for this. I just want more stuff
to put in our zone 1 to give folks a purpose to walk around." Two
threads in this restatement: (1) the same hand-placement-dropdown system
already captured above, and (2) a related but distinct idea - more
*special items themselves* (not just placement tooling) to actually
populate that dropdown with, possibly tied to hand-placed mini-dungeons
specifically rather than bare map tiles. Explicitly flagged by him
(again) as needing its own design pass before implementation - not
ready to scope.

## Puzzle mechanics, raised 2026-09-04 (needs its own brainstorming pass)

Timothy's own words: "how could we put a puzzle in the game? Should it
be logic, riddle, or something else? I know there are always puzzles
like push the thing out of the way. Trying to think what our tools
could unlock besides just going through an area now that you can get
past something." Genuinely open, not designed at all yet - explicitly a
"what should we build" question, not a bounded implementation task, so
it needs a real brainstorming pass (not squeezed into an unrelated
session) rather than a backlog write-up deciding it here.

What's actually raised, as three separable threads:
- **What kind of puzzle** — logic puzzle, riddle, a physical
  push/move-the-obstacle mechanic (his own example), or something else
  entirely. No direction picked.
- **What a tool unlocks beyond simple traversal.** Today's tool-gating
  system (`docs/superpowers/specs/2026-08-16-metroidvania-tool-gating-
  design.md` — the mining pick and axe) only ever gates *walking past* a
  terrain obstacle (thicket, mountain) to reach loot/shortcuts already
  sitting on the other side. This asks whether a tool could gate solving
  something instead of just reaching it — no such mechanic exists today.
- **Where it'd live.** Not scoped to a specific screen/zone - could tie
  into the still-open Multi-zone progression work (zones having distinct
  gameplay loops beyond combat is already an open thread there) or stand
  alone. Not decided.

Raw idea only - no mechanic shape, no specific puzzle content, nothing
implemented. Next step is a proper brainstorming session, not more
backlog writing.

**Brainstorming session, 2026-09-04 (this same session, picking up the
thread above):** Constraint set at the start, Timothy's own call: no
generic puzzle-authoring system/editor - whatever gets built should be
ordinary tile-kinds painted in the terrain painter like `thicket`/
`mountain`/`water` already are, not a bespoke "place this puzzle" tool.
Timothy: "I really like stuff to do with water" - water was picked as
the flavor to explore first (not a rejection of logic/riddle/push-
obstacle, just where energy is right now). Still genuinely raw -
Timothy explicitly wants to keep adding his own notes and think it
through more before this becomes a real design ("I want to put all
these ideas together in a doc and think through them... I will
probably have to take a map square or two and redo them a bunch...
which is fine because we have lots of unused areas"). **Not ready for
an implementation plan or spec - this is the capture, not the design.**

Ideas raised, roughly newest-first:
- **Strategic block/unblock maze** — Timothy's own idea, extending the
  dam concept below into a whole room/screen: "make some sort of maze
  thing where you have to strategically block/unblock to get through."
  Implies multiple obstacles/dams a player can toggle in sequence, not
  just one one-time dig. Needs its own screen layout, not just a tile
  mechanic - biggest of these ideas, not scoped at all.
- **Chop-a-tree/lay-a-board shortcut** — Timothy's own idea, a one-way-
  back shortcut: "maybe a shortcut where you chop down a tree/lay a
  board to get back." Close to the "felled bridge" example floated
  earlier this session (axe drops a tree across a narrow water gap) -
  Timothy's phrasing suggests a carried/placeable board item might be a
  separate, simpler variant of the same idea (lay a board you're
  carrying, rather than only felling a specific pre-placed tree). Not
  decided which.
- **Player-placeable dam, mid-game** — Timothy's own idea: "maybe you
  can also place a dam mid game and it stops the water." A real
  departure from every other mechanic below (and from every existing
  tool-gate in the game) - those are all one-time, permanent state
  changes (thicket → stump, obstacle dug out, trench flooded) baked
  into static per-screen data (`clearedGates`). A player-placeable,
  presumably player-*removable* dam implies live, reversible water
  state the player controls during play, not something the terrain
  painter authors once ahead of time. Not designed - would need its own
  data model (where placed dams live in save state, whether they're a
  limited-use item, whether they can be picked back up) before it's
  buildable at all.
- **"We might need to think water flow"** — Timothy's own words,
  flagging the real open technical question underneath all of this:
  does "water flow" mean simple undirected connectivity (a flood-fill
  from a `water` tile through connected `trench`/similar tiles, blocked
  by uncleared obstacles - cheap, and enough for the trench-fill/
  poison-drain ideas below on their own), or actual directional/
  volumetric flow simulation (meaningfully bigger technical scope, and
  probably only worth it if the block/unblock maze idea above needs
  water to visibly move/redirect rather than just flip a region between
  two states)? Unresolved - the answer likely depends on how far the
  maze idea above ends up going.
- **Trench-fill** — Timothy's own original example: "there is a trench
  and you can dig out in front of the trench and the water will flow
  through and you can finally cross that area with the boat." Worked
  through in detail this session: a `water` tile (the source) and a
  `trench` tile (dry, impassable, no tool crosses it) with an `obstacle`
  tile between them (dug out with the mining pick, same one-time-clear
  mechanic every existing tool gate already uses via `clearedGates`).
  The trench only reads as "flooded" (→ acts like `water`, boat-
  required) via a flood-fill from any real `water` tile through
  connected trench tiles, blocked by any *uncleared* obstacle - computed
  fresh at render/move time in `mapScreen.js`'s `tileAt()`, the same
  function that already swaps `thicket` for `stump` via `clearedGates`.
  Consequence worth calling out: **there's no real "paint the obstacle
  before the trench" ordering rule to enforce** - a flood-fill evaluated
  fresh from final tile positions doesn't care what order tiles were
  painted in, only the finished arrangement. If a trench is painted
  directly touching a lake with nothing between them, it simply reads as
  flooded from the very first load, which is the algorithm working
  correctly, not a mistake. The terrain painter's existing "Check Map"
  reachability preview would be the natural place to show this live
  (tint flooded vs. dry trench tiles) so an author can *see* the result
  while painting instead of relying on the mental model - not built.
- **Poison-drain** — Timothy's own original example: "you drain an area
  of poison water and can finally walk through it to ancient castle that
  has loot or something." Same underlying flood-fill primitive as
  trench-fill, direction-inverted: a new `poisonWater` tile-kind,
  impassable to everyone (boat included - that's what makes draining
  the only answer, not just "bring a boat"), with a `valve`/trigger tile
  at its edge. Once triggered, flood-fill outward through the connected
  poison-water region converts it all to walkable ground. Because it
  shares the trench-fill engine, building one gets the other most of
  the way there for free.
- **Waterwheel/remote trigger** — flow reaching a designated tile
  unlocks a distant gate elsewhere (a `guardian`-style lock) instead of
  converting local terrain - same flood-fill engine, different payoff.
  Raw idea, not fleshed out.
- **Drained lake reveals a mini-dungeon entrance** — ties the drain
  mechanic into the existing `miniDungeons` system (`js/systems/
  miniDungeons.js`) instead of inventing new reward plumbing. Raw idea.
- **Freezing water for a temporary bridge** — flagged explicitly as a
  *different, later* idea, not part of this pass: it implies a new tool/
  mechanic concept rather than reusing pick/axe/boat, a real scope jump
  from everything else here.

Architecture notes from this session, for whoever picks this up next:
`js/systems/toolGates.js` + `js/screens/mapScreen.js`'s `tileAt()`/
`clearedGates` already cover every *one-time, static* mechanic above
(trench-fill, poison-drain, waterwheel, drained-lake-reveal) with no new
painter tooling needed beyond new palette tile-kinds and (optionally) a
Check Map preview extension. The player-placeable-dam and strategic
maze ideas are a different, more dynamic shape (live/reversible state
during play, not baked into map data ahead of time) and would need their
own design thinking before they're anywhere near buildable - don't
assume they fall out of the same simple flood-fill work.

## In-game tutorials / mechanic explainers, raised 2026-08-28

Timothy, in the same note as the combo-priming timing gap (shipped
2026-08-28, see BACKLOG_SHIPPED.md): "Also need something explaining
how this works to the player. Maybe at each level of the game you have
a little tutorial or popup or something explaining the mechanics." A
general onboarding ask — as new mechanics/abilities unlock, explain
them via some kind of tutorial or popup rather than expecting the
player to infer them from play. Raw idea only, no UI shape decided.
Related: the "proud tool-pickup moment" idea (shipped, see
BACKLOG_SHIPPED.md) and the town signpost/labeling idea (Multi-zone
progression, above) are both instances of the same underlying "the game
should explain itself more" theme.

**Sharper version, raised 2026-08-29, specifically about combat:**
Timothy: "need the game to explain or tutorial the fight system
especially as you level. maybe after getting a new ability it tells you
how it works and the synergy works and how attack gets worse if you do
it too often and so on. not sure how to do this but let's talk through
it when the time comes." A concrete instance of the same general ask
above, scoped to battle mechanics specifically: new-ability unlocks,
ability synergies, and the repeated-attack falloff mechanic all lack
any in-game explanation today. Timothy explicitly wants to talk through
the design when this gets picked up rather than have it speced now —
flagged as a real "when the time comes" item, not raw-idea-only like
the general version above.

**Timing and dismissal, added 2026-08-29:** the explainer should fire
right at the moment a new ability unlocks (same level-up event that
already triggers `playCelebration`'s ability-unlocked banner in
`js/main.js`), not some separate later screen — read the ability and its
synergy explanation right then. Timothy also wants it to require an
explicit close/dismiss action (not a toast that can be missed or a timed
auto-fade like the existing celebration banners) so there's a real
guarantee the player actually saw it before play continues. Separately,
Timothy floated this eventually tying into the story he's writing himself
(see "The game needs an actual story" above) — still just a possibility,
not a commitment, and doesn't change the authorship boundary: any actual
narrative framing for these explainers is his to write, this item stays
scoped to the engineering (trigger timing, modal/dismiss mechanic) same as
the rest of this section.

**Engineering implemented 2026-09-03 (0.22.0), content still pending.**
Both trigger points are wired exactly as designed above: a combined popup
(`js/screens/mechanicExplainerScreen.js`, one per level-up event covering
every ability that just unlocked) mounts right after the existing
ability-unlocked banner in `js/main.js`, and a second one fires mid-battle
in `js/screens/battleScreen.js` the first time the attack-falloff mechanic
actually decays a hit, pausing combat via the existing pause path.
Escape/backdrop-click/button all dismiss it (Timothy's call - matches the
existing changelog screen's own affordances). The whole thing is gated off
by default behind a new Settings > Feature Flags > "Combat Explainers
(beta)" toggle (`mechanicExplainersBeta`), because the explainer text
itself is still empty placeholders in `js/data/abilityExplainers.js` -
that's Timothy's to write, not engineering's. **Remaining work: write the
actual ability/mechanic explainer copy, then flip the flag on by
default.**

## Input / accessibility

### Controller support, raised 2026-08-28
Timothy's own words: "Add controller support." Today input is
keyboard-only (`KEY_TO_DELTA` in `js/screens/mapScreen.js` for movement,
plus per-screen keydown handlers in battle/shop/etc.). Raw idea only —
not investigated: which input(s) to target (Gamepad API is the standard
browser mechanism), how deep support should go (movement only, or every
screen's keyboard shortcuts), or button-mapping/prompts.

## Quests / economy

### Sell unneeded crafting materials once upgrades are maxed — deferred 2026-08-22
Wants a way to offload materials that are no longer useful after hitting max
smith upgrades - either a manual sell option, or the game offers/prompts an
auto-sell once it detects upgrades are maxed.

Investigated: materials currently have no sell path or `price` field at
all anywhere in the game. Also a real wrinkle for any "auto" version —
upgrade level is tracked per specific equipped item
(`state.upgrades[itemId]`), not per slot, so a material tied to a maxed
weapon could become useful again after swapping in a different weapon;
auto-selling the instant a slot looks "maxed" risks selling something
you'd want back. A manual sell option (the safer of the two asks)
sidesteps that ambiguity entirely.

**Deliberately not built yet — Timothy's own call after a quick gut-check:**
the economy doesn't currently have a real "stuck with useless materials"
problem to solve. Shop gear tops out around 45g, the full 3-level smith
upgrade path costs at most ~120g total per item (20/40/60g), and even
mid-tier monster gold drops outpace those costs comfortably — nothing
sinks gold or materials fast enough to make this a real gap yet, just a
few extra tidy-up rows in the inventory. Revisit if that changes (e.g.
materials pile up faster, or a future economy pass tightens gold flow).

**The "gold way more than I need" thread that grew out of this entry
(revisit condition hit 2026-08-28) was resolved separately — buff
potions shipped 2026-08-31 as 0.15.0 as the gold sink.** See
BACKLOG_SHIPPED.md's "Quests / economy" section for that full history.
This entry itself (offloading *surplus materials* specifically, not
gold) is still open/deferred as originally scoped above — a different
problem than gold having somewhere to go.

### NG+-scaled purchasable store gear — deferred 2026-08-31
Raised as a gold-sink option alongside buff potions: extend the shop
catalog with a gear tier that scales with the player's current NG+
level, giving high-NG+ gold somewhere to go directly on stats. Deferred
in the same session it was raised — Timothy's concern, verbatim-adjacent:
purchasable gear needs a rule for staying below what you "work hard to
get in the world" (reforged Mythic-tier gear, boss/unique drops), and
that rule isn't designed yet. Buff potions were chosen instead for this
pass specifically because they carry no such power-creep risk (temporary,
not permanent stats). Revisit as its own brainstorming session once
there's an answer for how a buyable tier avoids outclassing earned gear.

### NG+ gear pass — every dropped item scales with NG+ level, raised 2026-08-31
Bigger idea, raised in passing while discussing the store-gear idea above:
have each NG+ level affect all dropped items (not just a purchasable
tier), so there's always a fresh upgrade to chase and max out at every
NG+ level rather than gear topping out early. Explicitly deferred to its
own future session — not investigated: how this interacts with the
existing tiered-gear/reforge-to-Mythic system (`js/systems/itemQuality.js`,
"Rung-3 gear cleanup" work from `b8a5d33`), whether it replaces or layers
on top of NG+-only unique effects (`ngPlusOnly` items), and how it avoids
just being a bigger-number treadmill.

### Materials feel like clutter, not a resource — raised 2026-08-31
Raised in the same session, alongside the gold-sink discussion, then
explicitly set aside by Timothy for later ("we already have waaaay too
many materials so that should be adjusted later"). Two rough shapes
floated, neither designed: materials could grant extra/different stats
on already-maxed gear, or be spent to reroll an item's rolled stats.
Related to — but a different problem than — the still-deferred "sell
unneeded materials" entry above this one; that one is about offloading
surplus, this one is about giving materials a use past the smith-upgrade
path in the first place. Revisit together, since a "materials do more"
answer could change whether the sell-path problem still exists at all.

### Loot/gold/gear economy rework (big idea — hold for playthrough feedback) — raised 2026-09-07
Timothy's own framing: "I wish we got more loot drops to slowly upgrade
the character... I'm just feeling like it's more fun to get loot from
playing than just upgrade gear you end up keeping the whole time. You
never really get to replace all the iron store pieces which isn't super
fun." Several interlocking pieces raised together, none designed or
scoped yet:

- **Cap smith upgrade levels per NG+ cycle, tighter than today.**
  Pre-NG+ only 1 upgrade level available; NG+1 adds one more (2 total);
  NG+2 adds another (3), and so on — restricting how far gear can be
  pushed via the smith so raw loot drops matter more relative to it.
  Distinct from (tighter than) the existing `getMaxUpgradeLevel` cap (3
  at NG+0, +2/cycle, shipped 2026-09-04 as 0.24.2's uncap walk-back — see
  the Multi-zone progression section).
- **Gate the quest board and blacksmith behind story progress, not
  available from the start.** New content behind the axe/mountain gate;
  the blacksmith becomes the person you have to find/rescue there, and
  only after that becomes both the quest-giver (turn-in rewards) *and*
  the gear-upgrader in one NPC/screen — today they're unrelated systems
  (`questBoardScreen.js` vs. `smithScreen.js`). Explicit intent: "that
  way you have to progress a bit before you can upgrade your gear."
- **A broken/sideways/lost-in-the-mountains sign on the map as the
  breadcrumb for the above, raised 2026-09-07 (same thread, second
  pass).** A busted or sideways signpost near where the quest board/
  smith would normally be — CSS-tilted or split-in-half — hinting "there
  used to be a quest board/blacksmith area here, but it was lost in the
  mountains," pointing the player toward the rescue. Timothy wants to
  build the actual map placement himself; this is just the visual/prop
  idea captured for when the gating above gets designed.
- **Loot tier scales with enemy strength, and more loot drops overall.**
  Weaker enemies drop something between cloth/iron tier; the next
  stronger tier of enemies drops iron-tier and up, and so on — today's
  drop tables aren't tiered this way. "I also think we need lots more
  loot to drop."
- **Halve gold from weaker enemies** (~1/2 of what they currently give),
  loosely paired with the loot-tier change above so gold isn't also
  trivially abundant early.

**Meta-question Timothy asked directly: does this make sense to build
now, or should he do a full playthrough of the current build first?**
Recommendation given in-session: playtest first. The specific complaint
("never replace your iron pieces") could be a drop-rate/tier problem or
a pacing problem that goes away once upgrades are capped per NG+ — no
way to tell which without actually feeling it. Split by risk: the pure
number/table tuning (loot-tier-by-enemy-strength, more drops, halved
weak-enemy gold) is cheap and reversible, worth dialing in *before* the
playthrough since it's exactly what he's about to feel; the structural
pieces (upgrade cap per NG+, the rescue-gating, merging the two NPCs,
the sign prop) are real map/save-data/UI work worth doing properly but
only once the itch is confirmed and its exact early-game placement is
clear. **Decision: Timothy is doing his playthrough now** ("I will do
the playthrough while you work on this small thing and then we can get
back to a bigger loot/gold pass") and will report back with a fuller
log — see also the near-town-difficulty playtest note in the "New
threads raised 2026-09-04" section above ("even at level 5 it's far too
easy to mow through the enemies on the way to the axe"), which is
happening in the same playthrough and may turn out related (an
easy-difficulty complaint and a boring-loot complaint compound each
other).

**Tangled sub-thread: the quest board's "click Turn In" flow itself was
mid-brainstorm when this rework came up** — Timothy's original ask was
auto-granting quest rewards into inventory with no button (items flying
in, a townsfolk NPC dialog visually handing them over, maybe a crowd of
the randomly-generated character-select-screen townsfolk). Paused with
"hold on" specifically because gating the quest board behind rescuing
the blacksmith may replace this flow's context entirely (turn-in might
happen through the same NPC/screen as gear upgrades once merged, not a
standalone quest board). Revisit the visual/auto-grant polish only after
the bigger gating question is settled — building it now risks throwing
it away.

## Combat pass ideas
Several related mid-combat ideas, raised together as things to think
through in a dedicated future combat pass rather than one-off adds.
(A number of items originally captured here have since shipped — see
BACKLOG_SHIPPED.md's own "Combat pass ideas" section.)

- **Slower combat with fewer, harder-hitting swings; also reconsidering
  the parry/attack timing minigame, raised 2026-08-30.** Timothy's own
  words: "Maybe we slow down combat and have fewer but harder hitting
  times you attack or something. also not sure how i feel about the
  timing minigame for parry and attacks so want to think through this
  more." Two linked but distinct threads: (1) a pacing change — reduce
  attack frequency (fewer ATB ticks resolving into swings) while raising
  per-swing damage, rather than today's rapid smaller hits; (2) an open
  reconsideration of whether the timing-minigame layer itself (parry's
  wind-up/parry window in `js/systems/parry.js`, and Stab/Slash's
  press-in-the-sweet-spot combo mechanic) is the right mechanic at all,
  not just how it's tuned. Explicitly not ready to design — Timothy wants
  to think it through more before this becomes a spec. Raw idea only;
  worth reading together with the already-open "rhythm-style multi-hit
  parry" and "hold-to-block shield" ideas further below in this section,
  since all three are really the same underlying question (is
  timing-minigame combat the right shape for this game) approached from
  different angles.

  **Sharper direction, raised 2026-09-03:** Timothy's own words: "I meant
  to remove our 1,2,3,4 abilities from the swing timer. I actually don't
  even think we need a swing timer any longer except for when we do the
  ability that needs the timing minigame to do more damage if you time it
  right. Everything else is just on a 1 second global cooldown which is
  sped up with whatever our hate/agility/speed stat is." Concretely: take
  Attack and the digit-key abilities (Impale/Sever/Lacerate/Faultline -
  `canUseAbility`'s `ready`/`isReady(playerCombatant.atb)` gate in
  `js/systems/battleScreen.js`/`js/systems/combat.js`) off the ATB gauge
  entirely, replacing it with a flat ~1s global cooldown scaled down by the
  player's speed stat; keep the sweet-spot timing minigame only for
  Lacerate's own retrigger (the ability that already rewards timing it
  right - `js/systems/abilities.js`'s `retrigger` config). Parry's own
  windup/timing minigame isn't mentioned here and presumably stays as-is.
  This is a real architecture question for `ATB_MAX`/`tickGauge`/
  `isReady`/`attackStreakMultiplier`'s whole streak-decay system (this
  session's own mid-battle attack-falloff explainer trigger, added in
  0.22.0, is built directly on top of that streak-decay mechanic - a
  global-cooldown rework would need to account for what happens to it).
  **Timothy wants to tackle this next, in a new session** - not scoped or
  designed yet, just captured here so it isn't lost.

- **Debuff visual effects - a bleed should show a falling blood
  droplet, and every enemy debuff deserves its own distinct effect, not
  just a status bar, raised 2026-09-02** (same session as the ability
  rotation v2 brainstorm, prompted by Lacerate keeping its bleed tick).
  Timothy's own words: "when something is bleeding we need a blood
  droplet falling out animation or something to indicate something
  exciting is happening. Any time an enemy has a debuff I want to try
  something interesting to see and not just a debuff bar but actual
  cool effect." Today's debuffs (defense-shred from Sweep, the bleed
  tick from Slash/Lacerate) show no per-effect visual at all beyond
  whatever generic damage-number/badge already fires - this is about
  giving each debuff type its own small distinct animation (bleed =
  falling droplet was the one concrete example given). Raw idea, not
  designed - needs its own pass once there's a settled list of which
  debuffs exist post-ability-rotation-v2.

  Extended same session: Timothy also wants a ground-crack-opening
  effect under the enemies when Faultline (the renamed Sweep, see
  above) is used - his own words: "Can we do an effect under the
  enemies of like a crack opening up? So it might not be an emoji and
  not sure how we would make this look and this could be a future
  animation pass where we download a tool to make images/effects or
  whatever." Flags a real question this backlog hasn't had to answer
  yet: everything shipped so far (weapon-swing animations, celebration
  bursts, the parry/crit flash effects) is built from emoji + CSS
  animation, no image/sprite assets or an actual animation/effects
  tool in the pipeline. A crack-opening-ground effect is a plausible
  first case that emoji-only can't really deliver well. Explicitly
  parked as a future animation pass, not part of ability rotation v2's
  implementation - that build's own design doc
  (`docs/superpowers/specs/2026-09-02-ability-rotation-v2-design.md`)
  keeps Faultline's visual to existing emoji + CSS only.

- **Bigger, mixed, synergistic monster groups + battle-screen visual
  overhaul, raised 2026-08-29.** Timothy's own words: "when multiple
  enemies show up it can be a mix of enemies and maybe some can buff
  other ones with interesting buffs/synergies to each other and let's
  boost it up to like 6 enemies can show up and then can be slightly on
  top of each other and different sizes and let's increase the battle
  screen size and how could we draw a cool background behind the whole
  fight scene?" Split into sub-projects (see
  `docs/superpowers/specs/2026-08-30-bigger-mixed-monster-groups-design.md`).

  ~~Sub-project 1: group-size cap raised to 6, mixed species per group,
  and both NG+-cycle/zone-1-lingering escalation triggers~~ **Shipped
  2026-08-30 — see BACKLOG_SHIPPED.md.** `state.zone1Steps` (steps taken
  on a zone-1 wilderness screen this NG+ cycle, per Timothy's own pick
  among the undecided options) is the "how long you've lingered"
  measure.

  Still open, deferred to their own later specs:
  - **(3) Inter-monster buffs/synergies** — a wholly new mechanic with no
    groundwork today.
  - **(4) Overlapping/varied-size monster rendering in the battle
    screen** — today's monster zones are uniform. Timothy's 2026-08-30
    addition, raised while reviewing sub-project 1's design: sizing
    should scale with how tough the specific monster instance is, tying
    into the existing `VARIANT_TIERS` system
    (`js/systems/monsterVariants.js` — Puny/Lesser/Greater/Savage,
    currently a stat multiplier with no visual difference at all beyond
    the name label).
  - ~~**(5) A larger battle screen.**~~ **Fulfilled by the separately-raised
    "Bigger battle dialog" ask — shipped 2026-09-06 (0.26.2).** Same want,
    worded again more concretely on 2026-09-05 ("can we make the whole
    battle dialog bigger. enemies, effects and all") and shipped as
    `--battle-scale` on `.battle-screen-stack` scaling the whole dialog
    (enemies, bars, effects) up to 1.7x on large windows. See
    BACKLOG_SHIPPED.md's "Bigger battle dialog" entry - this bullet was
    never struck through when that shipped since it was raised and
    tracked separately. No further action.
  - **(6) A background illustration behind the fight.**

- ~~**Weapon-swing attack animations per ability, raised 2026-08-28.**~~
  **Shipped 2026-08-30 — see BACKLOG_SHIPPED.md.** Attack/Stab/Chop/Slash
  each swing a distinct emoji with a distinct motion; Sweep is one
  traveling sprite that hits every target in turn, never a fan of
  duplicate sprites. Went through several rounds of live-feedback polish
  the same day (z-index/stacking fix, per-ability motion tuning, a
  hero-side attack lunge so the swing reads as anchored to the
  character rather than a projectile) - see CHANGELOG 0.8.0 through
  0.8.6. Flagged as still not fully dialed in ("not sure the anchoring
  is 100% yet") - revisit with a fresh session and a handoff prompt
  rather than more blind iteration; possible next experiment raised
  2026-08-30: build the swing out of real DOM elements (a `.blade`/
  `.hilt` pair with `transform-origin` pivoting at the hilt, like a
  found CSS-weapon-animation example) instead of a single rotated emoji
  glyph, for at least Sweep or Attack, to compare.
- **Rung-3 gear effects, raised 2026-08-26 during the gear/progression
  design pass (see `docs/superpowers/specs/2026-08-26-item-quality-and-
  effects-design.md`):** candidate additions to that spec's "growable
  list" of unique-item effects. **v1 (lifesteal, extra-swing chance,
  elemental proc) shipped 2026-08-28** — Vampiric Fang, Swift Strike
  Charm, Ember Ring; see CHANGELOG. Still open, not scoped for any
  version yet:
  - **Parry window trade-offs** — original 2026-08-26 framing here
    (wider window/less reflected damage vs. narrower window/more
    reflected damage) superseded by the sharper, more specific
    2026-08-31 entry under "Multi-zone progression" above (flagged there
    as a good next-session candidate) — see that entry, not this one.
  - **Known follow-ups from the item-quality-tiers final review,
    2026-08-28** (each a real, deliberately-accepted consequence of the
    v1 shipped design, not a bug — recorded rather than silently
    accepted). Three of the four **already shipped in `b8a5d33`** ("fix:
    Rung-3 gear cleanup - tier-aware tooltips, shared stat labels, dedup
    bonus calls") — this section just never got updated to say so until a
    2026-09-03 backlog pass noticed the code didn't match the text:
    - ~~`describeItem` (`js/systems/inventory.js`) was never made
      tier-aware.~~ **Shipped in `b8a5d33`** — it now factors in the
      item's tier via `getItemEffectiveStats`.
    - **AOE abilities multiply lifesteal/elemental-proc per target
      hit**, not per player action — `applyOnHitEffects` is called once
      per monster hit, so Sweep against 3 monsters yields 3 lifesteal
      heals (45% of total damage healed back) and 3 independent 20%
      proc rolls. Plan-mandated and commented as deliberate; flagging
      as a balance data point now that Sweep and Vampiric Fang/Ember
      Ring coexist. **Still open** — deliberate, not scheduled.
    - ~~`formatDelta` (duplicated identically in `inventoryScreen.js`
      and `shopScreen.js`) leaks raw camelCase stat keys into the UI.~~
      **Shipped in `b8a5d33`** as `formatStatDelta` + a shared
      `STAT_LABELS` map in `js/systems/inventory.js`, reused by both
      screens and by `describeItem`.
    - **`getItemStatDelta`'s displayed delta can be off by ±1** from
      what `getEquipmentBonuses` actually applies, whenever another
      equipped slot's fractional upgrade/tier contribution rounds
      differently once totaled — brute-forced across a large sample of
      equipped/candidate/tier/upgrade combinations: roughly a quarter
      mismatch (pre-existing from upgrade-level fractions alone; tiers
      barely move the rate). Never a sign error, only ever ±1. **Still
      open** — not worth blocking anything on, but the delta shown
      before equipping something isn't always exactly what you get.
    - ~~`getEquipmentBonuses(state)` is called three separate times on
      the battle-mount path.~~ **Shipped in `b8a5d33`** — computed once
      in `mount()` and reused for the player combatant build, the
      enemy-slow stat, and `playerEffectBonuses`.
- ~~**Rhythm-style multi-hit parry / synchronized multi-mob parry bar,
  raised 2026-08-26; reiterated 2026-09-01 as a concrete "clunky"
  complaint** rather than a tentative idea.~~ **Shipped 2026-09-02
  (0.18.0) — see BACKLOG_SHIPPED.md's Multi-zone progression section.**
  Multi-mob parry now runs on a shared cooldown that catches every
  monster mid-windup regardless of timing, instead of requiring each
  monster's own narrow 90-100% zone to line up. Neither the rhythm-
  sequential-hits mechanic nor the single-shared-bar idea originally
  floated here is what got built — see
  `docs/superpowers/specs/2026-09-02-multimob-parry-cooldown-design.md`
  for why a cooldown was the simpler, chosen direction instead.
- **Progressive shrinking parry window (idea, not built), raised and
  scrapped in the same message, 2026-09-03.** Timothy's own words:
  "Every time you go to parry the window gets smaller so the first time
  it's 50%, then like 25% shorter and so on down to be really hard to
  time." Explored as a possible replacement for the flat-percent-window
  idea below, then explicitly scrapped in the very next message: "Actually
  scrap all that parry stuff. Maybe keep the idea in the backlog as a
  potential thing. For now let's just keep parry as is and make it 20% of
  the bar." Kept here only in case it's picked up again later. What got
  discussed before it was dropped: the window starts at 50% of the windup
  bar and halves after each *successful* landed parry within the current
  battle (missed attempts don't shrink it further), resetting back to 50%
  at the start of every new battle. Timothy also floated making the
  shrink rate itself a settings knob ("some folks might keep it at 0% and
  make it 100% of the bar all the time you can parry") — i.e. a 0%
  shrink-rate setting would disable the mechanic entirely and always give
  the full window. None of this is designed further than this paragraph —
  no floor value picked, no code written, no settings-UI shape decided.
  The actual shipped change from this session was the much simpler flat
  revert of `PARRY_ZONE_START_PERCENT` back to 80 (20% window) — see
  CHANGELOG.
- **Hold-to-block shield, a damage-reduction alternative to parry,
  raised 2026-08-26.** Timothy's own words, explicitly unsure of the
  exact motivation ("not sure why you would want that over parry"):
  hold down a key (floated `d`, distinct from parry's `s`) to raise a
  shield, reducing incoming damage while held rather than negating it
  outright like a successful parry does. His own best guess at why it'd
  be worth having alongside parry: some enemies or attacks might be
  flagged un-parryable but still blockable, giving block a reason to
  exist as its own mechanic rather than a strictly-worse parry. Also
  floated: a visual (a shield icon/graphic) appearing in front of the
  character while blocking is held. Not designed — open questions
  include the actual damage-reduction percentage, whether it costs
  anything to hold (stamina-like resource, or free), how it interacts
  with the existing wind-up/parry-window system in `js/systems/parry.js`
  (does a blockable attack still show a wind-up bar, just without a
  parry-timing payoff?), and which specific attacks/enemies (if any)
  would actually be marked un-parryable-but-blockable. Raw idea only.
- **Timer-speed items.** Droppable gear that speeds up your own gauge or
  slows the enemy's, capped so speed can't stack infinitely — a build
  choice between "faster me," "slower them," or other effects.
- **Bonus damage at high swing-timer speed.** If timer-speed investment
  scales high enough, grant a small damage bonus too, so speed stays
  worth investing in past a soft cap. Raised more tentatively than the
  others ("more for our combat pass to think through").
- **Research: how do other games avoid pure exponential stat inflation?**
  Timothy, 2026-08-17, raised alongside the pacing-curve discussion —
  rather than only fighting "numbers get big and trivialize old content"
  by tuning the XP/stat curve tighter and tighter, look at how other
  games sidestep the problem structurally. Rough idea: as the player
  progresses, power could come increasingly from *ability/skill
  synergies* (qualitative build choices) rather than ever-bigger raw
  attack/defense numbers, so late-game power growth can stay flatter
  without old content going stale as fast. Its dependency (an ability
  system existing at all) is now satisfied by the shipped Phase 1
  abilities build — this research is unblocked, though still explicitly
  rough/unrefined, a research question to explore before any design doc,
  not a spec'd idea yet.
### Backburner / uncertain value
- **Mob leveling.** The other half of the original "roaming rare
  monster" idea — heavily-farmed regular mobs could slowly level up
  too. Left here since the "roaming rare monster" part above graduated
  out of backburner status, but this half wasn't specifically revisited.

### The player outpaces near-town/far-corner content well before dungeon tier — three related threads converging on the same gap
Timothy, 2026-08-17: "leveling up makes you attack so much harder too
quickly and before I have a chance to really upgrade gear I'm killing
guys with a few hits and no potions" — reported live at level 5, full
cloth set, starter sword never upgraded at the smith. Confirmed with
the balance simulator (new `L5 (starter sword unupgraded, full cloth)`
baseline, 3000 trials): 100% win / 95-97% HP left / **0 potions used**
against every near-town monster, and still 70-94% HP left against
far-corner monsters. Meanwhile dungeon-tier (orc/wraith) and the dragon
are still a flat 0% win rate at this build — so there's a real cliff:
near-town/far-corner content goes trivial well before dungeon-tier
content becomes reachable at all, with seemingly no stretch in between.

This isn't a new problem — it was **explicitly anticipated and
deliberately deferred**: `docs/superpowers/specs/2026-08-16-player-
growth-curve-design.md`'s scope section says outright: "Making regular
(non-dragon) monsters scale with the player — that's the deliberately
separate, sequenced-next 'Content Scaling' project." That project was
named but never actually specced or built — grepped the whole
`docs/superpowers/` tree, it only exists as that one line. Real
evidence now says it's needed.

Three backlog threads are all pointing at the same underlying gap
(monsters are static, the player isn't) and are worth deciding together
rather than as three separate builds:
1. **This item** — regular monster stats don't scale with the player at
   all, so old-tier content has a hard trivialization point.
2. **"Faster battle timer against weaker enemies?"** (Open question,
   below) — already-informed finding that the existing speed-stat
   system organically produces *some* speed-up against outleveled
   enemies, but the question of whether that's enough, or whether a
   "quick battle" auto-resolve is wanted, is still open.
3. **"Outclassed weak mobs should give up or flee"** (shipped
   2026-08-17, see BACKLOG_SHIPPED.md) — a mob-surrender/flee mechanic
   for exactly this trivial-fight scenario. Doesn't touch monster
   stats, so it doesn't fight the "zone 1 should keep getting easier"
   goal below — it just makes the fights you've outgrown resolve faster
   instead of staying full-length.

**Steer (2026-08-17):** Timothy does not want zone 1 to scale to match
the player — it should keep getting *easier* over time, not track him.
That rules out Content Scaling as specced (monsters get stronger as the
player does directly contradicts "easier and easier"). Current lean:
skip Content Scaling as its own project; the shipped surrender mechanic
already answers the "old content feels like padding" complaint without
a treadmill, and the remaining gap (fights below the 3-hit surrender
threshold that aren't quite trivial either) is what the "faster battle
timer" open question below would address instead of monster-stat
scaling. Not fully decided — flagged here so the next session picks up
the thread instead of re-deriving it.

**Raised again 2026-08-28, player-defense side specifically:** Timothy's
own words: "the defense scaling needs work too nothing feels dangerous
that might tie into our other scaling work we have to do." Framed by
him as likely the same underlying thread as the above (monster stats
static vs. player growing) rather than a separate ask — captured here
rather than as its own section. Not investigated yet: whether this
means the player's own defense stat grows too fast relative to incoming
damage (making the player too safe) or that monster attack numbers
themselves need their own look independent of the "don't scale zone 1
to the player" steer above. Needs the balance-simulator treatment the
rest of this thread already got before any design decision.

**Investigated 2026-09-02 — two findings, one shipped fix, one genuine
dead end:**

1. **Confirmed and fixed the literal damage floor.** `calculateDamage`
   (`js/systems/combat.js`) is `max(1, attack - defense)` — once a
   monster's defense-facing attack falls at or below player defense,
   every hit floors to 1 regardless of the gap. Player defense grows
   `+1`/level flat (`js/systems/leveling.js`) plus cheap gear, and
   near-town/far-corner monster attack (originally 9-14) was still at
   its original value — dungeon-tier (orc/wraith/skeleton) already got
   a fix for this exact bug (see the comment on `orc` in
   `js/data/monsters.js`), near-town/far-corner never did. Shipped a
   moderate attack bump on boar/bat/snake/goblin/frog/direWolf/spider/
   scorpion (see that file's own comment for the numbers and history)
   — big enough to clear the floor through most of leveling, small
   enough to stay safe at L1 (a larger bump sized to survive all the
   way through full-iron gear was tried first and nearly one-shot a
   fresh L1 character — reverted).

2. **The floor fix barely moves "nothing feels dangerous," and here's
   why — this is the more important finding.** Instrumented the
   simulator to count real monster turns landed per fight: near-town
   monsters average **~0 turns** against an L5+ build. The bottleneck
   isn't damage math at all — it's the ATB turn economy. Every player
   action (ability, or an early-streak Attack) knocks the monster's ATB
   gauge back by a flat 15 (`ATB_KNOCKBACK`, `js/systems/combat.js` /
   `js/systems/abilities.js`), and near-town monster HP is low enough
   that fights end in a handful of hits — before a slow, static-speed
   monster's gauge can climb back from repeated knockback. Tried fixing
   this directly (raised boar's speed and HP together, confirmed via
   the simulator it produces real danger — HP loss, potion use — at
   L5); the **same HP value made boar literally unkillable at L1 (0%
   win rate)** — a fresh L1 character's attack can't grind through that
   much HP fast enough to survive the attrition. **No static per-monster
   stat block can satisfy "safely killable at L1" and "meaningfully
   threatens a full-iron L9 character" at the same time** — the
   player's own power grows too much across that range for one fixed
   target. This isn't a numbers-tuning gap, it's structural.

   **Implication:** near-town/far-corner monsters can't be made to
   "feel dangerous" again by tuning their stats, full stop — that's
   consistent with, not in tension with, the "zone 1 should keep
   getting easier over time" steer above. The actual "nothing feels
   dangerous" complaint should be pointed at whatever the player's
   *current*-tier content is (dungeon/far-corner at their real level),
   not at near-town — and the mechanism side of it (short trivial fights
   from turn-suppression) is exactly what the already-shipped
   surrender/flee mechanic and the still-open "faster battle timer?"
   question (below) already exist to address, rather than a new lever.

### Mobile/touch-only combat should be turn-based, raised 2026-08-23
Timothy: for mobile/phone/touch input specifically (not desktop/keyboard),
he doesn't want to simulate keypresses for combat — wants a genuinely
turn-based flow instead. Raw idea, not yet designed:
- Combat pauses for input: player picks their action (tap the monster to
  parry, tap an ability/attack button), then the enemy takes its turn,
  rather than today's real-time ATB ticking continuously in the
  background.
- Parry could be its own tap target (an on-screen button, or just tapping
  the monster).
- Attacks/abilities become tap targets (buttons) rather than relying on
  keyboard shortcuts (`1`-`4`, `a`, `s`, Space).
- Unclear how this interacts with the existing timing minigame (the
  parry wind-up bar, and Stab/Slash's press-in-the-sweet-spot combo
  mechanic) — Timothy's own tentative idea: selecting Stab (1) starts the
  timing game, and landing it right auto-fires the primed Chop (2) rather
  than requiring a second tap.
- Explicitly scoped to mobile/touch only — desktop/keyboard play keeps
  the existing real-time ATB flow, this wouldn't replace it there.
Not designed or estimated yet — captured here as the raw idea only, per
Timothy's explicit "let's put all this in backlog for the future."

### Ability uses should charge Attack toward a bigger payoff, not instantly reset it — raised 2026-09-07
Came up right after the ready-ring fix (0.26.9, which correctly lined the
ring up with the real streak-decay/recovery timer) — Timothy's own
reaction: "having to press attack again and again isn't the most fun."
His idea, verbatim-adjacent: each ability used *without* pressing Attack
in between should make the next Attack progressively stronger, building
toward "one big whallop" — not sure exactly how, but floated "maybe each
time you use 3 abilities attack gets stronger, and no ability actually
makes attack full power again, so you still have to wait for full power
or try to figure out when it's good enough to use again."

This flips today's relationship: currently Attack decays with its own
spam (`attackStreakMultiplier`/`ATTACK_STREAK_DECAY` in `combat.js`) and
any ability use instantly resets that decay to full power
(`attackStreak = 0` at three call sites in `playerUseAbility`,
`battleScreen.js`). The new idea would make Attack a payoff you build
toward via the ability rotation instead of a filler you spam between
ability cooldowns.

My own read, given directly when this was raised: interesting direction,
but real scope — a charge-level counter, new UI to show charge progress
(distinct from the ready-ring, which already means something specific),
and Attack's damage ceiling would need rebalancing to justify the wait.
It also risks doing a similar job to the existing streak-decay system
rather than something clearly additive. **Recommended and Timothy agreed:
hold this until after his current playthrough** — the boredom prompting
it may turn out to be the loot/itemization thread below, not this
mechanic specifically. Revisit only if it still nags after playing.
Not designed, not scoped.

## Open question (not yet decided)

### Faster battle timer against weaker enemies?
Idea: scale the ATB fill speed (or attack cadence) up when the player is
significantly more powerful than the enemy, so battles against
low-threat/backtracked monsters resolve faster instead of feeling
arduous. Raised with an explicit caveat from Timothy: "but maybe that is
just too much power creep" — needs a decision, not just an implementation,
before this goes on a plan. Consider whether it's really a *speed*
problem (grind-through-old-content fatigue) rather than a power-scaling
problem, which might argue for a different fix (e.g. a "quick battle"
auto-resolve for trivial fights instead of a permanent speed multiplier).

**Update (2026-08-17):** Timothy suspected this might already be
partially handled, and checking the code confirms a natural mitigation
already exists — it just isn't a deliberate "detect a weak enemy and
speed things up" feature. The ATB tick interval itself is a fixed 300ms
(js/screens/battleScreen.js:274) that never changes, but each
combatant's gauge fill rate scales with their `speed` stat
(`tickGauge`, js/systems/combat.js:9), and `speed` grows +1 almost every
player level (js/systems/leveling.js's `statGainsForLevel`) while a
regular monster's `speed` is fixed per species (js/data/monsters.js) and
even boss-tier scaling explicitly leaves `speed` untouched
(js/systems/bossTiers.js:22, `speed: baseMonster.speed`). So a
higher-level player already gets proportionally more turns per unit
time against a low-level enemy than they did at that enemy's original
level — the existing system organically produces *some* version of the
requested effect. Whether that's enough, or a dedicated fix (like a
"quick battle" auto-resolve) is still wanted for genuinely trivial
backtracked fights, is still Timothy's call — leaving this open, just
better-informed.

## Bugs / open questions, raised 2026-09-03

### ~~Old save shows way more smith-upgrade levels available than expected~~ — investigated 2026-09-07, not a bug
Timothy, on a save at level 11 (created "10-20 patches ago," not yet at
max level): the smith screen lets him upgrade gear well past where a
level-11 character should reasonably be (screenshot showed Dragon Fang
Blade +5, Iron Helm +5, Iron Armor +4, Iron Greaves +5 already applied,
with `Upgrade (120g)` still available on several). Question raised but
explicitly deferred ("something to look into after this section is
done") - not investigated at the time.

**Investigated 2026-09-07.** `getMaxUpgradeLevel` (`js/systems/
inventory.js`) gates purely on `ngPlusCycle` (base cap 3, `+2`/cycle)
plus gold/material cost - there is no character-level gate on smith
upgrades at all, today or ever. The real reason a level-11 character can
show this: `resetWorldForNgPlus` (`js/systems/ngPlus.js`) never touches
`player.level`, so character level and NG+ cycle are fully decoupled - a
save that beat the dungeon boss early and cycled NG+ a few times for
rewards is fully expected to have a level far below what its NG+ cycle's
upgrade cap would suggest. No migration gap found - the historical
2026-09-01 full-uncap window (see the "Partial walk-back of the
2026-09-01 upgrade-level uncap" entry above) is correctly handled by the
existing `atCap` check, which just disables further upgrades on an
already-over-cap item rather than needing any retroactive clamp. Closed,
no code change. One real gap it did surface, filed as its own entry
immediately below: the smith screen never shows the player's current
NG+ cycle, so there's no way to tell *why* the cap is what it is while
looking at gear.

### ~~Smith screen doesn't show the player's current NG+ cycle~~ — shipped 2026-09-07 (0.26.7)
Surfaced while investigating the entry above (2026-09-07) - the smith
screen had no indication anywhere of what NG+ cycle is currently active,
even though it's the sole factor determining the upgrade cap shown on
every slot. Fixed by reusing the Stats panel's existing `ngplus-badge`
(`js/screens/statsPanel.js`) in the smith screen's own header
(`js/screens/smithScreen.js`), shown next to "Maxed for NG+`<cycle>`"
whenever `ngPlusCycle > 0`, same condition as the Stats panel original.

### ~~"NEW MAX!" callout overlaps other battle text, hard to read~~ — shipped 2026-09-04 (0.24.5)
Timothy: "the text that comes up for 'new Max' should come up outside
the battle dialog or not overlap other text as it's hard to read now. I
don't know a good solution like making it bigger and higher up over the
mob or something?" This turned out broader than just the New Max! badge -
Timothy sent a screen recording, which also showed two damage numbers
("-14"/"-15") stacked exactly on top of each other. Root cause in both
cases: `showDamageNumber`/`playPerfectTimingEffect`
(`js/screens/battleScreen.js`) always positioned from the target's own
rect alone, with no idea what else was already on screen for that same
target.

Explored via an interactive mockup published as an Artifact
(`docs/superpowers/scratch/battle-popup-lab.html`, "Battle Popup Lab") -
a working replica of the real battle dialog with four candidate
placement schemes (current/buggy, side-by-side fan, vertical queue,
merge-into-total) and a live collision detector, iterated live with
Timothy over several rounds (spacing slider, then cross-kind awareness
once he asked what happens when a number, crit, New Max!, and Parry! all
land at once). Landed on **side-by-side fan, 20px minimum gap**.

Shipped as `claimPopupColumn` in `js/screens/battleScreen.js`: every
popup for a zone - damage number, crit, or badge alike - now shares one
list, measures its own real rendered width, and claims an exclusive
horizontal column past whichever side is currently less crowded. No two
live popups ever share a column, so a number's upward drift can't cross
into a badge sitting above it, and measuring real width (not a guessed
constant) means it keeps working as damage numbers grow across NG+
cycles with zero retuning. Test coverage added in
`tests/battleScreenDom.test.js` (two quick hits land in different
columns; a hit's own New Max! badge doesn't share a column with its
number). Confirmed live 2026-09-04 via a `?debug=level10` test character
(`js/systems/debugCharacters.js`, added the same session) - Timothy
played real battles against it and confirmed the fix looks right.

### Player's own marker inherits the guardian's giant size when standing on a guardian tile, raised 2026-09-09
Timothy: "when I go over a double size emoji my characters gets that big
too which looks kind of silly." Root cause found by reading
`js/screens/mapScreen.js`'s fullsize-marker branch (not reproduced live -
see the "browser automation cost" note this project operates under):
lines 677-681 set `marker.style.fontSize` in sequence - `FULL_SQUARE_PX`
default, then `HERO_AND_LOOT_PX` when `isHeroOrLoot` (true for the
player), then **unconditionally** `GUARDIAN_PX` (2.2× tile size,
"big and scary" per the 0.26.12 comment) whenever `tile === TILES.guardian`
- with no `&& !isPlayer` guard on that last line. `marker.textContent` is
already correctly `state.player.emoji` when `isPlayer` (line 671), so this
only affects size, not which emoji shows - the player's own hero emoji
renders at guardian scale whenever they're standing on a guardian tile
(walking up to fight it, or afterward if the tile stays type `guardian`
once cleared). One-line fix once picked up: guard line 681 with
`&& !isPlayer`. Not fixed here - `js/screens/mapScreen.js` is one of the
files with active uncommitted changes in another session's performance
work; touching it here risked a conflict.

### ~~`resolveStaticFilePath` (tools/dev-server.mjs) fails its own path-traversal check on Windows, raised 2026-09-09~~ - fixed 2026-09-09
**Fixed** the same day, once `tools/dev-server.mjs` wasn't actively being
edited by another session anymore - `rootDir` is now normalized at the top
of `resolveStaticFilePath` before the `startsWith` check, exactly the
one-line fix this entry's own diagnosis called for. `npm run test` is
fully green (1031/1031). Original diagnosis preserved below.

Noticed while running `npm run test` in an unrelated worktree (boat-text
proximity-message fix session): `resolveStaticFilePath maps / to
/index.html under the given root` fails on Windows - 1019/1020 tests
passing, this one red. Root cause: the traversal guard does
`resolved.startsWith(rootDir + path.sep)`, but `resolved` has already
been through `path.normalize` (backslashes on Windows) while `rootDir`
is used as-passed, un-normalized. Any caller that passes a forward-slash
`rootDir` (including the test itself, `'/repo/root'`) mismatches and the
function wrongly returns `null`, as if every request were a path-
traversal attempt. Only actually breaks when `rootDir` isn't already
backslash-normalized - real dev-server usage probably passes a
Windows-normalized path already, which is likely why this hasn't been
noticed live - but it's still a latent bug (and confusingly named test
failure) worth a one-line fix: normalize `rootDir` once at the top of
the function. Not fixed here - `tools/dev-server.mjs` is actively being
edited in another session's performance work, deliberately left alone to
avoid stepping on it.

## Infrastructure / deployment

### Deploy workflow: reuse more between builds, pin the wrangler version, raised 2026-09-04
~~The wrangler-version-pin half~~ **shipped 2026-09-04 (0.24.2, hotfixed
same day as 0.24.3)** — `wranglerVersion: '4.127.1'` added to the
`cloudflare/wrangler-action@v4` step. That pin broke the very next
deploy: 4.127.1 requires Node >=22, but `actions/setup-node@v7` was
still on Node 20 (the old unpinned behavior had silently masked this by
falling back to an older, Node-20-compatible wrangler release) - fixed
by bumping `node-version` to 22 in the same workflow, confirmed live via
`gh run watch`. The build-cache investigation below found nothing else
to fix (the stall was a one-off, not a caching gap). ~~The
`--commit-dirty=true` cosmetic cleanup~~ **shipped 2026-09-07 (0.26.7)** —
appended to the `pages deploy` command in the same workflow.

Timothy, after watching a deploy stall ~10 minutes at a plain `npm ci`
step, then a retry succeed cleanly through the same steps: "is there a
way to smarten up some of our CI/CD to reuse parts of the build process
so we're not installing some of it fresh every time... seems like we do
some things again and again even though we never change some of the
packages between builds." Investigated live during that session:

- **Our own dependency install is already cached** —
  `.github/workflows/deploy.yml`'s `actions/setup-node@v7` step already
  has `cache: npm`, keyed off `package-lock.json`, so `npm ci` itself
  should normally be fast. The ~10 minute stall that prompted this
  wasn't a caching gap - it looked like a one-off slow GitHub
  Actions/npm-registry stretch (a same-session retry cleared it in the
  low single-digit minutes with nothing changed), not a reproducible
  bug.
- **What's genuinely not cached or pinned: the Cloudflare `wrangler`
  CLI itself.** The `cloudflare/wrangler-action@v4` deploy step doesn't
  pin a `wranglerVersion` input, so every run it first tries
  `npx wrangler@<latest> --version`, which fails on current npm
  (`npx canceled due to missing packages and no YES option` - recent
  npm requires an explicit `--yes`/`-y` this action's internal npx call
  doesn't pass), then falls back to an explicit `npm i wrangler@4`
  install, verified live in this session's logs. Harmless (deploy still
  succeeds) but real, avoidable overhead every single run, and
  unrelated to our own npm cache. Pinning `wranglerVersion` explicitly
  in the `with:` block should let it skip straight to a known-good
  version instead of doing this resolve-then-fallback dance - not
  implemented yet, needs checking the current action's actual input
  name/behavior before touching the workflow file.
- **Separate small warning noticed same session, same fix bucket:**
  wrangler also logs "Your working directory is a git repo and has
  uncommitted changes" every run - this is just the workflow's own
  `dist/` staging step (untracked build output, by design) tripping
  wrangler's dirty-check. Cosmetic only; `--commit-dirty=true` on the
  wrangler-action step would silence it if it's ever worth the noise
  reduction.

Not urgent - deploys are succeeding either way, this is pure log-noise/
minor-time cleanup, not a blocker. Explicitly deferred rather than
tackled same-session per Timothy's own call ("tackle now... or add for
backlog").

### A friend playtester reported lag — worth a performance pass? Raised 2026-08-29
Timothy relaying a friend's report: "I tried last night but my PC was
lagging for various windows reasons. Will try again later." Explicitly
vague on the friend's end ("various windows reasons") — not clearly
attributed to the game itself rather than the friend's own machine/OS at
the time. No profiling done, no specific screen/action identified as slow.
Not investigated - flagged so a recurrence (same friend or someone else)
isn't dismissed as one-off, but nothing here yet points at an actual
in-game performance problem to fix. If it recurs or gets more specific
(which screen, browser, whether it's the new continuous-camera map
rendering specifically), worth profiling then rather than guessing now.

**Second report, 2026-09-01:** Timothy noticed slowdown himself this
session, live-testing the buff-potions/item-menu work. Self-diagnosed
moments later as his own machine being in low-power mode, not a game
issue — but asked to keep it on the list regardless ("but maybe we
should still take a look"). Still no profiling, no specific screen/
action pinned down, both reports now explained by something outside the
game (Windows issues; low-power mode) — but two independent "felt slow"
reports is enough to warrant an actual profiling pass next time it's
worth the time, rather than a third round of guessing.

### Pixel-level visual regression test for the worn-path trail (and similar rendering bugs) — raised 2026-08-26
Timothy, after several rounds of "there's a seam" reports that turned out
real but took multiple live-browser screenshot/zoom cycles each to pin
down and confirm fixed (two separate bugs found this way in one session:
a stroke-width notch at forks, then a worse color-gradient mismatch at
tile borders — see CHANGELOG): "Be cool if we had a unit test which could
test the actual pixel values or something like that so we at least had a
target to shoot for. Like something even outside of this game that
grabbed a screenshot and looked at tile borders."

The idea: something that renders a known trail scenario (e.g. two
adjacent tiles with deliberately different wear), takes/reads a real
rendered pixel buffer at the shared border, and asserts the color on both
sides actually matches — as an automated gate, not just the existing
`trail.test.js` unit tests (which test the color/width *math* in
isolation and would never have caught this class of bug, since the bug
was in how two separately-computed gradients disagree about a shared
physical point, not in either formula alone). Node's test runner has no
canvas/rendering support built in, so this needs either: a headless
browser (Playwright/Puppeteer) rendering the actual SVG and reading back
pixel colors via canvas, or a lighter node-canvas-based harness that
re-implements just enough SVG gradient math to sample a point - the
former is more real but adds a browser-automation dependency this repo
doesn't have yet; the latter is faster/cheaper but risks testing a
reimplementation instead of the real renderer.

**Not started.** Raised as a good idea, not yet scoped or estimated -
would need its own small design pass (which approach, how many scenarios,
where the images/expected-pixel data live) before implementation.

### ~~`tests/battleScreenDom.test.js` carries the same latent CI-flakiness pattern that `battleSpecialAttacks.test.js` used to~~ — shipped 2026-09-07 (0.26.7)
Two deploys in a row (0.26.4, 0.26.5) failed `npm run test` under GitHub
Actions' own load - never reproducible locally in isolation. Root cause,
found in `tests/battleSpecialAttacks.test.js`: three tests waited a fixed
delay (`PARRY_WINDUP_DURATION_MS + 400`, guessing how long a resolution
would take) and then checked the outcome exactly once - fine on a quiet
machine, but every test file's real-wall-clock timers share one process
under CI, and that contention pushed the real resolution past the fixed
margin often enough to fail twice in a row. Fixed (0.26.6, commit
`3c6e9fd`) by replacing the fixed waits with a `waitForCondition` poll
that waits for the actual outcome instead of guessing a duration -
removes the race regardless of system load (see the systematic-debugging
skill's condition-based-waiting technique).

`tests/battleScreenDom.test.js` had three tests using the identical
fixed-delay-then-single-assertion shape (the Retribution Charm reflect
test, the PERFECT!/PARRY! badge animation-duration test, and Second Wind's
lethal-hit test - all three let a monster's wind-up naturally resolve
unparried via a guessed real-time wait, then checked once). Fixed
2026-09-07 (0.26.7) by giving the file its own local `waitForCondition`
helper (same shape as `battleSpecialAttacks.test.js`'s) and polling for
each test's actual log-line outcome instead.

## Discoverability / monetization

### Google AdSense for in-game ad revenue, raised 2026-08-22
Timothy wants to explore showing ads in-game to earn revenue via Google
AdSense (confirmed AdSense, not Google Ads/AdWords — this is about
earning from ads shown on the site, not paying to advertise it
elsewhere). Timothy has a Google account and is walking through AdSense
signup himself (account creation isn't something Claude can do on his
behalf); once he has a publisher ID and/or ad-unit codes, those get
wired into the site and a placement design (banner, interstitial
between battles, etc.) gets worked out then.

**Real blocker hit 2026-08-22, mid-signup:** AdSense rejected
`rpg.burghertime.com` and required the root domain `burghertime.com`
instead — which had no content at all (confirmed via `dig`: no
A/AAAA record, nothing hosted there, only `rpg.burghertime.com` and MX
records existed on the zone). Fix in progress: a small standalone
landing page (`~/funstuff/burghertime-landing/index.html`, not part of
this repo — self-contained, links to `rpg.burghertime.com`) for Timothy
to deploy manually as its own Cloudflare Pages project with
`burghertime.com` as its custom domain (chose the quick manual-deploy
path over a full new repo+CI setup, since it's a one-page site that
rarely changes). Not yet confirmed live as of this writing.

**Update 2026-08-23:** Landing page is live at `burghertime.com` (its
Cloudflare Pages project was actually direct-upload only, no Git
connection, despite an earlier assumption otherwise — fixed by giving
`burghertime-landing` its own `wrangler`-based GitHub Action, same
pattern as this repo's `emoji-rpg` deploy; see that repo's README for
detail). AdSense's verification script snippet (`ca-pub-1050250477422916`)
is placed in that landing page's `<head>` and confirmed live/executing —
verification and "Request review" submitted in the AdSense console,
review pending as of this writing. Consent message (EEA/UK/Switzerland)
configured using Google's certified CMP with the 3-choice preset
(Consent / Do not consent / Manage options) — chosen over the 2-choice
preset specifically because regulators have flagged banners without an
equally-prominent reject option as a compliance risk.

**Placement decision, Timothy's explicit call, 2026-08-23:**
- **No interstitials.** Ads should be a persistent, always-there banner,
  not anything that interrupts play (rules out Google Auto ads'
  "Vignette ads" format specifically — that's Google's name for
  full-page interstitials).
- **Ads only on `rpg.burghertime.com` (the game), not on the
  `burghertime.com` splash/landing page.**

  **Correction 2026-08-23, confirmed directly in the AdSense console:**
  first floated the idea of adding `rpg.burghertime.com` as its own
  entry in AdSense's Sites tab to get independent Auto-ads control per
  subdomain — wrong. Timothy tried it and AdSense's Sites management
  operates at the registrable-domain level, not per-subdomain:
  `burghertime.com` already covers `rpg.burghertime.com`, and adding the
  subdomain separately is rejected outright ("you've already added this
  site"). There is no per-subdomain Sites entry in this AdSense UI.

  Actual plan given that constraint: (1) turn **Auto ads off entirely**
  for the domain (Ads → Auto ads settings, not Sites) — since Auto ads
  is domain-wide, this is what stops any automatic insertion (including
  Vignette) on either subdomain, and keeps the splash page ad-free with
  certainty. (2) Once the account clears review, create one manual ad
  unit (Ads → By ad unit → Display ads, a fixed banner size, not an
  auto-sizing one) and paste only that specific unit's `<ins>`/script
  snippet into `rpg.burghertime.com`'s game code — never into the
  landing page. That's the actual mechanism for "ads only on the game,
  in exactly one banner spot, no interstitials," since per-subdomain
  targeting isn't available at the Auto-ads/Sites level. The
  verification script already in the landing page's `<head>` can stay
  permanently — it's the ownership-check script, not an ad placement,
  and won't insert anything once Auto ads is off. Not yet done — blocked
  on the account clearing review first; no ad-unit code exists to wire
  into the game yet.

- **`ads.txt` added 2026-08-23** to both `burghertime-landing`'s deploy
  (`google.com, pub-1050250477422916, DIRECT, f08c47fec0942fa0`, live at
  `burghertime.com/ads.txt`) and this repo's (same line, deployed
  alongside the game at `rpg.burghertime.com/ads.txt`) — added
  defensively to the game's own domain too since some ad systems check
  `ads.txt` per exact serving subdomain rather than only the
  registrable root.

### SEO — still-open follow-up
(The SEO pass itself shipped 2026-08-22 — see BACKLOG_SHIPPED.md.)

**My own suggestion, raised alongside the SEO pass, still open:**
- **Basic privacy-friendly analytics** (e.g. Cloudflare Web Analytics)
  — without traffic data there's no way to tell whether the SEO pass or
  ads are actually doing anything. Checked against Cloudflare's own
  docs, 2026-08-22: "Available on all plans", confirmed free. Timothy
  is retrieving the setup token/snippet from his Cloudflare dashboard
  to hand over for wiring in — not done yet, no code changes made.

### Gameplay analytics (Google Analytics), opt-in with an explicit consent setting, raised 2026-08-28
Distinct from the Cloudflare traffic-analytics item above - that one's
about site traffic/SEO/ad effectiveness (aggregate, no consent needed).
This one is about actual *gameplay* telemetry: Timothy wants to know how
people are actually playing and doing - are they playing at all, what
level they reach, whether they get the axe/pick/canoe, whether they fight
(and beat) the dragon, how fights are going for them generally. His own
words: "Maybe we have a 'allow analytics' setting somewhere and explain
what we collect and why" - explicitly wants this opt-in with disclosure,
not silently on by default. Not designed yet - open questions: which
specific events to track (level-up, first tool pickup ×3, dragon
fight/outcome, and "how they are doing on fights" is vague - win/loss
rate? HP left? something from the existing balance-simulator's own
signals?), where the opt-in toggle lives in the UI (no settings screen
exists today - closest precedent is the logout/switch-character flow),
and how consent state persists (per-save? per-browser via localStorage,
alongside `state`?). Needs its own design pass before implementation.

**Update (2026-08-28):** motivated by a concrete balance question now,
not just "know how people are playing" in the abstract. Timothy, playing
the latest build himself: "I got to the axe I think by level 7 or 8 and
then I'm close to getting the pick at level 9. So we should probably
tune monsters in those areas differently so they are too hard until you
are the appropriate level." Zone 1's tool-gate order is fixed by design
(axe first, then pick, then both together unlock the boat, boat unlocks
the dragon) - the ask is for the monsters guarding/surrounding each
gate's screens to actually gatekeep by difficulty, not just by requiring
the tool item itself, so a player can't wander into axe/pick/boat
territory underleveled and steamroll (or get steamrolled by) it. Also
raised in the same note: "We might need more enemies too, not just the
modified current ones" - the existing per-zone monster pool may be too
small to express a real difficulty gradient across the screens leading
to each gate without just reskinning stat multipliers on the same few
monsters.

The other new piece: "we should collect data as I play... give me a
command to extract it for you" - wants his own local play sessions
instrumented (level reached, timestamp of each tool pickup, fight
outcomes) with some export path (a console command? a downloadable
file? not specified) so this session's own gameplay can be handed back
for tuning, distinct from the opt-in-with-consent GA idea above which is
about *other* players once the game has real traffic. "Maybe this ties
to our Google Analytics and we can use the data for both" - his own
instinct that the local-extract mechanism and the opt-in GA telemetry
above should probably share one underlying event-tracking
implementation (same events, two different sinks: a local
export/console command for his own dev-mode use now, GA for aggregate
player data once opted-in players exist), rather than being built
twice.

**Update (2026-09-01/02): the local-extract half shipped, GA half
didn't.** `js/systems/telemetry.js` + the Settings screen's "Copy Play
Log" button (0.17.0-0.17.2, see BACKLOG_SHIPPED.md's "Local + live
playthrough telemetry logging" section) is exactly this local-collection
mechanism - event catalog, session buffer, clipboard export. It
deliberately did *not* build on Google Analytics or any third-party sink
(see that section for the reasoning) - so the "share one implementation
with GA" idea above never got tested, and the opt-in-with-consent GA
telemetry for *other* players (the rest of this whole entry, both the
2026-08-28 and 2026-08-28-update paragraphs above) is still fully open,
not started.

## Audio / sound, raised 2026-09-02/03

Full sound-effects and music request, brainstormed and built out
2026-09-02/03. Design docs: `docs/superpowers/specs/2026-09-03-audio-
asset-catalog-handoff.md` (the full content catalog — every sound/music
cue, mapped to prompt ideas for local generation) and
`docs/superpowers/specs/2026-09-03-audio-engine-design.md` (the
playback engine). Implementation plan:
`docs/superpowers/plans/2026-09-03-audio-engine.md`.

**Shipped 2026-09-03 (0.20.0), but gated off by default.** The full
Web Audio engine (`js/systems/audio.js`, `js/data/soundManifest.js`) —
category volume/mute (Combat/UI/World/Music), a theme-aware manifest
with lazy per-theme loading and default-theme fallback for partial
packs, music crossfade, and the 7 already-existing visual-effect
functions wired to real `playSfx` calls. All of it sits behind a new
"🚧 Feature Flags" section in Settings (`audioBeta` checkbox, off by
default) — Timothy's own call, chosen over a hidden secret-URL unlock,
since this is a tiny project with a few known players and an
in-progress toggle is fine to show. `initAudio()` never runs at all
with the flag off, so the whole system is completely inert until
turned on. A final whole-branch review caught and fixed one crash risk
(unguarded `AudioContext` construction on the game's boot path) plus
several cross-task integration bugs (a basic attack double-playing its
hit sound, a non-idempotent theme switch wiping the buffer cache on
every settings change, redundant concurrent fetches on AOE hits) —
none of it ever shipped live, all fixed before the first push.

**Sourcing real audio — first assets shipped 2026-09-10 (0.31.0), the
rest still in progress on Timothy's home RTX 5090 machine.** Plan:
curate hits/footsteps/UI/potion sounds from CC0 libraries (Kenney.nl,
Freesound, OpenGameArt) — diffusion models are weak at sharp percussive
transients, a real recorded sample beats a generated one there.
Generate the 4(+ area) music loops with ACE-Step 1.5, and experiment
with bespoke one-off SFX using Stable Audio 3 Small SFX (the closest
thing found to a real upgrade over general text-to-audio for impact
sounds specifically). Full catalog with per-sound prompt ideas in the
asset-catalog-handoff doc above.

**Shipped 2026-09-10 (0.31.0)** — 21 clips for 7 of the ~55 catalogued
sounds: the basic attack hit, all four ability swings, Faultline's own
`abilitySweepImpact`, and a battle-start stinger. Plus `SOUND_VARIANTS`,
which lets one sound id carry several takes that playback rotates
between (never the same take twice in a row) — `hitNormal` fires
constantly and one sample on a loop is the classic giveaway.

Two findings from that session worth not rediscovering:
- **Never ask the model for a sub-second clip directly.** Requesting
  0.25s from Stable Audio 3 produces aliased garbage — described at the
  time as "compressed", "old modems", "computery". Generate at ~3s and
  hard-trim afterward; only the trim length should vary.
- **EzAudio was evaluated and rejected for this use.** MIT-licensed and
  it benchmarks well on general text-to-audio, but it's trained on
  AudioCaps-style ambient content rather than foley, and its output for
  punchy combat transients was bad even after the duration bug above was
  fixed. Stable Audio 3 Small SFX's ~1.28M real recorded foley samples
  are the reason it wins here. Don't re-run that experiment without a
  new reason.

Tooling for all of this lives outside this repo, in its own local git
repo at `C:/Users/tim/git/emoji-rpg-audio`: catalog-driven generators
keyed off this repo's own `soundManifest.js` sound ids, a browser
audition tool (listen through candidates grouped by the sound the game
needs, Yes/No/★ tracking that auto-saves to disk), and an installer that
converts picks to mp3 and drops them into `assets/audio/` under the
filenames the manifest expects. Its `HANDOFF.md` is the entry point.

**Open audio follow-ups, raised 2026-09-10:**
- **Re-render the shipped ability sounds shorter.** They went out at
  1.0s, generated long deliberately so the different style directions
  were distinguishable while picking. Combat is much faster than that —
  Timothy's own steer was under a second, ideally 250-500ms — so they
  likely read as sluggish in real fights. Faultline is the sharpest
  case: it resolves as a staggered walk across every living enemy
  (`SWEEP_STAGGER_MS`, 260ms apart), so its per-enemy impact has to be
  shorter than that or consecutive hits smear together. The generator
  takes `--duration`, so re-rendering the same picks shorter is one
  command.
- **Narrow Lacerate to one style.** `abilitySwingSlash` shipped with 8
  takes mixing three different sonic directions (two older generic ones
  plus "visceral" and "flesh" from the style matrix). Rotation across
  inconsistent takes can read as incoherent rather than varied.
- **Pick the remaining ~48 sounds.** Only 7 of the catalogue have any
  chosen audio. Two ids have no generated candidates at all under the
  current model — `eliteEncounterSting` and `celebrationGeneric`, both
  added to the manifest after the original prompt catalog was written.
- **Curate the four CC0 sounds** the asset-catalog doc deliberately
  excludes from generation: `itemPickupCommon`, `questTurnIn`,
  `shopTransaction`, `walking`.
- **Music is generated but none is picked or installed.** 20 ACE-Step
  candidates exist for each of the 9 themes. Open design question raised
  while listening: regular battles are short and boss fights are long,
  so a player may never hear a whole battle track. Suggested direction —
  write `battleTheme` as a short seamless loop built to repeat and save
  the long-form structure for `bossBattleTheme`, rather than lengthening
  regular battles to fit the music.

**Still open once assets exist:**
- Flip Timothy's own `audioBeta` flag on, playthrough with real sound,
  tune volumes/mixes — only after that does flipping the *default* to
  `true` for everyone make sense.
- Wiring the rest of the catalog into gameplay call sites — menu nav/
  select, dialog close, potion use, walking footsteps, parry success/
  fail, timing-ability success/fail, discovery/cache/comeback, elite
  encounter sting, and the area-music transitions (town/overworld/
  battle/boss/dungeon themes on screen and encounter changes).
  Deliberately deferred past the first plan — needs its own pass, see
  that plan doc's own "Follow-up work" section.
- Additional sound themes (metal/symphony/chiptune raised as ideas) —
  the manifest's plumbing already supports them (drop files, add one
  manifest entry, zero code changes), but no theme besides the default
  has any real content yet.
- `playMusic`'s re-entrancy: two overlapping `playMusic` calls before
  the first's `loadBuffer` resolves can orphan a track (caught in final
  review, latent today since no music call site exists yet) — worth a
  fix before the area-music-transitions item above starts.
- ~~`js/data/soundManifest.js` hardcodes `'realistic'` in its path
  helpers instead of deriving from `DEFAULT_THEME`.~~ **Shipped
  2026-09-03 (0.20.1)** — `sfxPath`/`musicPath`/`SOUND_THEMES` now all
  derive from `DEFAULT_THEME`.
- Manifest sound ids use pre-0.19.0 ability names (`abilitySwingStab`
  etc.) rather than the current display names (Impale/Sever/Lacerate/
  Faultline) — internally consistent, just a translation note for
  whoever names the actual asset files.
- Settings panel CSS: the new Sound/Feature-Flags rows have no
  dedicated styling, and `.overlay-panel` has no `max-height`/
  `overflow-y` — worth a look on a small viewport once the panel's
  final row count is settled.

## Cross-device save sync, raised 2026-09-09

Timothy wanted to load his character on a different computer without
manually copy/pasting the save JSON between them. Discussed several
storage/auth options (Cloudflare Workers KV vs. GitHub Gist; Sign in with
Apple - $99/year Apple Developer membership required, ruled out - vs.
Google Sign-In vs. no login), then **built, scoped down, and shipped
live the same session (0.27.0)**, ending on a code-transfer-only design.

**Shipped design:** a one-shot "Start Transfer" flow, not a standing
save-slot address:
- Settings (behind the `cloudSaveBeta` flag, same pattern as
  `audioBeta`/`mechanicExplainersBeta`) has a "Start Transfer" button.
  Clicking it generates a fresh 4-character lowercase code
  (`generateSaveCode`, `js/systems/cloudSave.js`) and PUTs the current
  character to Cloudflare Workers KV under it
  (`functions/api/save/code/[code].js`), showing the code with a live
  countdown.
- The other browser types that code into a "Load" field. A successful
  load **adds the character as a brand-new slot** (`importSlot`,
  `js/systems/saveSlots.js`) rather than overwriting anything already on
  that browser - raised mid-build: "be cool to do this in a way that you
  can transfer from whatever number of other browsers you want and it
  just adds all the characters to your list." No page reload needed,
  since it never touches the live in-memory game state.
- **The code is only live for 60 seconds** after Start Transfer, enforced
  server-side via KV's own `expirationTtl` (its own hard minimum, not a
  chosen default) - raised mid-build after Timothy flagged that an
  unauthenticated, indefinitely-guessable 4-char code (36^4 ≈ 1.68M
  combinations) is a real griefing vector ("someone could just make some
  sort of script that keeps hitting our save/load thing until they find
  one and then delete everyones character"). Combined with a per-IP rate
  limiter (`functions/_shared/rateLimit.js`, ~20 req/min, backed by the
  same KV namespace) shared across both routes, a code is only guessable
  during the narrow window someone happens to have an active transfer
  running, not ever. This isn't a hard security boundary (KV reads/writes
  aren't atomic, so a fast concurrent burst can slip a few requests past
  the counter, and a many-IP distributed attacker isn't slowed at all) -
  it's a deterrent sized to "keep a casual single-script sweep
  impractical," matching how low-stakes this feature actually is.
- Deliberately **no exclusion of visually-similar characters** (0/o, 1/l)
  in the code alphabet - matches exactly what was asked for rather than
  second-guessing it.

**Google Sign-In was scaffolded then removed the same session** (verified
server-side via Google's tokeninfo endpoint, `sub`-keyed KV storage,
Google Identity Services button) - Timothy: "I think we can remove the
google thing for now as well... don't want to load google stuff if we
don't need to at this point." Fully deleted, not just disabled - no
Google script/endpoint is reachable from anything currently shipped.
Revisit if a real cross-browser-without-typing-anything option is wanted
later; the removed design (client `saveByGoogle`/`loadByGoogle`/
`renderGoogleSignInButton`, function `functions/api/save/google.js`) is
recoverable from this session's history if needed, but nothing here
depends on it existing.

**Also cleaned up the same session, at Timothy's request:** `ads.txt`'s
real AdSense publisher ID (`pub-1050250477422916`) was cleared to an
empty placeholder file - no AdSense integration is actually wired into
the game (see the AdSense backlog entry below, still not started), so
there was no reason to keep a live publisher ID sitting in a deployed
file. The real line is preserved in a comment in `ads.txt` itself to
restore if/when AdSense actually ships.

**Setup completed and shipped 2026-09-09 (0.27.0).** Timothy ran
`wrangler login` himself (this session had no Cloudflare credentials of
its own and couldn't complete that interactive OAuth step); once
authenticated, this session drove the rest via CLI: confirmed the
authenticated account actually owned the `emoji-rpg` Pages project
(`wrangler pages project list`) before creating anything, ran
`wrangler kv namespace create SAVES`, filled the returned id into
`wrangler.toml`, and - rather than trusting it blind - deployed a
*preview* build first (`wrangler pages deploy dist --branch=preview-
cloud-save`, a non-production branch so it never touched the live site)
to verify the real thing end-to-end: PUT/GET round-tripped correctly,
an invalid code format 400'd, an unused code 404'd, and the 60-second
KV expiry was confirmed by actually waiting past it and re-checking.
Pushed to `main` only after all of that passed.

## Faultline's sweep locks out other abilities, raised 2026-09-10

Raised: "while faultine is going from enemy to enemey you shoudl still
be able to use other ablities, seems like it pasues you being able to do
other stuff."

Confirmed in the code, not just a feel thing. `playerUseAbility`
(`js/screens/battleScreen.js`) sets `abilityActionInFlight = true` for
the whole duration of an ability's resolution and only clears it in the
`finally` at the end. Faultline (`sweep`, `js/systems/abilities.js`) is
`aoe: true` and walks the living enemies one at a time, `await
sleep(SWEEP_STAGGER_MS)` between each - `SWEEP_STAGGER_MS` is 260ms, so
against a full row that's roughly a second-plus where the guard stays
set.

Everything that checks that guard is dead for that whole window:
- every other ability (`playerUseAbility`'s own `if
  (abilityActionInFlight) return;`)
- Attack (`playerAttack`)
- Flee (`playerFlee`)

So the lockout is real and scales with how many enemies are in the
fight - i.e. it's worst exactly when Faultline is most worth casting.

Note the one existing carve-out to model a fix on: Lacerate's retrigger
press is deliberately checked *before* the guard, with a comment
explaining it's safe because `handleLacerateRetriggerPress` only touches
`buffState`/log/menu and never combatant hp/atb. A general fix needs to
decide what's actually being protected against - the guard exists for
re-entrancy (two resolutions interleaving mid-`await` and corrupting
hp/atb), so "just remove it" isn't right. Plausible directions, none
chosen:
- Make the guard per-ability rather than global, so Faultline blocks
  only a second Faultline.
- Keep the guard only around each individual hit's state mutation
  instead of spanning the `await`s between hits.
- Resolve the whole sweep's damage up front and let the staggered
  visuals play out purely as animation, with no in-flight guard at all.

The shared ability GCD (`abilityGcdMsForSpeed`) already exists as the
intended pacing limiter, which is an argument that this lockout is
incidental rather than a designed cost.

## Delete the DOM map renderer scaffolding, raised 2026-09-10

The canvas map renderer (0.29.0) deliberately kept the old DOM/CSS-Grid
renderer alive rather than deleting it, so the two could be A/B'd live
on the same save in one build via `?renderer=dom`. That was scaffolding
for the rewrite, and the rewrite is now confirmed — Timothy has been
playing the canvas version live since 0.29.0.

What comes out, as one clean deletion:
- `js/screens/mapDomRenderer.js` (~500 lines) in full.
- `resolveRenderer`/`readRendererParam` and the `renderer` prop in
  `js/screens/mapScreen.js`, which then always uses the canvas renderer.
- The `.map-tile*` / `.map-grid` rules in `css/styles.css`, including
  the keyframe blocks the canvas renderer replaced with draw-loop tweens
  (`map-tile-levelup-pulse`, `map-levelup-rays-burst`,
  `map-well-heal-ring`, `map-well-heal-glow`,
  `map-tile-player-portal-pull`, `map-tile-quest-glow`,
  `map-tile-portal-shadow`). `.map-flee-emoji` **stays** —
  `playMonsterFleeEffect` is still a real `document.body` element under
  both renderers on purpose, since it's meant to fly outside the map
  viewport.
- `tests/mapScreenDom.test.js`'s rendering assertions, which are pinned
  to `renderer: 'dom'`. Its *behavior* tests (keydown → action, town
  exits, encounter cooldown, zone-1 tracking, gate crossing) are
  renderer-agnostic and must be kept — re-point them at the canvas
  renderer rather than deleting them with the file. The canvas
  equivalents of the rendering assertions already exist in
  `tests/mapDrawList.test.js` and `tests/mapTrail.test.js`.

Worth doing deliberately rather than opportunistically: `mapScreen.js`
routes through a renderer interface precisely so this is a contained
removal, and that interface is also what would make a future WebGL
painter a swap rather than a rewrite. Removing the second renderer is
fine; collapsing the interface itself is a separate decision.

## Residual walk micro-stutter, raised 2026-09-10

**Fixed 2026-09-10 (0.32.4).** Worth reading as a diagnosis that was
wrong, because the wrong answer was written down here confidently and
would have cost a lot to act on.

**What this entry used to say** (kept verbatim, because it was the
accepted position for a day): the residual was blamed on `mapScreen`'s
walk loop and the renderer's draw loop being two separate
`requestAnimationFrame` registrations, so within a single frame a step
could land either side of the hero advance. Closing it was thought to
mean merging the two loops — real coupling between input and the
renderer, which the DOM renderer and the jsdom tests don't have — so it
was marked accepted, on Timothy's own "there is still some microstutter
which isn't a huge deal ... don't really notice/bother me."

**What it actually was.** Timothy came back to it: "both the map and
character are a little stuttery and maybe the issue is we need to tie it
all together." There was a third clock, and nobody had looked at it. The
camera aimed at `computeViewportOrigin`, which is computed from the
hero's *logical tile*, so its target jumped a whole tile the instant a
step landed; its exponential ease then sprinted right after each step and
crawled just before the next. The hero's stride is deliberately constant
speed. Two velocity profiles for one motion, ~9Hz apart, and what the eye
sees is the difference between them.

The reason it hid for so long is a measurement gap, not a subtle
mechanism: the camera had been measured on its own and the stride had
been measured on its own, and each looked fine. The composite — the
hero's position **on screen**, `hero - camera` — had never been measured
at all, and it is the only one of the three a player can actually see.
When a system's parts each pass and the whole still feels wrong, measure
the thing the eye receives.

**The fix** is `computeCameraOrigin` (`js/systems/world.js`): the same
placement arithmetic as `computeViewportOrigin` but centred on a
fractional tile, with the camera pointed at the hero's interpolated
position through it. Deliberately identical arithmetic rather than a
rewrite, so the two agree *exactly* once the hero lands on a whole tile —
otherwise a glide of 0 would settle the camera somewhere different from
where it has always settled. `frame()` was also reordered: the hero
advances first, the camera then aims at where the hero now is.

Measured over 20s of held-key walking at the default glide: per-frame
spread of the hero's on-screen position 2.80px → 0.18px, of the map's
scroll 3.10px → 1.33px, against realistic frame jitter. Against clean
vsync both go to exactly 0.00 — every frame moves the map the identical
distance. The residual in the jittered case is the injected dropped
frames themselves.

**The two loops are still two loops, and that is now a measured
decision rather than an unexamined one.** Driving the hero's sub-tile
position straight off the walk accumulator's own phase (which removes
the stride's arrival clamp entirely, and is the closest cheap stand-in
for merging the loops) scored *identically* to the camera coupling alone
at every glide setting tested. The arrival clamp is not a material term
once the camera is coupled. Don't pay for that coupling on the strength
of this entry's older text.

**Also landed with it:** the canvas renderer's `frame()` has integration
coverage for the first time. jsdom returns null from `getContext('2d')`,
so the loop no-opped out on its first line in every existing test —
every pure function was covered and the wiring between them was not,
which is exactly where this bug lived. `tests/mapWalkSmoothness.test.js`
gives it a recording stub context and a hand-driven animation-frame
queue. Note the queue: a single-callback rAF stub silently drops one of
the two competing registrations and the character never takes a second
step, which cost a debugging round to spot and will again.

## Hero draws over obstacles in the row below, raised 2026-09-10

A deliberate tradeoff, logged in case it ever looks wrong. The canvas
renderer draws the hero (and anything riding with them, e.g. the boat) in
a final pass after every tile. It has to: the hero is drawn at an
interpolated position, so mid-stride they overhang a neighbouring tile,
and walking up or left that neighbour is painted *later* in row-major
order — its ground fill was slicing the character in half on every other
step, which read as blinking.

The cost is that a tall obstacle in the row below no longer paints over
the character's feet, which the old row-based depth sort arranged. Losing
sight of your own character behind a tree is clearly worse than losing a
subtle occlusion cue at this sprite size, so the tradeoff went this way.

If it ever wants fixing properly, the real answer is a y-sorted object
pass: draw all floor layers (ground, trail, glows) for every tile first,
then sort the sprite layer by each sprite's own visual anchor — the hero
sorting by their interpolated position rather than their logical tile.
Note one thing before attempting it: the current per-cell order means a
tile's ground clips its neighbour's trail stroke where the round cap
overhangs the tile edge, so a naive floor/object split visibly changes
how trails end at unvisited tiles. Check that against a real save.
