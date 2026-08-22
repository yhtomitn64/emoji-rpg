# Backlog

Ideas, bugs, and follow-ups raised mid-session that aren't part of the
current plan. Not prioritized — just captured so nothing gets lost.

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
effect: `js/screens/celebrationEffect.js`.)*

### Fun animation for items landing in inventory
Wants something like items visibly "flying into" the inventory when
received (a drop, a quest turn-in, etc.) instead of just appearing in a
list. Deliberately **not** built alongside the first-kill/level-up
celebrations above, even though it was originally grouped with them —
those two are screen-independent (a generic burst + banner, fireable
from anywhere, no specific DOM element required). This one is
different in kind: "flying into inventory" implies an actual animated
path toward a real target, and the only always-present, stable target
is the HUD's Inventory button — but the natural trigger point (a drop
resolving in `handleBattleEnd`) already runs *after* the battle screen
has unmounted, so there's no live "item icon" starting position to
animate from. Needs its own small design pass (e.g. a lighter toast/pop
near the HUD button instead of a literal cross-screen flight path)
rather than reusing the burst effect as-is.

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
- Currently there is exactly one zone (the 3x3 wilderness grid from
  `docs/superpowers/specs/2026-08-12-world-expansion-design.md`) and one
  boss (the dragon, with 3 tiers via the existing boss-rematch system).
  "Zone 2/3/4" means genuinely new content, not reuse — a much bigger
  scope than anything else currently in this backlog.
- **Randomize the dungeon entrance's location per new character. Shipped
  2026-08-18.** New saves now roll `state.dungeonEntrancePosition` once
  at creation among the 4 corner screens' grass tiles
  (`js/systems/dungeonEntrance.js`); the old hardcoded southeast `D`
  tile is gone. Legacy saves backfill to the historical southeast
  (24,10) spot unchanged. Design:
  `docs/superpowers/specs/2026-08-18-randomized-dungeon-entrance-design.md`.
  Plan: `docs/superpowers/plans/2026-08-18-randomized-dungeon-entrance.md`.
  First piece of the larger multi-zone-progression idea to ship — the
  per-save placement pattern established here is reusable if/when new
  zones get built.
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

### Smaller, sooner: a dragon-zone (dungeon) shortcut using the axe, and better tool-drop flavor
Two related, more immediately actionable ideas raised alongside the
multi-zone discussion — smaller than a new zone, could happen well
before that bigger pass:

- **A shortcut in the dungeon/boss area usable once you have the axe.**
  The existing tool-gating pass (`docs/superpowers/specs/2026-08-16-
  metroidvania-tool-gating-design.md`) explicitly only touched the 9
  wilderness screens, not the dungeon itself — this would be the first
  gate placed in dungeon territory.
- **It's currently not obvious you can even use the axe/pick, or where.**
  Wants flavor text when standing in a zone/tile where a tool-gate is
  usable, so the player notices the option instead of walking past it.
  Also wants the *drop moment itself* to be made special — right now
  `miningPick` (orc, `js/data/monsters.js:59`) and `axe` (wraith,
  `js/data/monsters.js:71`) drop like any other material, with no
  indication of what they unlock. Wants a distinct "this is a big deal"
  moment on pickup that tells the player what they're about to be able
  to do with it.

## Bugs

*(none open right now — the boss-tier skip bug and the inventory-panel
scroll bug were both fixed 2026-08-17, see CHANGELOG.)*

## Feature requests

*(Everything that was originally in this section shipped 2026-08-17;
see CHANGELOG. One thing was dropped rather than shipped: swapping
monster emoji to match their silly food names — Timothy likes them as
they are, e.g. "Slippery Breadstick" for the snake. Not tracked
anywhere; revisit only if it comes up again for a future zone. Two new
items below, raised mid-combat-pass.)*

### Log out / back to title screen, to switch characters
No way to leave the current character and get back to the start
screen's slot list without closing the tab. Needs a HUD/menu action
that unmounts back to `mountStartScreen()` (js/main.js) — presumably
with a confirmation given it's mid-game, not a destructive action but
an unexpected one if triggered accidentally.

