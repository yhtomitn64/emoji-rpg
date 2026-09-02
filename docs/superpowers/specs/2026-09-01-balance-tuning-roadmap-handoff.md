# Balance-tuning roadmap — session handoff prompts

**Status:** a queue of three separate future sessions, decided
2026-09-01 right after the portal-scroll feature shipped. Each item
below gets its **own fresh session** — don't try to do more than one in
the same session. This file isn't itself a design or a plan; it's the
paste-in opening prompt for each session, plus the shared context each
one needs. Once an item ships and goes live (pushed to `main`), start a
brand-new session and paste in the next item's prompt section below.

**The three items, in order:**
1. Parry window + simulator's parry-rate blind spot
2. NG+ loot ceiling (+ the NG+/zone-2 direction questions it's tangled
   up with)
3. Defense scaling / near-town pacing

All three live in `docs/superpowers/BACKLOG.md` — this file doesn't
duplicate their full history, just enough to open each session cold.

---

## Session 1 — Parry window + simulator parry-rate — SHIPPED 2026-09-01

See BACKLOG_SHIPPED.md's Multi-zone progression section ("Parry window
narrowing + simulator parry-rate modeling") and CHANGELOG.md's 0.16.2
entry for what actually shipped. Kept below for historical record.

Paste this in as the opening message of a new session:

> Pick up the "Parry window / simulator-trust gap" item from
> `docs/superpowers/BACKLOG.md` (search for "sharpened 2026-08-31" under
> "Multi-zone progression" — it's nested oddly in that section, that's
> just where it landed when it was raised, not actually a multi-zone
> item). Read that entry's full context first, then read
> `js/systems/parry.js` and `scripts/simulate-balance.js` before
> proposing anything.
>
> Two separable pieces of work: (1) narrow the parry window itself (a
> balance tweak to `js/systems/parry.js`, currently a fixed 50%
> reflected-damage window with no "how hard is this to time" modeling
> I've read about yet — check the actual code for the real current
> shape), and (2) add a "how often does a skilled player actually land
> a parry" assumption to the simulator's tick loop, the same way
> `TIMING_HIT_RATE = 0.7` already stands in for ability-timing skill.
> Piece (2) matters beyond just this question — every number
> `scripts/simulate-balance.js` has ever produced assumes zero parries
> land, which is a known conservative bias on every past balance
> decision, not just this one.
>
> My own concern driving this (quoting myself from when I raised it):
> "if you do parries correctly you can win almost anything." So the
> narrowing isn't just a vibe — I want it narrow enough that landing
> parries reliably stops trivializing fights, and I want the simulator
> able to tell us whether that's true instead of just trusting a gut
> call.
>
> This is more bounded than the other two items in this queue — treat
> it as such (check `superpowers:using-superpowers` for how to classify
> it) rather than a full brainstorm-to-design-doc process, unless you
> hit something that says otherwise once you're actually in the code.

---

## Session 2 — NG+ loot ceiling (and the NG+/zone-2 direction questions) — PARTIALLY SHIPPED 2026-09-01

**What shipped (0.16.3):** the narrowest possible fix to Thread A below —
`MAX_NG_PLUS_CYCLE` and `MAX_UPGRADE_LEVEL` are gone as enforced ceilings.
NG+ cycles and smith upgrade levels now climb with no cap at all; nothing
else changed (drop tables, quality-tier odds, and item design are exactly
as they were). Deliberately the smallest lever, not the full item-design
pass — see BACKLOG_SHIPPED.md's Multi-zone progression section for the
mechanism and CHANGELOG's 0.16.3 entry for the diff.

**Still open, unstarted:** everything below this point remains exactly as
undecided as it was — "make gear drops interesting again" (new/better
items past today's tiers) was explicitly deferred until the endless
numeric climb alone proves boring, and Thread B (how NG+ should relate to
zone 2+) was never picked up since zone 2 doesn't exist yet. Read the rest
of this section fresh whichever session actually tackles either of those.

This one's genuinely bigger and has more undecided surface area than
session 1 — treat it as architectural (brainstorm → design doc → plan),
not bounded.

**Two entangled threads, both need airtime:**

**Thread A — NG+ loot is stale at the gear ceiling.** Once every slot
hits Superior quality + upgrade level 3, there's no further gear power
available at all (`MAX_UPGRADE_LEVEL = 3` in `js/systems/inventory.js`,
`QUALITY_TIER_MULTIPLIERS` in `js/systems/itemQuality.js`), while
`getNgPlusCombatOverrides` (`js/systems/ngPlus.js`) keeps scaling
monster hp/attack/defense up every cycle regardless — a maxed player
gets *relatively weaker* each NG+ cycle. My own words when this got
sharp: "I do think we should have better loot and gear from NG+ though
because I can't upgrade any more and that's no fun. So I can't really
tear apart enemies as fast as I want." The actual bar (from a separate
but related thread): fights resolving in 2-3 hits by end of NG+2,
sometimes a one-shot — a flat tier-multiplier bump was already tried
and tested (up to 3.0x) and barely moved hits-to-kill (33 → 9-11, not
anywhere near 2-3), so whatever this session lands on needs a real
different lever, not another multiplier tweak. Candidates nobody's
picked yet, per the backlog: a late-NG+-cycle player-power multiplier
separate from gear tiers, an execute/overkill mechanic past some HP
threshold, trimming monster HP scaling at high NG+ instead of only ever
raising it, or armor-piercing crits.

