# Battle Screen v2 — Design

**Date:** 2026-08-13
**Status:** Approved for planning

## Summary

First of several follow-up passes driven by direct playtesting feedback on the world-expansion release (design doc `2026-08-12-world-expansion-design.md`). This pass is scoped to the battle screen only: it currently ends abruptly with no visual feedback on hits, has an invisible ATB gauge (so the delay before the action menu appears feels like nothing is happening), and only shows the last few log lines. This pass adds hit feedback (flash/shake/floating damage numbers), visible ATB gauges for both combatants, a full scrollable combat log, a brief pause on victory/defeat before the panel closes, and a monster-above/hero-below layout — validated against a live mockup the user reacted to directly (screenshot conversation, not written up separately). It also gives monsters a modest HP bump so fights last a bit longer, without touching the attack/defense balance already tuned in the previous pass.

This is the first of an explicitly ordered backlog: Battle Screen v2 → World Content → Save Slots & Start Screen → Quest Board, with more ideas (random discoverable mini-dungeons, an overall "enemies still feel too easy" balance concern) queued for later passes, not covered here.

## Goals

- Every hit (dealt or taken) is visually legible — you can tell something happened without reading the log
- The ATB gauge is visible, so the pause before your turn reads as "waiting for your turn" instead of "is this broken?"
- The combat log preserves the whole fight, not just the last few lines
- Winning or losing doesn't feel like the screen vanishing out from under you
- None of the above adds perceptible input lag — animations decorate outcomes, they never block or delay the next action
- Fights last a bit longer (via monster HP, not damage/defense) without undoing the last pass's balance work

## Non-goals (for this pass)

- No changes to attack/defense stats, ATB fill rate, or any other balance lever besides monster HP
- No sound effects (visual-only feedback for this pass)
- No changes to battle mechanics (Attack/Item/Flee stay as they are) — this pass is presentation only, except for the HP-only length tweak
- Random discoverable mini-dungeons, the general "enemies feel too easy" concern, and every other backlogged idea are out of scope here — tracked for future passes

## Layout

Validated live via an interactive mockup (monster centered above with HP bar + ATB gauge, a small emoji divider, hero below in the same arrangement, action menu beneath, and a docked sidebar log) — the user confirmed this directly. The battle overlay panel widens slightly to accommodate the sidebar without shrinking the main combatant column.

## Hit feedback

On any hit (player attacking monster, monster attacking player): the target's emoji briefly flashes red-tinted and shakes (short, a few frames, non-blocking), and a floating "-N" damage number rises and fades near it. A critical hit uses the same flash/shake but a bigger, differently-colored number, plus a distinct log line ("Critical! ..."). Numbers and flashes are purely additive to the existing HP-bar update — nothing about hit resolution timing changes.

## ATB gauges

Both the monster and the player get a visible gauge bar beneath their HP bar, filling in real time via the same `tickGauge` logic already driving `isReady`. This is a rendering addition only — no change to fill rate or turn logic.

## Combat log

Replaces the current "last 4 lines" log with a persistent, scrollable sidebar showing the entire fight's history from "A wild X appears!" onward. Auto-scrolls to the newest line as it grows.

## Victory/defeat pacing

On a battle-ending outcome, the panel keeps showing the final state (the killing blow's flash/number, updated HP, log's last line) for roughly 1–1.5 seconds before closing/transitioning — long enough to register what happened, short enough not to feel like a delay. This is a fixed short timer, not a "press any key to continue" gate, matching the "don't slow the game down" constraint.

## Fight length

Monster `hp` values get a modest across-the-board increase (exact numbers determined during implementation/balance-check, same simulation-driven approach as the last pass). `attack`/`defense`/`speed`/`xp`/`goldRange` are untouched — this changes how many exchanges a fight takes, not who's favored to win it.

## Testing approach

Same split as prior passes: any new pure logic (e.g. a crit-chance roll, an HP-bump data change) gets unit tests under Node. The visual/animation work (flash, shake, floating numbers, gauge rendering, log scrolling, pacing timer) is DOM-only and verified by playing the game, per the project's established approach — plus, given a live mockup already validated the core layout/feedback interactions, implementation can lean on that mockup as a reference rather than re-deriving the visual design from scratch.