### Hero emoji picker needs way more options, including skin tones
The current picker (`HERO_EMOJI_OPTIONS` in js/state.js) is a curated
list of 8 emoji with no skin-tone variants. Wants a much larger
selection and real skin-tone support. Unicode skin-tone modifiers
(U+1F3FB–U+1F3FF) only apply to emoji that support the Fitzpatrick
modifier (person/hand gestures do; animals, objects don't) — worth
checking which of a larger candidate list actually renders distinct
tones across browsers before committing to a big list, since a modifier
silently no-ops on unsupported base emoji.

### Shop: equip gear right after buying it, or offer to
Buying a piece of gear currently just adds it to inventory — you have
to separately open Inventory and equip it. Wants either auto-equip on
purchase, or (Timothy's own "even better") a "Equip now?" prompt right
after the buy. Note: auto-equipping outright would reverse a deliberate
call from `docs/superpowers/specs/2026-08-16-inventory-equipment-
design.md`, which specifically *removed* auto-equip on pickup in favor
of manual choice — so an opt-in per-purchase prompt (not silent
auto-equip) is the version that doesn't relitigate that decision.

### Level-up and general animation pass, raised 2026-08-20
Timothy: "need more than just a start for level up, character
animation. Hero size enlarges on map temporarily, light shoots out, big
level up words in a cool style with embossing or something. Moving
forward lets really start to spike up animations and things." Framed as
a forward-looking initiative, not a single fix — bundles with the
existing "Fun animation for items landing in inventory" idea above under
the same "give more moments a real animation" theme. Also raised in the
same note: get creative with the map's tile emoji (grass variety instead
of one repeated green square, possibly zoom/placement variation) —
related but separate from the level-up animation itself, both about the
map/battle screens feeling more alive.

### Fast-travel back to the dungeon entrance after death, for a gold cost
Timothy, 2026-08-20: "I think we should be able to port back to start of
dragon cave after you die for a gold sum." Today, a loss warps the
player back to town unconditionally (`handleBattleEnd`'s `'lost'`
branch in `js/main.js`) — this would add a paid option to return
straight to the dungeon entrance instead, skipping the walk back.
Ties into the now-shipped randomized-dungeon-entrance work (the
"dungeon entrance" is a per-save `state.dungeonEntrancePosition` now,
not a fixed tile) — a return-to-dungeon warp needs to target that
per-save position, not a hardcoded one.

### Flavor-text nudge near tool-gated tiles, raised 2026-08-20
Timothy: "maybe when you get close to mountain, tree some flavor text
comes up remind folks to go near it to use your tool. It's not
obvious." Tool gates (mining pick on mountain tiles, axe on thicket
tiles, per `docs/superpowers/specs/2026-08-16-metroidvania-tool-gating-
design.md`) currently only communicate on contact (locked-gate message
if you lack the tool, cleared-gate message if you have it) — this asks
for an earlier, proximity-based hint before the player actually walks
into the tile, since right now there's no signal the tile is
interactive at all until you try it.

### Choose which dragon strength to fight, raised 2026-08-20
Timothy: "I should be able to choose to fight the different dragon
strengths." Boss-rematch tiers already exist (`state.bossTier`,
`js/systems/bossTiers.js`, 3 tiers) but today the tier is presumably
fixed/sequential per rematch rather than player-selectable — needs a
look at how `bossTier` currently advances and how `startBossFight()` in
`js/main.js` picks which tier to fight before designing a selection UI.

## Quests / economy

### Quest turn-in scaling: more kills required each level, rewards scale up but with diminishing returns
Timothy, 2026-08-17: each quest turn-in should require more kills for the
next level, and rewards should keep growing too but by less each time, so
grinding quest levels gets progressively less worth it rather than staying
flat-value forever. Needs a look at `js/systems/quests.js` for the current
kill-requirement/reward curve before designing the new one.

### Sell unneeded crafting materials once upgrades are maxed
Wants a way to offload materials that are no longer useful after hitting max
smith upgrades - either a manual sell option, or the game offers/prompts an
auto-sell once it detects upgrades are maxed. Needs a look at
`js/screens/smithScreen.js` (upgrade-max detection) and the
inventory/shop-sell path (if one exists yet) before designing.

## Combat pass ideas
Several related mid-combat ideas, raised together as things to think
through in a dedicated future combat pass rather than one-off adds:

- **Potions currently cost a full turn like an attack.**
  `playerUseItem()` (js/screens/battleScreen.js:189) resets
  `playerCombatant.atb = 0`, same as `playerAttack()`. Wants potions
  taken off the shared turn-cooldown so you can drink one anytime
  without losing your turn.
