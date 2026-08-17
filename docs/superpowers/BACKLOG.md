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
- **Abilities gained on level-up.** Move away from a single "attack"
  button toward gaining new abilities as you level, closer to active
  combat than the current "dragon warrior style." No ability system
  exists anywhere in `js/` today — this is the biggest of the group,
  foundational for some of the others (e.g. multi-enemy targeting below).
- **Status log could snapshot effective stats/gear per entry.** A
  refinement of the now-shipped status log — right now an entry like
  "fought a boar, lost" can't help diagnose whether combat numbers are
  behaving as designed without knowing effective attack/defense/HP and
  equipped gear at that moment.
- **Outclassed weak mobs should give up or flee, not just always fight
  to the death.** When the player is much stronger than the enemy, wants
  a chance the mob just surrenders/dies outright and drops loot, or
  flees (either dropping loot on the way out, or getting away with
  nothing) — each with its own flavor text and a small unique animation
  (emoji shrinking, moving away, etc.), rather than every mismatched
  fight playing out identically. Overlaps with the existing "faster
  timer against weaker enemies" open question below — both are about
  trivial fights against outclassed enemies feeling like padding: worth
  considering together rather than as two unrelated builds.

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

### Backburner / uncertain value
- **Mob leveling.** The other half of the original "roaming rare
  monster" idea — heavily-farmed regular mobs could slowly level up
  too. Left here since the "roaming rare monster" part above graduated
  out of backburner status, but this half wasn't specifically revisited.
- **Multi-enemy battle targeting.** Abilities that hit multiple enemies
  with target selection. Depends on a much bigger feature that doesn't
  exist yet — battles are strictly one `monsterId` per encounter today,
  no multi-monster support at all. Called out as backburner.

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
