# Battle animations — handoff for next session

Started 2026-08-28, handed off mid-work so a fresh session can pick it up
without the current session's now-very-long context (spent mostly on an
npm-registry/git-history detour, unrelated to this). Source ask:
`docs/superpowers/BACKLOG.md`'s "Level-up and general animation pass"
entry, "Update (2026-08-28)" paragraph — Timothy's own words there.

## What's already shipped — don't rebuild these

- **Crit shake.** `playCritReaction` (`js/screens/battleScreen.js`)
  already shakes `elements.dialog` (`.overlay-panel.battle-screen`) and
  sways `elements.decoration` on every crit, either side, wired through
  `playHitEffect`. Shipped in an earlier, unrelated session (commit
  `e8c91cb`) - just never marked in the backlog until today. CSS:
  `.battle-dialog-shake-crit` / `.battle-decoration-sway-crit` in
  `css/styles.css` (~line 687).
- **Themed attack animations** (melee lunge vs. ranged projectile per
  monster, food-themed projectile emoji) - also already shipped, unrelated
  to this handoff but mentioned here in case it looks related: see
  `playMeleeLunge`/`playRangedProjectile` in `battleScreen.js`.
- **`#app`'s dim/undim now transitions smoothly** (`transition: filter
  0.3s ease`, `css/styles.css` line ~4) instead of snapping instantly.
  Small, already-done first step toward the battle-start/end fade ask
  below - every overlay (not just battle) benefits.

## Still open - what this session needs to build

Timothy's own words, for reference: "Need to do a cool
animation/effect/transiation when the battle starts like the map
slightly fades out or pixelates and the battle area swirls in or
something... Also battle is over transition back to map in a cool way."
And separately: "When doing perfect timing should get a cool effect or
visual and feel free to start going wild with some 3d thing or
implementing three js at some point just to start spicking it up!"

None of the below is designed/scoped beyond what's written here - these
are this session's own working notes/plan, not something Timothy signed
off on in detail, so use judgment and keep them in the loop on anything
that feels like a real design choice, same as any other creative work.

### 1. Battle-start entrance ("swirls in")

Target: `.overlay-panel.battle-screen` itself (`elements.dialog` in
`battleScreen.js`, queried via `rootEl.querySelector('.overlay-panel
.battle-screen')` around line 194). Since `buildDom()` sets
`rootEl.innerHTML = template` fresh on every `mount()`, a brand new
element gets whatever CSS `animation` class is in the template's own
class list automatically - no JS class-toggling needed, it just plays
once on creation. Rough shape:

```css
.overlay-panel.battle-screen {
  animation: battle-screen-swirl-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes battle-screen-swirl-in {
  0% { opacity: 0; transform: scale(0.4) rotate(-25deg); }
  60% { opacity: 1; transform: scale(1.05) rotate(4deg); }
  100% { opacity: 1; transform: scale(1) rotate(0deg); }
}
```

Untested numbers - tune by actually looking at it. The `#app` dim
transition (already shipped, see above) handles the "map slightly fades
out" half; this handles the "battle area swirls in" half. A true
pixelate effect (Timothy's other floated option) is much harder in plain
CSS (no native pixelation filter) - the blur/scale approach above is the
practical substitute, not a literal reading of "pixelates."

### 2. Battle-end exit, back to map

Harder than the entrance: `screenManager.js`'s `unmountOverlay()` clears
the DOM synchronously (`root.innerHTML = ''`), so there's no window for
a CSS exit animation to play unless something delays that. Good news:
one already exists - `endBattle()` (`battleScreen.js`) already waits
`VICTORY_PAUSE_MS` (1200ms) via `setTimeout` before calling
`callbacks.onBattleEnd(...)` (which is what triggers `unmountOverlay()`
in `main.js`'s `handleBattleEnd`). Plan: add an exit-animation class to
`elements.dialog` timed to *finish* right as that pause ends, e.g.:

```js
const EXIT_ANIM_MS = 400;
setTimeout(() => elements.dialog?.classList.add('battle-screen-swirl-out'), VICTORY_PAUSE_MS - EXIT_ANIM_MS);
```

placed inside `endBattle()`, alongside the existing `endBattleTimeoutId =
setTimeout(...)` call. Don't just play it immediately at the start of
the pause - it'd finish early and then sit static/shrunk for the rest of
the 1200ms, which would look broken, not intentional.

### 3. Perfect-timing visual payoff

Two distinct trigger points, both currently get *no* distinct visual
beyond the ordinary hit-flash + a log-text suffix:

- **Ability timing-hit.** `timingHit` (`battleScreen.js`, both the
  single-target and AOE branches of `playerUseAbility`, search
  `Perfect timing!`) only affects the log suffix and the damage
  multiplier today.
- **Successful parry.** `resolveMonsterWindup`'s parried branch (search
  `resolveParryAttempt`) calls `playHitEffect(..., false)` - note
  `isCrit` is hardcoded `false`, so a parry never even gets the
  already-shipped crit shake, let alone something distinct for landing
  the parry itself.

Plan: a shared `playPerfectTimingEffect(zoneEl)` helper (same
positioned-on-`<body>` pattern as `showDamageNumber` - grab
`zoneEl.getBoundingClientRect()`, append a fixed-position badge) that
shows something like "PERFECT!" with a bright burst/scale-pop animation,
distinct from both the plain hit-flash and the crit shake. Call it:
- In both ability-use branches when `timingHit` is true, on the target's
  zone (`elements.monsterZones[...]` or the single target's zone).
- In the parry-success branch, on `elements.heroZone` (the player's own
  zone - the parry was the player's own successful read/action).

Consider whether a successful parry should *also* get the crit-shake
treatment (pass `true` instead of the hardcoded `false` to
`playHitEffect`) as part of this - reads like it should, given "perfect
timing" is exactly what a parry is, but that's a judgment call worth
surfacing rather than assuming.

### 4. Proud tool-pickup moment (separate backlog item, same
"spike up animations" theme)

`docs/superpowers/BACKLOG.md`'s own entry, raised 2026-08-28: "after
getting axe, pick, canoe the character should hold it over head, then it
should fly around their body and then a message should prodouly exclaim
what you can do and a big bubble or something on the screen so it's
obvious to read." Extends `playCelebration` (`js/screens/
celebrationEffect.js`), called from `grantDropItem`'s `isNewTool` branch
in `js/main.js`. Current celebration primitive: an emoji "burst" pop
(`#celebration-burst`) plus optional big embossed text
(`#celebration-big-text`, `options.bigText`) - see
`css/styles.css` ~line 731 for both. This ask wants a richer *sequence*
(hold-overhead pose → orbit/fly-around flourish → capability callout),
not just a bigger single pop - probably a new, distinct celebration
variant/mode rather than reusing `playCelebration` as-is unchanged,
since the existing one is a single burst+text pop, not a multi-stage
sequence. Worth a quick design pass on what "hold it over head" even
means for a plain emoji character (no sprite/pose system exists) before
building - likely a stylized simplification (the tool emoji floating up
above the hero briefly, then orbiting, rather than literal pose changes).

## Testing / verification notes

- No jsdom pixel-level visual testing exists (jsdom's layout engine is a
  no-op) - all of the above needs live-browser verification of the
  actual look/feel, not just code-tracing. Per standing preference this
  session has been following, don't drive that verification via
  `mcp__claude-in-chrome` - either ask Timothy to look at it live, or
  describe clearly what you built and let him judge the feel.
- `tests/battleScreenDom.test.js` (shipped this session, see
  `docs/superpowers/BACKLOG_SHIPPED.md`'s "Testing infra" entry) is the
  reference pattern for any *structural* DOM assertions worth adding
  alongside this (e.g. "the perfect-timing badge element exists after a
  timing-hit ability use") - it won't tell you anything about how an
  animation actually looks, just that the right DOM/classes got touched.
