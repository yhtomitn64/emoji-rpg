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

- **Story / narrative** — game needs a real story; Timothy writes it himself, engineering support only.
- **Pacing / progression** — early ramp / dragon-fell-quickly thread: level-12 dragon kill reads as right pacing, but even 3-star dragon was too easy; Timothy's own read is gear, not level, is the driver. Ties to defense-scaling and Mythic-tier items below.
- **Multi-zone progression** (big, needs its own design pass) — zone 2/3/4 identity, spatial difficulty gradient, healing-enemies zone-2 idea, tool-gated zone unlocks, NG+ state carry-over into zone 2, town south-exit/expand/signage, town NPC hints (needs landmarks first). NG+ tools-reset piece already shipped.
  - **NG+ loot stale at the gear ceiling** — reiterated repeatedly; needs an item-design pass for NG+-scoped headroom past today's max tier/upgrade.
  - **Dragon NG+ better drops** — not designed.
  - **NG+ monsters appearing "out of place"** — raw idea, not designed.
  - **Boss tier / NG+ cycle ceiling** — confirmed fine as-is for now, revisit later.
  - ~~Mythic gear tier NG+2 shortfall~~ — **resolved 2026-08-31 (0.12.2)**: simulator now models ring/on-hit effects, `mythic` multiplier moved 1.35→1.5.
  - **Real goal is "feel powerful by end of NG+2" (2-3 hit kills), still open** — a flat multiplier doesn't get there; needs its own design pass with a different lever.
  - New: NG+ cycle should raise axe/pick/canoe drop chance from regular mobs (raw idea); possibly ties to roaming enemies gated to NG+2+ (raw idea).
  - **Parry window/simulator-trust gap, sharpened** — simulator models parry at 0% (never modeled at all), narrow the window + add a parry-rate assumption to the sim. Good next-session candidate.
  - Terrain painter: zone-switcher (deliberately deferred), dungeon-interior painting (in progress/done, check session history).
  - Staged/tool-sequence-aware reachability checker — still open, algorithm not designed.
  - Non-store zone-1 loot (unique finds outside the shop) — open.
- **Painter tool: paint monster placement** (big idea, not designed) — per-tile/region monster tables as paintable layers.
- **Roaming visible enemies + dragon difficulty scaling** (big, needs design pass) — visible overworld entities, cross-screen movement, opt-in power-scaling dragon mode (standard dragon fight stays fixed). Possible dependency on a scrolling/camera rendering rewrite (also raised independently for mobile-responsive viewport).
- **Fog-of-war reveal map** (`m` keypress) — raw idea, not scoped.
- **New terrain: sand/tarpit/water enemies** — raw idea; needs per-tile-kind monster tables + a move-speed-modifier mechanic, neither exists today.
- **Hand-placed zone-1 loot + shop rebalance** (big, needs design pass) — weaker shop gear, a placement-dropdown system for world loot, possibly tied to hand-placed mini-dungeons.
- **In-game tutorials / mechanic explainers** — general onboarding idea, sharper combat-specific version (explain abilities/synergies/attack-falloff at unlock, explicit dismiss required). Timothy wants to talk through design when picked up.
- **Ability buttons: icon-only redesign** — implemented 2026-08-31 (0.12.0/0.12.1) with several live-feedback follow-ups already shipped; only remaining gap is Timothy actually playing a battle with it before this moves to shipped. Spun off and now shipped separately: **mid-battle pause** (0.13.0) — see BACKLOG_SHIPPED.md.
- **Combat pass ideas** — several independent threads, none scheduled:
  - Slower combat / reconsider the timing-minigame layer entirely — raw, Timothy wants to think it through more.
  - Monster inter-buffs/synergies, overlapping/varied monster sizing, larger battle screen, background illustration — all deferred sub-projects of the bigger-groups work (sizing 1-2 already shipped).
  - Rung-3 gear effects: parry window trade-offs (undecided direction), plus known un-fixed side effects from the v1 ship (tooltip not tier-aware, AOE lifesteal/proc stacking per target, raw camelCase stat keys in UI, ±1 delta display rounding, redundant `getEquipmentBonuses` calls) — small cleanup items.
  - Rhythm-style multi-hit parry, hold-to-block shield, timer-speed items, bonus damage at high swing speed — all raw/tentative ideas.
  - Research: alternatives to raw stat-number power creep — rough research question, unblocked but unstarted.
  - **Defense scaling needs work** (player outpaces near-town content thread) — Timothy flagged it again 2026-08-28, not yet run through the balance simulator.
