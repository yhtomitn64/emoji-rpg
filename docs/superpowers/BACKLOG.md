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
fixed monster). Before any change, re-run
`scripts/simulate-balance.js` (already exists, used for exactly this
kind of tuning question) to see where the actual numbers land, rather
than guessing at new constants.

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

### Use a potion outside of combat
Currently potions can only be used mid-battle. Add a way to consume one
from the inventory/town screens.

### Enemies should sometimes drop potions
Confirmed via `js/data/monsters.js`: no monster's `dropTable` currently
includes `potion` at all — every drop table is material/tool-only (e.g.
`ironScrap` at 0.3 chance, `axe` at 0.25). Potions are otherwise only
obtainable from the shop, loot caches, or the comeback-mechanic's pity
grant. Wants a modest drop chance added to some/all monster drop tables.

### Enemy attacks immediately when its ATB bar fills (currently player
can always flee)
If the enemy's turn bar fills before the player's, the enemy should act
immediately rather than waiting for the player's next input — as-is, the
player can always choose to flee once the enemy is "ready," which
defeats the tension of being caught off guard. Needs a look at the ATB
tick/turn-resolution loop in `js/screens/battleScreen.js`.

### Shop: sell-back for misclicks
Buying an item by accident currently can't be undone. Add a sell-back
option (likely at a discount) for the item just purchased, or generally.

### Shop/inventory: distinguish "equipped" from "owned but unequipped"
The shop and inventory screens don't currently make it visually obvious
whether an owned item is the one currently equipped versus just sitting
in inventory.

### Shop sells items with no stat info ("buying blind")
Shop rows currently render as just `${emoji} ${name} — ${price}g` with
no stats — no way to tell what Lucky Charm does, or whether Iron Helm
beats Cloth Cap, before buying. The Inventory screen already has
stat-comparison logic for owned-but-unequipped items; this would reuse
that against shop listings too.

### Item tooltips wherever items are shown
Raised separately from "buying blind" above but the same root gap:
Timothy's words — "I don't know what different items do unless I'm
looking in the wrong place." A hover tooltip (or equivalent) showing an
item's effect/stats would need to work everywhere an item appears, not
just the shop: inventory, smith material selection, quest rewards. Item
data (`js/data/items.js`) already has `stats`/`heal`/`price` for this;
consumables like potions would need it too (currently only
`heal: 15`, no other descriptive text). Worth deciding whether this
subsumes the "buying blind" item above or the two ship separately.

### No way to heal outside of combat except losing a fight
`state.player.hp` is only restored to max in `handleBattleEnd`'s
`'lost'` branch (js/main.js:468) — winning doesn't heal, and there's no
in-town rest option. Wants something like an inn, a town "well" tile, or
auto-restore on returning to town.

### Spice up the battle screen with environmental decoration (trees/cave/etc.)
The battle screen is currently plain — wants some environmental flavor
(trees, cave walls, terrain matching the encounter) rather than a bare
background, so fights feel like they're happening somewhere.

### Hover tooltips for map tiles
Explain what each tile type does (water, tree, store, smith, cave, door,
field, mountain, dungeon) on hover. Not implemented anywhere currently.

### Hero emoji customization
Let the player pick their own hero emoji. Explicitly framed as a future
pass, not urgent.

### Quest board needs a "turn in all" button
Currently each completed quest presumably has to be turned in one at a
time. Add a bulk turn-in action.

### Shop needs bulk-buy buttons (1x / 5x / 10x / 100x)
Buying currently appears to be one-at-a-time. Add quantity shortcut
buttons so stocking up on potions/materials doesn't take repeated
clicks.

### A loot/bestiary reference — what you have, what exists, where it drops
Timothy's own words: "I have a goblin club, not sure what else I can
get." Wants a reference list showing owned items plus the full set of
obtainable items with a hint at where/what drops them (which monster,
which drop table). Related to the "buying blind" shop item above — both
are "the player can't see the game's item space" gaps — but this one is
broader: it's about discoverability of drops, not just shop stat
comparison. `js/data/monsters.js`'s `dropTable` entries and
`js/data/items.js` already hold everything this would need to read
from; no new data model required, just a new read-only view.

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

### Backburner / uncertain value
- **Roaming rare monster + mob leveling.** A rare monster that randomly
  spawns in already-visited areas, drops a unique weapon; paired with an
  idea that heavily-farmed mobs could slowly level up too. Timothy
  explicitly called this backburner and questioned its own value
  ("without hard content to keep grinding for, seems silly").
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