- **Potions should be able to crit-heal occasionally.** Currently a
  potion always heals a flat amount with zero variance
  (`ITEMS.potion.heal = 15`, js/data/items.js:26, applied directly with
  no roll at js/screens/battleScreen.js:187-189) — no crit chance, no
  damage-style variance like attacks already have
  (`rollCrit`/`applyCritMultiplier`, `CRIT_CHANCE`/`CRIT_MULTIPLIER` in
  js/systems/combat.js). Wants an occasional bonus-heal roll reusing
  that same crit system rather than a bespoke mechanic.
- **Themed attack animations per monster — projectile vs. melee.**
  Eight-Leg Eggroll (spider) should animate throwing eggrolls at the
  player; Mean Meatball (goblin) throwing meatballs; etc. — matching
  each monster's silly name/flavor rather than the generic hit-flash
  every monster currently shares (`playHitEffect`,
  js/screens/battleScreen.js). Longer-term: some monsters throw things
  (ranged), others should visibly move in to melee, rather than every
  attack playing out identically regardless of monster type.
- **Attack-mash fatigue.** Repeatedly mashing the attack button should
  incur an "out of breath" penalty, discouraging pure spam-clicking.
- **Swing-timer knockback on hit.** Landing a hit knocks the enemy's ATB
  gauge back slightly; getting hit knocks the player's back slightly —
  small and non-stacking so neither side gets fully locked out.
- **Timer-speed items.** Droppable gear that speeds up your own gauge or
  slows the enemy's, capped so speed can't stack infinitely — a build
  choice between "faster me," "slower them," or other effects.
- **Bonus damage at high swing-timer speed.** If timer-speed investment
  scales high enough, grant a small damage bonus too, so speed stays
  worth investing in past a soft cap. Raised more tentatively than the
  others ("more for our combat pass to think through").
- ~~**Parry mechanic, raised 2026-08-18.**~~ **Shipped 2026-08-19.**
  Monster attacks now telegraph via a ~1.2s wind-up bar before landing,
  with a parry-able zone in the final 20% (`s` or click the bar). A
  successful parry fully negates the hit and reflects half the incoming
  damage back at the monster (bypassing its defense), plus resets the
  monster's ATB to empty. No cap/cooldown on attempts — shipped
  deliberately unlimited, to be tuned later against real playtesting of
  both this and the just-shipped abilities system, per Timothy's explicit
  call. Design: `docs/superpowers/specs/2026-08-18-parry-mechanic-design.md`.
  Plan: `docs/superpowers/plans/2026-08-18-parry-mechanic.md`.
  Known follow-up from final review (not blocking, documented in
  `js/systems/parry.js` and the balance-simulator comments): the wind-up's
  real wall-clock timing is ~1200ms with only a single 300ms tick actually
  landing inside the parry zone, due to tick-loop quantization — worth
  revisiting once there's real play data to tune against.
- ~~**Abilities gained on level-up.**~~ **Shipped 2026-08-18 (Phase 1,
  single-target).** Five fixed-order abilities — Stab (2), Chop (4),
  Slash (6), Sweep (8), Super Scream (10) — each with its own real-time
  cooldown independent of the ATB gauge, a rotation bonus around Super
  Scream's buff window, and a never-fails timing minigame. See
  `docs/superpowers/specs/2026-08-17-combat-abilities-design.md` and
  `js/systems/abilities.js`. Deliberately scoped to today's
  single-monster battles — **multi-enemy targeting is Phase 2**, a
  separate future project (see "Multi-mob encounters in zone 1" and
  "Multi-zone progression" above, since Slash/Sweep were specifically
  built to extend to real multi-target without rework once that lands).
- **Research: how do other games avoid pure exponential stat inflation?**
  Timothy, 2026-08-17, raised alongside the pacing-curve discussion —
  rather than only fighting "numbers get big and trivialize old content"
  by tuning the XP/stat curve tighter and tighter, look at how other
  games sidestep the problem structurally. Rough idea: as the player
  progresses, power could come increasingly from *ability/skill
  synergies* (qualitative build choices) rather than ever-bigger raw
  attack/defense numbers, so late-game power growth can stay flatter
  without old content going stale as fast. Its dependency (an ability
  system existing at all) is now satisfied by the Phase 1 abilities
  build above — this research is unblocked, though still explicitly
  rough/unrefined, a research question to explore before any design doc,
  not a spec'd idea yet.