- **Mobile/touch combat should be turn-based** — raw idea, explicitly scoped to touch input only.
- **Open question: faster battle timer against weaker enemies?** — needs a decision (is it a speed problem or a power problem), not just an implementation.
- **Infrastructure** — a friend's lag report (too vague to act on, watch for recurrence); pixel-level visual regression test for the trail renderer (good idea, not started, needs its own small design pass).
- **Discoverability / monetization** — AdSense (blocked on Google review; placement plan already decided); Cloudflare traffic analytics (waiting on a token from Timothy); opt-in gameplay analytics + local play-data export (not designed, tied to the same difficulty-by-tool-gate tuning question).
- **Input / accessibility** — controller support, raw idea, not investigated.
- **Feature requests** — item selection menu for the Item button (raw idea, waits on a second consumable item type existing, possibly ties to pause); "New Max damage!" progression callouts + a DPS meter (raw idea, raised in passing).
- **Quests / economy** — manual sell-materials path (deferred, no real pain yet); **excess-gold sink** — revisit condition already hit (3k+ gold, nothing to spend it on), direction undecided (more sinks vs. reduced income).

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
  - ~~**NG+ doesn't reset the player's tools.**~~ **Shipped 2026-08-29 —
    see BACKLOG_SHIPPED.md.** `resetWorldForNgPlus` now strips tool items
    and resets `clearedGates` each cycle, plus a one-time migration for
    saves already mid-cycle.
  - **NG+ loot feels stale without new/better items — reiterated
    2026-08-29, reiterated again 2026-08-30.** Same underlying gap as
    "Should the dragon drop better items in NG+?" just below, restated
    more bluntly: Timothy, after being reminded how NG+ loot scaling
    actually works today (chance-only, via
    `NG_PLUS_DROP_CHANCE_MULTIPLIER` — no new items, no higher tiers):
    "I think we need to make the loot better in NG+... right now NG+ feels
    pretty stale w/o new loot." Explicitly deferred to backlog rather than
    tackled immediately — this is real item-design work (what the new
    items are, their stats, which tier they'd sit at), not a quick
    mechanical change, so it wasn't done in the same session as the ask.
    **Sharper 2026-08-30 reiteration, with a concrete cause identified:**
    Timothy, mid-NG+2 having just hit the boss-tier/NG+ ceiling (see "Boss
    tier / NG+ cycle ceiling" below): "I do think we should have better
    loot and gear from NG+ though because I can't upgrade any more and
    that's no fun. So I can't really tear apart enemies as fast as I want."
    This is a hard, verifiable wall, not just a vibe: gear progression caps
    at `MAX_UPGRADE_LEVEL = 3` per item/tier
    (`js/systems/inventory.js`) and the Fine/Superior quality tiers
    (`QUALITY_TIER_MULTIPLIERS`, `js/systems/itemQuality.js`) — once every
    slot is Superior + upgrade level 3, there is no further gear power
    available at all, while `getNgPlusCombatOverrides`
    (`js/systems/ngPlus.js`) keeps scaling monster hp/attack/defense up
    every NG+ cycle regardless. A maxed-out player actually gets
    *relatively* weaker each cycle, the opposite of "tear apart enemies
    faster." Still not designed - needs the same item-design pass as
    above, now with an explicit design goal: player power should have
    *some* NG+-scoped headroom past today's absolute gear ceiling, not
    just better odds at the same finite item pool.
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
  - **Parry window trade-offs — sharpened 2026-08-31 with a real,
    demonstrated concern, not just two abstract directions.** Original
    ask (2026-08-26) floated (a) wider window/less reflected damage vs.
    (b) narrower window/more reflected damage, undecided. Timothy's new
    concern is more specific and worth reading as its own thing: "if you
    do parries correctly you can win almost anything. So I think we
    should probably shorten the parry window as well as update the
    simulator to have some sort of math about how often someone might
    parry. I don't have a ton of faith in our simulator besides like raw
    numbers perhaps but even then not sure." Confirmed why the simulator
    can't currently speak to this either way: `scripts/simulate-balance.js`
    doesn't model parry **at all** - `resolveMonsterAttack` fires the
    instant a monster's ATB is ready, no parry-interrupt exists in the
    sim's tick loop (this was already flagged in the file's own docblock
    as a known scope limit, not new). Every number that file has ever
    produced already assumes a player who never lands a single parry -
    a conservative bias on measured player power, not an optimistic one,
    which is why the mythic-multiplier decision just above shipped
    anyway rather than waiting on this. Two real, separable pieces of
    work here: (1) actually narrow the parry window (a balance tweak to
    `js/systems/parry.js`), and (2) add a "how often does a skilled
    player actually land a parry" assumption to the simulator's tick
    loop, the same way `TIMING_HIT_RATE = 0.7` already stands in for
    ability-timing skill - needed before the simulator's numbers can be
    trusted for anything parry-adjacent, not just this specific window
    question. Good candidate for a dedicated future session; not started.
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
- **Town layout: south exit instead of a "door," expand town, and
  per-shop signage, raised 2026-08-28.** Timothy: "Door of town should
  be at the bottom of town or not even a door just a break in the trees
  in the south of town. Also can we expand town a bit and have a
  signpost or something or a label above each shop type or feature in
  town. Also when you exit town then you should appear in the map below
  the town if exit in south and for future towns maybe you can exit in
  multiple directions. Actually in first town let's have an exit in all
  directions and that's the direction you appear on the map." Several
  distinct pieces in one note: (a) replace the current town door/exit
  with a south-side tree-break, with matching correct landing placement
  on the wilderness map below; (b) grow the town map itself; (c) label
  each shop/feature with a visible sign or name tag rather than relying
  on the player to walk up and discover it; (d) exits in all four
  directions for town 1 specifically, each landing the player on the
  correspondingly-adjacent wilderness screen — establishing the general
  multi-exit pattern this section already expects future towns to need.
  Not designed — needs a look at the existing town interior map and
  exit-handling code (likely alongside whatever handles
  `handleEdgeTransition`/wilderness screen transitions) before scoping.
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

## Feature requests

*(Everything originally in this section shipped 2026-08-17, and every item
raised into it since then has since shipped too — see CHANGELOG and
BACKLOG_SHIPPED.md. One thing was dropped rather than shipped: swapping
monster emoji to match their silly food names — Timothy likes them as
they are, e.g. "Slippery Breadstick" for the snake. Not tracked anywhere;
revisit only if it comes up again for a future zone.)*

### Item selection menu for the Item button, raised 2026-08-31
Raised while reviewing the new action-button tooltip descriptions: right
now Item (`i`) always drinks the one potion type in `ITEMS` — there's no
menu because there's nothing to choose between yet. Timothy's own words,
flagging it as forward-looking rather than needed today: "Item is
interesting because at some point you will choose from a number of items.
That might tie into pause where if you hit i a ring of stuff comes up and
you choose from the one you want. that's a future backlog thing." Raw
idea only — not designed: what a multi-item inventory in battle even
looks like (a radial picker was Timothy's own mental image), whether it
auto-pauses the battle while open, and what triggers it existing at all
(more consumable item types don't exist yet either). Revisit once/if a
second consumable item type is added.

### "New Max damage!" progression feedback + a DPS meter, raised 2026-08-31
Timothy's own words: "New Max damage for ability!!! and things like that
so you know you are progressing. Also maybe a DPS meter somewhere!" Raw
idea only, raised in passing (not part of any active work) — not
designed: what counts as "max" (per-ability best hit ever, best this
battle, both), where the callout shows (log line, badge on the
button/damage number, toast), and what a DPS meter would actually measure
or where it'd live (per-battle, rolling window, lifetime stat).

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

**Revisit condition hit, 2026-08-28:** Timothy: "I'm getting tons of
gold and way more than I need so gotta figure that out too. not sure if
more things to buy or potion buffs to buy or something else but my gold
is like 3k!" This is exactly the "future economy pass tightens gold
flow" trigger named above, now real — 3k gold with shop gear topping
out around 45g and upgrades at ~120g total means there's nothing left
to spend on well past the early game. Two directions, neither decided:
add more/higher-tier gold sinks (more expensive gear, potion buffs — the
tiered-gear sell path shipped 2026-08-29, see BACKLOG_SHIPPED.md, already
feeds some gold back out), or reduce gold income at higher levels. Not
investigated yet.

## Ability buttons: icon-only redesign, raised 2026-08-30

Timothy's own words: "I want our abilities to just be icons and not all
the text on them and on one line. the button should have a picture and
the key on it. so let's spin up a few design options using mocks."

Today's ability buttons (`js/screens/battleScreen.js`, `#btn-ability-*`)
show the ability's icon/emoji plus its full name and other text, laid
out however many fit rather than deliberately one row — Timothy wants a
tighter, icon-first redesign: each button shows just the ability's
picture and its keyboard shortcut, with the row of buttons kept to one
line. **He explicitly asked for a few visual design options as mockups**
before picking one — this wasn't just a raw idea to log, it was a
request to actually produce comparison mockups (most naturally via the
`design` skill's canvas, or an HTML/CSS mock in an Artifact) next
session. Not started — got queued behind the NG+ gear progression work
this same session and never picked back up. First step next time: build
2-3 icon-only button layout options side by side for Timothy to compare,
not a single guessed design.

**Picked up 2026-08-31, clarified via brainstorming before mockups were
built.** Today's buttons also carry a cooldown countdown, a combo-ready
gold glow, and an estimated-damage number — stripping to icon+key alone
raises where that other info goes. Timothy's answers:
- **Cooldown → a radial/wipe indicator, not text.** His own words: "some
  sort of indicator about the cooldown remaining. Like the button slowly
  draining of a color until it looks clickable again or maybe like a
  circular clock hands like pattern that indicates when it's ready to
  use. Transparent red shade for the time left until you can use it."
- **Keep the existing combo-ready glow** (`.battle-ability-button-combo`)
  as-is — only the text content is being stripped, not that effect.
- **Button content becomes just the icon plus a small keybind label in
  one corner.** Everything else that's on the button today (name,
  cooldown seconds, combo-ready text, damage estimate) moves to a hover
  tooltip instead of staying always-visible on the button.
- **Scope is all four battle buttons, not just the 5 unlockable
  abilities** — Attack, Item, and Flee go icon-only too, for visual
  consistency across the whole action row (not scoped to `#btn-ability-*`
  only as the original ask's wording implied).

Mockups being built against this clarified direction — see session
history around 2026-08-31 for the actual comparison options.

**Implemented 2026-08-31 — Timothy picked "Option A" (radial clock-wipe
cooldown, square buttons)** from the three mockups. `js/screens/
battleScreen.js`/`css/styles.css` now build every battle button (Parry,
Attack, the unlocked abilities, Item, Flee) through a shared
`actionButtonHtml()` helper: icon + a corner keybind chip only, with name/
cooldown/combo/damage moved to the button's `title` tooltip and a red
conic-gradient wipe overlay for cooldown. Not yet confirmed live in a
browser (only `npm run test`'s jsdom coverage so far, per the standing
"avoid Chrome automation" preference) — move this to BACKLOG_SHIPPED.md
once Timothy's actually played a battle with it.

**Follow-up, same day:** Timothy noticed the whole action row still lived
inside `.overlay-panel.battle-screen` and swirled in/out with the dialog's
own `battle-screen-swirl-in`/`-out` mount/unmount animation - "the buttons
should stay stationary and not have all the dialog wiggle shake effects as
it's a little disorienting." Fixed by pulling the action bar out into its
own sibling `.battle-action-bar`, docked visually under the dialog (shared
border/background, only the outer corners rounded) inside a new
`.battle-screen-stack` wrapper - the dialog is still free to swirl/shake,
the buttons no longer live in that subtree so they don't move with it.

**Follow-up, same day:** Timothy: "I'm used to having my fingers on
1,2,3,4 and so on and then moving off to other keys as needed and when I
see that first row of buttons start with letters it feels off." Split the
action bar into two `.battle-action-row`s - numbered ability keys on top,
Parry/Attack/Item/Flee (and any future Space-keyed buff ability) below -
so the row order matches where a player's fingers already are.

**Follow-up, same day:** Timothy: "can we get the fight dialog, the number
row and the other letter row all centered together. Rightnow all of it is
aligned left." Each `.battle-action-row` was already stretched to match
the dialog's width (see the `.battle-action-bar` comment above), but flex's
own default (`justify-content: flex-start`) packed each row's buttons
against that box's left edge instead of centering them in it - added
`justify-content: center` to fix.

**Follow-up, same day - a real bug, not just polish:** Timothy noticed the
dialog itself rendered narrower than the action bar below it, leaving a
gap on one side (screenshot showed the two misaligned). Root cause: the
base `.overlay-panel` rule sets `width: 90%`, sized for being `#overlay`'s
direct sole centered child - once the dialog moved one level deeper into
`.battle-screen-stack`, that 90% resolved against a container whose own
width depends on the dialog's content, a circular case Chrome resolves in
a way that left the dialog undersized and left-aligned instead of
stretched. Also explained the still-open "small rectangle lingers after
the dialog's exit animation" bug from two entries up - same root
mismatch, different symptom. Timothy's own fix direction: "one container
around them all and both inner containers at 100% inside there and then
animation ... can apply to all of it at once." Implemented exactly that -
`.overlay-panel.battle-screen` and `.battle-action-bar` are both
`width: 100%` of `.battle-screen-stack` now (guaranteed to match, not
just usually matching), and `battle-screen-swirl-in`/`-out` moved from the
dialog onto the stack so both panels animate in/out together as one unit,
which incidentally also fully resolves the lingering-rectangle bug (see
that entry) without the buttons needing any special-cased hide.

**Steer, same day:** Timothy watched the shared-animation fix live and
didn't like it after all: "why do the buttons hide and then the whole box
animates away... it's my fault guiding you that way but that's okay we
can change. Let's have buttons stay there and just animate away after
battle along with everything else." So `updateMenu()` no longer clears
the action bar at all when `battleOver` - the buttons from the last real
render just sit there, then fade away with the dialog via the shared
`battle-screen-swirl-out`. That only works if every action function
actually treats a still-visible button as inert (a real gap this
surfaced): `playerAttack`/`playerFlee`/`playerUseItem`/`playerUseAbility`
had no `battleOver` guard at their own top - a click during the pause
would have re-run a real action and called `endBattle()` a second time.
Added the guard to all four (`attemptParry` already had one). Covered by
a new test: click Attack again right after a killing blow, confirm no
second log line and `onBattleEnd` fires exactly once.

**Same message, second half:** "make sure any battle related animations
finish before running the whole dialog close animation so we don't have
too much going on at once." The killing blow (or the hit that downs the
player) has its own effects running independently of the pause - a
floating damage number (`DAMAGE_NUMBER_DURATION_MS`, 1400ms, the longest
of these), a death-spin/split (900ms) or the hero's revive-glow (1100ms),
possibly a perfect-timing/parry badge (900ms). `endBattle()` now waits
`DAMAGE_NUMBER_DURATION_MS` before starting `battle-screen-swirl-out`
(skipped for a flee, which has no such hit to wait for), and pushes the
final DOM teardown out to match so the exit animation still gets its full
`EXIT_ANIM_MS` to play.

**Follow-up, same day - the dialog itself was still resizing:** Timothy:
"as you kill monsters that space goes away in the dialog. Can we have the
space stay as you kill monsters so that the dialog size doesn't jump
around as monsters die and at the end it's noticible too because the
dialog goes smaller then animates away." Root cause: `.battle-monster-
slot-dead` used `display: none`, which pulls a dead monster's slot fully
out of `.battle-monster-row`'s flex layout (`justify-content: center`) -
every death re-centered/reflowed the remaining monsters, and on the
battle-ending kill specifically, the dialog's own width/height shrank
right before `battle-screen-swirl-out` even started, so it visibly
resized and *then* animated away as two separate motions. Switched to
`visibility: hidden`, which still removes the slot from hit-testing (same
as before for click purposes) but keeps its layout space reserved, so the
dialog's size stays constant through every death in a fight and only
moves once, via the exit animation.

**Follow-up question, same day - a good one:** Timothy: "did monsters
have death animations that are now going to not be visible because we
hide them right away? do we need a timeout aligned with animation length
and a robust setup so they share the same variables ... so that if we
tune death animation/length we don't make a new bug by accident?" Checked
carefully: no, the death-spin/split animation was never at risk from the
`visibility: hidden` change above - `updateHpBars()` already deferred
adding `.battle-monster-slot-dead` (the hide) behind its own
`DEATH_HIDE_DELAY_MS` (900ms) `setTimeout`, specifically so the kill
animation gets its full run before the slot hides either way. But the
robustness question was real: that 900ms JS constant and the CSS
`.battle-death-spin`/`.battle-death-split` animations' own `0.9s`
duration were two independently hardcoded numbers that only happened to
agree, with nothing stopping them from drifting apart if either got
retuned later. Fixed by having `updateHpBars()` set a
`--battle-death-anim-ms` custom property (driven straight from
`DEATH_HIDE_DELAY_MS`) on the dying monster's emoji at the moment the
death class is added, and having both CSS animation rules read their
`animation-duration` from that property instead of a literal - a
pseudo-element (`.battle-death-split::before/::after`) can't take an
inline style directly from JS, which is exactly what a custom property is
for. `DEATH_HIDE_DELAY_MS` is now the single number controlling both how
long the kill visibly animates and when the slot hides after it, so
retuning it can't silently desync the two again. Covered by a new test
asserting the property actually gets set to `900ms` on a kill.

~~**Related:** the same "two hardcoded durations that must be kept in
sync by hand" shape existed for a few other JS-timed CSS animations in
this file.~~ **Shipped 2026-08-31 (0.12.1).** The floating damage number
and the PERFECT!/PARRY! badge now read their CSS animation duration from
the same `DAMAGE_NUMBER_DURATION_MS`/`PERFECT_TIMING_BADGE_MS` constants
that drive their removal timeout, same fix shape as the death animation
got in 0.12.0. See BACKLOG_SHIPPED.md.

~~**Spun out of this clarification, new idea — a mid-battle pause,
raised 2026-08-31:** Timothy, while discussing moving damage/combo
details to a hover tooltip: "maybe if we had a combat pause button that
would make it more helpful to use the tooltip mid battle so someone can
see damage numbers and then unpause and keep playing. pause should have
a keybind too so they can quickly pause/unpause." No pause mechanic
exists anywhere in the battle screen today — ATB bars, cooldowns, and
monster attack timers all run continuously. Explicitly floated as a
"throw it in backlog" aside, not part of the icon-only redesign itself —
raw idea only, not designed: what actually freezes (ATB fill, cooldown
timers, monster AI ticks, animations in flight), what the keybind is,
and whether it's available during every battle state (e.g. mid-parry
window) are all open.~~ **Shipped 2026-08-31 (0.13.0).** Brainstormed
with Timothy and designed: a pause button (upper-left of the battle
dialog, not in the ability list) plus a `P` keybind, both toggling
pause/resume. Freezes the 300ms tick (ATB/cooldowns/buffs), a monster's
windup/parry-zone CSS animation and its real-time parry window (offset
on resume via `shiftWindupStart()` in `js/systems/parry.js`, so paused
time never counts against the window), and the ability timing-meter's
rAF loop and sweet-spot pulse — available during every battle state,
including mid-windup/parry, per Timothy's "I like [freezing the parry
window too]." Already-in-flight cosmetic effects (damage numbers, crit
shake, lunges, death anim, an ability's AOE stagger) are left running
rather than frozen — nothing to get wrong by not freezing them, per
Timothy's "#1 is the way to go" on that question. Dim overlay + "PAUSED"
label spans the whole dialog-and-action-bar card (raised after first
pass: "also need to gray out the whole battle dialog and container...
not just the battle hero/enemy screen"), with `pointer-events: none` so
hovering for the tooltip that motivated this still works through it. See
BACKLOG_SHIPPED.md.

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
  - **(5) A larger battle screen.**
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
  - **Parry window trade-offs, two directions floated:** (a) a wider
    parry window but the successful parry deals less reflected damage,
    or (b) a narrower window that rewards good timing with more
    reflected damage than the current fixed 50% (`js/systems/parry.js`).
    Not designed — which direction (or both, as two separate items) is
    undecided.
  - **Known follow-ups from the item-quality-tiers final review,
    2026-08-28** (each a real, deliberately-accepted consequence of the
    v1 shipped design, not a bug — recorded rather than silently
    accepted):
    - **`describeItem` (`js/systems/inventory.js`) was never made
      tier-aware.** It's the `title=` tooltip on every gear row and
      still prints raw base stats, so a Superior Iron Sword's tooltip
      reads "attack +6" while the item actually grants 7 (it already
      ignored smith-upgrade level before tiers existed; this adds a
      second axis of the same drift).
    - **AOE abilities multiply lifesteal/elemental-proc per target
      hit**, not per player action — `applyOnHitEffects` is called once
      per monster hit, so Sweep against 3 monsters yields 3 lifesteal
      heals (45% of total damage healed back) and 3 independent 20%
      proc rolls. Plan-mandated and commented as deliberate; flagging
      as a balance data point now that Sweep and Vampiric Fang/Ember
      Ring coexist.
    - **`formatDelta` (duplicated identically in `inventoryScreen.js`
      and `shopScreen.js`) leaks raw camelCase stat keys into the UI**
      once an effect stat is nonzero — e.g. "attack +7, lifestealPercent
      +15", or Ember Ring's "elementalProcChance +20,
      elementalProcDamage +6". Pre-existing style
      (`enemySlowPercent` already did this), the four new effect keys
      just make it a lot more visible. A shared stat-label map would fix
      the display and the duplication in one move.
    - **`getItemStatDelta`'s displayed delta can be off by ±1** from
      what `getEquipmentBonuses` actually applies, whenever another
      equipped slot's fractional upgrade/tier contribution rounds
      differently once totaled — brute-forced across a large sample of
      equipped/candidate/tier/upgrade combinations: roughly a quarter
      mismatch (pre-existing from upgrade-level fractions alone; tiers
      barely move the rate). Never a sign error, only ever ±1. Not
      worth blocking anything on, but the delta shown before equipping
      something isn't always exactly what you get.
    - **`getEquipmentBonuses(state)` is called three separate times on
      the battle-mount path** (`js/screens/battleScreen.js`, once each
      for the player combatant build, the enemy-slow stat, and
      `playerEffectBonuses`) — cheap and correct, just worth
      consolidating into one call reused for all three next time this
      file gets touched.
- **Rhythm-style multi-hit parry / synchronized multi-mob parry bar,
  raised 2026-08-26.** Timothy's own words, explicitly tentative
  ("seems a little funky," "not sure"): enemies that land multiple
  hits per attack, each needing its own parry in sequence — "almost
  like a rhythm game" — rather than today's single wind-up-then-one-
  parry-window per attack (`js/systems/parry.js`). For multi-mob
  fights, floated a single larger shared bar appearing when several
  monsters attack at once instead of each monster's own independent
  wind-up bar (today's model, see the multi-mob encounters design).
  Floated as possibly its own special encounter type rather than a
  change to normal combat. Not designed at all — raw idea only, capture
  only per his explicit "maybe backlog for the future."
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
twice. Still just an idea - which events, what the extract command looks
like, and how/whether it shares code with the GA item above are all open
design questions, not decided.