**Thread B — how NG+ should relate to zone 2+ once more zones exist.**
Restated and extended by me 2026-09-01, still genuinely undecided:
- NG+ should "keep going" as an ongoing concept, not a one-off.
- I still like the idea of resetting/reverting the character before
  zone 2, so zone 2 has to be earned the way zone 1 was — **unless** we
  just scale the rest of the game to NG+ strength instead, **or** — as
  the game grows past zone 1 — "NG+" itself comes to mean having
  finished the *whole* game once, not just zone 1's dragon again.
- New idea I like: **each zone having its own NG+**, rather than one
  global NG+ cycle spanning every zone.
- New idea, and it's a real divergence from how "Multi-zone
  progression" in the backlog has generally assumed zone 2 works so
  far (new screens, its own identity): zone 2 might not be new map
  screens at all — it could be **zone 1's same map, reshaped** —
  mountains move, a new stream appears, you need an upgraded/stronger
  version of a tool you already have (a "stronger axe," an "updated
  canoe") to get through the changed terrain, rather than a whole
  separate zone-2 map and tool set.

None of Thread B is decided. Read the full history first —
`docs/superpowers/BACKLOG.md`'s "Multi-zone progression" section,
specifically "How should NG+ strength carry into a new zone" and its
2026-09-01 addendum, plus "Each new zone is allowed to be a partial
gear-check reset" and the spatial-difficulty-gradient bullet nearby —
they're all entangled and were explicitly flagged to decide together.

**Why these two threads are in the same session:** whatever Thread B
decides (does NG+ strength carry forward, get reset, or go per-zone)
directly changes what "give NG+ some loot headroom" in Thread A even
means — headroom relative to a zone-2 gear-check reset is a different
design than headroom for a single ever-scaling character. Don't design
Thread A's specific items/mechanism before Thread B has at least a
provisional direction.

Paste this in as the opening message of that session:

> Pick up two entangled backlog threads from
> `docs/superpowers/BACKLOG.md`'s "Multi-zone progression" section: NG+
> loot going stale at the gear ceiling, and how NG+ strength should
> relate to zone 2+ once more zones exist (the "How should NG+ strength
> carry into a new zone" bullet and its 2026-09-01 addendum). Full
> context for both is in
> `docs/superpowers/specs/2026-09-01-balance-tuning-roadmap-handoff.md`'s
> "Session 2" section — read that first, it's already written up from
> my own words rather than needing me to re-explain it. Invoke
> `superpowers:brainstorming`, classify as architectural, and don't
> design the loot-ceiling mechanism before the NG+/zone-2 direction
> question has at least a provisional answer — they're entangled on
> purpose, see the handoff doc for why.

---

## Session 3 — Defense scaling / near-town pacing

Smaller than session 2, but still needs the balance-simulator treatment
before any design decision — not bounded, but not a huge design pass
either.

Full history: `docs/superpowers/BACKLOG.md`, "The player outpaces
near-town/far-corner content well before dungeon tier" section. Short
version: near-town content goes trivial (100% win, 0 potions used) well
before dungeon-tier content becomes reachable at all, and the standing
steer is zone 1 should keep getting *easier* over time, not scale to
track the player — so this isn't "buff monsters," it's specifically
about whether the player's own defense stat is growing too fast
relative to incoming damage, or whether monster attack numbers need
their own independent look. Not investigated yet which.

Paste this in as the opening message of that session:

> Pick up "The player outpaces near-town/far-corner content" thread
> from `docs/superpowers/BACKLOG.md`, specifically the
> "player-defense side" reiteration raised 2026-08-28: "the defense
> scaling needs work too nothing feels dangerous." Read that whole
> section first (it covers the wider context — a deliberately-deferred
> Content Scaling project, the standing "zone 1 should get easier over
> time, not scale to the player" steer, and two already-shipped partial
> answers this doesn't replace). Run the balance simulator
> (`scripts/simulate-balance.js`) before proposing anything — find out
> whether the player's own defense stat is outgrowing incoming damage,
> or whether monster attack numbers need their own independent look,
> rather than assuming either.