- **Status log could snapshot effective stats/gear per entry.** A
  refinement of the now-shipped status log — right now an entry like
  "fought a boar, lost" can't help diagnose whether combat numbers are
  behaving as designed without knowing effective attack/defense/HP and
  equipped gear at that moment.
- ~~**Outclassed weak mobs should give up or flee, not just always fight
  to the death.**~~ **Shipped 2026-08-17.** A non-boss monster killable
  within 3 average hits now has a 35% chance per encounter to surrender
  (full win rewards), flee dropping loot (gold/item only), or flee
  empty-handed (nothing) — each with its own battle-log line and a
  shrink-and-slide flee animation on the monster's emoji. See
  `isMonsterOutclassed`/`resolveWeakMobEncounter` in `js/systems/combat.js`
  and the CHANGELOG. Verified end-to-end in-browser (all three outcomes),
  not just unit tests. Still overlaps with the "faster timer against
  weaker enemies" open question below for the fights below the surrender
  threshold that aren't quite trivial either — see the synthesis further
  down this file for how the two relate.
- **Weak-mob surrender/flee shouldn't open the battle dialog at all,
  raised 2026-08-20.** Timothy: "when the mobs are weak and you will
  auto kill don't even bring up the dialog. Just show them on the map
  and have them fly off the screen in random directions or something."
  A refinement of the shipped weak-mob-surrender feature directly above
  — today `resolveWeakMobEncounter` still fires from inside
  `battleScreen.mount()`, so the full battle overlay opens and closes
  again even though the outcome was already decided before the player
  saw anything. This asks for the decision to happen before the overlay
  ever mounts, with the flee/surrender animation playing on the map
  screen itself instead.
- ~~**Ability rotation redesign — combo chains, key ergonomics, and
  visibility, raised 2026-08-20.**~~ **Combo chains + Sweep AOE shipped
  2026-08-22; key ergonomics, Attack's role, and button info density
  remain open.** Timothy's own extended pitch after playing the shipped
  Phase 1 abilities: "the combat feels good but a little clunky. I don't
  really understand the different power levels of the abilities... not
  sure why I would use different single target or different multi
  target. Does one buff the other or what?" Several distinct threads in
  one note, kept together since they're all reactions to the same
  rotation:
  - ~~**Combo/buff chaining between abilities.**~~ **Shipped.** Stab and
    Chop, and Slash and Sweep, are now paired combo lanes: landing the
    setup (Stab or Slash) primes its payoff (Chop or Sweep) for a 1.5x
    damage bonus and lets it fire even before the swing timer is full;
    landing the payoff returns a smaller 1.15x bonus to the setup in
    turn, keeping the lane going if you alternate — matches the "1 and 3
    small, 2 and 4 big if primed, payoff also feeds back to the setup"
    shape from the original note. A primed ability's button glows and
    relabels itself ("Combo Ready" / "Bonus Ready") — the "indicator on
    what to hit next" this note asked for. Sweep also became a
    full-damage AOE hitting every living monster (the group-fight role
    flagged as a dependency when multi-mob-encounters shipped). Design:
    `docs/superpowers/specs/2026-08-21-ability-rotation-redesign-design.md`.
    Plan: `docs/superpowers/plans/2026-08-21-ability-rotation-redesign.md`.
  - ~~**Key ergonomics.**~~ **Shipped 2026-08-22.** "My fingers dancing
    from 1, 2, 3, 4, 5 back to a, s is a little funky... fingers are on
    1, 2, 3, 4 and I have to look down for 5." Super Scream now fires on
    Space instead of key `5` (digit keys `1`-`4` are unchanged for
    Stab/Chop/Slash/Sweep), is usable the instant it's off its own 30s
    cooldown regardless of the swing-timer gauge, and no longer resets
    the gauge when used — a genuinely free action layered on the
    rotation. `canUseAbility` gained an `alwaysReady` bypass
    (`js/systems/abilities.js`) for this.
  - ~~**What is Attack for?**~~ **Shipped 2026-08-22.** "I feel like we
    don't need it... or you make it auto attack or something that does
    trivial damage," with a follow-up alternate idea: Attack stays
    manual but usable off the global ability cooldown, dealing
    progressively less damage the more it's spammed unless "charged up"
    somehow. Went with the decay direction (no charge-up): Attack now
    drops the swing-timer requirement too, but each consecutive press
    (without landing an ability or letting the gauge refill first) deals
    less damage, floored at 40% of normal, with the live penalty shown
    on the button. New `attackStreakMultiplier` in `js/systems/combat.js`;
    `resolvePlayerAttack` gained an optional 4th `streakMultiplier` param
    (defaults to `1`, so `scripts/simulate-balance.js`'s existing calls
    are unaffected — the simulator doesn't model this new mechanic yet,
    same precedent as it not modeling abilities).
  - **Information density on the ability buttons.** Still open. Wants to
    see each ability's damage number next to its button before pressing
    it, plus icons per ability, plus a visual/animated effect on the
    button itself when pressed. Explicitly deferred out of the
    2026-08-22 pass as its own future polish item.
- **Timing-meter clarity and crit/damage-number visual polish, raised
  2026-08-20.** Two related requests: (1) ~~Timothy wasn't sure what the
  green zone at the end of the hero's own swing timer indicates, or
  whether there's a timing mechanic tied to it — worth a tooltip/label
  or other in-context explanation, not just discoverable by accident.~~
  **Shipped 2026-08-22**: the timing meter now shows a "Press Space!"
  label once its fill crosses into the sweet-spot zone, as part of the
  ability rotation redesign pass above. (2) Still open: damage numbers on
  a crit should "really pop," and damage numbers in general should be
  bigger, persist longer, and float higher (even above the dialog if
  possible) than they do today; crits could also trigger a bigger
  environmental reaction — trees swaying, the dialog shaking — to sell
  the hit's weight.
- **Death animation for a defeated enemy, raised 2026-08-20.** Timothy:
  "the emoji rotates in a circle and gets smaller until you can't see
  it, timed with the dialog closing." Distinct from the existing
  shrink-and-slide *flee* animation used by weak-mob surrender above —
  this is specifically for a monster actually killed in a real fight,
  which currently has no death animation of its own.

### Monster name/stat variants, and a rare near-dragon elite encounter
A significantly fleshed-out follow-up to the "roaming rare monster" idea
below — Timothy's view on it has clearly moved from "backburner,
questionable value" to a concrete, wanted feature. Two related but
separable pieces:

- **Named stat variants per monster type.** Wants ~5 variations of each
  regular monster (not per silly-name — within a type, e.g. goblin),
  each with a distinct name and slightly different HP/attack stats, so
  encounters of "the same monster" feel a little different fight to
  fight instead of always being numerically identical. Presumably still
  counts as the same `monsterId` for quest progress/drop tables — only
  display name and stats vary per spawn, similar in spirit to how boss
  tiers already vary the dragon's stats, but applied to regular
  encounters and randomly picked rather than player-escalated.
- **A rare, near-dragon-difficulty elite encounter**, roughly 1-in-20
  fights (5% chance), replacing a normal encounter in the current zone.
  Unique emoji, distinct from every existing monster/dragon emoji.
  Source of unique loot — ties directly into the "non-store equipment
  earned from the whole zone" idea under Multi-zone progression above,
  which named "repeated dragon kills" and "special encounters" as
  desired loot sources; this would be the special-encounter half of
  that. The player must be able to flee this fight if they judge
  themselves not ready — unlike the dungeon boss, which already
  disallows fleeing (`playerFlee()` in js/screens/battleScreen.js
  blocks fleeing when `MONSTERS[monsterId].isBoss`), so this needs its
  own non-boss-shaped "but still fleeable" treatment.
- **Adaptive flavor text based on estimated win chance.** The encounter
  text should shift based on how the player's current power compares to
  the elite's stats — from "no way you can beat me" (near-zero odds) up
  through something like "if you're skilled enough you might get me"
  as the matchup gets closer to fair. This needs an actual confidence
  heuristic (comparing effective attack/defense/HP, roughly the same
  inputs `scripts/simulate-balance.js` already reasons about for build
  tuning) — worth deciding whether to reuse/extend that script's logic
  or build a lighter in-game estimate; a full battle-outcome simulation
  every time the elite appears is probably overkill.

- ~~**Multi-mob encounters in zone 1, raised 2026-08-18.**~~ **Shipped
  2026-08-21.** After killing 10+ of a given monster type (tracked
  forever, per-species, in `state.monsterKillCounts`), wilderness
  encounters with that species now have a 30% chance to spawn a group
  of 2-3 instead of a lone target. Click a monster (or cycle with
  Left/Right/Tab) to select a target — Attack/abilities hit only the
  selection, while every monster in the group ticks its own ATB/wind-up
  independently. The parry key (`s`) is a deliberate global sweep: it
  parries every monster currently in its own parry window at once,
  regardless of which is selected — Timothy's explicit call, to be
  tuned by feel. Killing a monster removes it from the row and reflows
  the rest; a partial-kill-then-flee banks full reward (gold/xp/quest/
  kill-count) for each monster already killed, nothing for survivors —
  confirmed via a live in-browser test (exact delta: +1 kill, +16 xp,
  +4 gold for fleeing with 1 of 2 dead). Solo encounters are unchanged.
  Deliberately scoped OUT: any redesign of the 5 existing abilities'
  targeting/timing (see "Ability rotation redesign" above), and any
  AOE/multi-target ability. Design:
  `docs/superpowers/specs/2026-08-21-multi-mob-encounters-design.md`.
  Plan: `docs/superpowers/plans/2026-08-21-multi-mob-encounters.md`.
  This was the largest single-file rework attempted so far
  (`battleScreen.js`'s entire data model went from one monster to an
  array). Final whole-branch review caught and fixed one real
  regression before merge: the pre-existing weak-mob "surrender"
  payout had gone silently to zero (the array-shaped reward loop only
  iterates killed monsters, and a surrender leaves the monster at full
  HP), plus a killing blow's hit-effect/damage-number rendering onto an
  already-hidden monster slot in multi-mob fights. Both fixed; full
  detail in `.superpowers/sdd/2026-08-21-multi-mob-encounters/progress.md`
  history if that workspace still exists, otherwise see the branch's
  commit history.

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
3. **"Outclassed weak mobs should give up or flee"** (Combat pass ideas,
   above) — **shipped 2026-08-17**, a mob-surrender/flee mechanic for
   exactly this trivial-fight scenario. Doesn't touch monster stats, so
   it doesn't fight the "zone 1 should keep getting easier" goal below —
   it just makes the fights you've outgrown resolve faster instead of
   staying full-length.

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

## Balance / design gaps

### NG+ doesn't reset `lossStreak`
`resetWorldForNgPlus` (js/systems/ngPlus.js:45-59) resets `bossTier`,
`caches`, `gateRewards`, etc., but not `lossStreak`. Entering NG+ on a
5-loss streak grants the full 5-potion comeback bonus on the first NG+
death. Technically spec-compliant for the comeback-mechanic plan (only a
win resets the streak, by design) but the plan never explicitly decided
whether NG+ should also reset it — a design call, not a bug. (Surfaced
by the final whole-branch review of the comeback-mechanic plan,
2026-08-17.)

### Hero-revival glow may cancel the death-blow hit-flash/shake
On the killing blow, `.battle-hit-flash`/`.battle-hit-shake` and the new
`.battle-revive-glow` (css/styles.css:210-230) are briefly applied to
the same elements at the same specificity, and the later-declared
`.battle-revive-glow` wins — so the red flash/shake on the exact hit
that ends the fight may get visually overridden by the green revival
pulse. Purely cosmetic (arguably "green replaces red on death" reads
fine), but nobody explicitly decided this — worth a 30-second look
during a playtest to confirm it's not jarring. If it needs separating,
move the glow to a distinct CSS property or a wrapper element instead of
sharing `animation`/`filter` with the hit effect. (Surfaced by the final
whole-branch review of the comeback-mechanic plan, 2026-08-17.)

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

## Infrastructure / deployment

### Host on Cloudflare (free tier) with GitHub Actions auto-publish, raised 2026-08-20
Timothy: "I want to host this on cloudflare free tier and push to my
personal github and then have a github action that lets me easily
publish new versions." No hosting/CI exists at all today — this repo is
played locally only (no build step, static files served directly). Needs
its own scoping pass: which Cloudflare product (Pages vs. Workers static
assets), what "publish" means for a solo dev's workflow (push-to-deploy
on `master`, or a manual trigger), and whether the personal GitHub
account/repo already exists for this project or needs creating.
