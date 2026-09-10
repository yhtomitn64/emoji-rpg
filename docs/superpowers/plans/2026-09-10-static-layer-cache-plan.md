# Static layer cache for the map's canvas renderer — plan / handoff

Raised by Timothy 2026-09-10, straight after the walk-stutter fix
(0.32.4) shipped: "maybe a performance issue with how we do the where
you have walked feature. I notice when I make the window really really
big and walk around I get frame drops." And, crucially, a second
observation a minute later:

> "when I walk away from an area with no paths then performance back to
> top speed fps"

That second one is the diagnosis in one sentence — the cost tracks the
worn-path trail being *on screen*, not the window size on its own.

## Measured, before writing any code

Benchmark drove the real pipeline (mapScreen's render context →
`buildDrawList` → the canvas painter) under jsdom with a stub 2d context
and a hand-driven animation-frame queue, holding a direction so the real
walk loop produced real steps. **JS only — the stub rasterises nothing,
so a real browser pays these canvas calls on top.**

| window | ground walked | tiles | ms/frame | canvas ops/frame |
| --- | --- | --- | --- | --- |
| normal (1008x624) | 0% | 273 | 0.31 | 962 |
| normal | 100% | 273 | 1.98 | 10,606 |
| maximised (2560x1400) | 0% | 1537 | 0.76 | 3,537 |
| maximised | 100% | 1537 | **7.70** | **46,668** |

- The trail is **~92% of all draw calls** at full coverage.
- Window area and trail density *multiply*: 0.31ms → 7.70ms is 25x.
- 7.70ms is **46% of a 16.7ms frame budget** before any rasterisation.
- Walking onto clean ground drops 46,668 ops back to 3,537, which is
  exactly the recovery Timothy described.

Two honest caveats, so nobody over-reads the table:

1. This is a **synthetic worst case** — every visible tile visited, all
   four edges crossed. Real saves are sparser. Treat it as the shape of
   the problem, not a framerate prediction.
2. It is **pre-existing**, not caused by 0.32.4's camera coupling. That
   changed where the camera aims, not how often the loop runs; the loop
   already ran every frame while walking, because the hero's stride
   keeps `heroSettled` false the whole time.

The benchmark itself is not committed. Rebuild it from this description
if needed — or better, build it as the permanent jsdom perf-regression
test BACKLOG.md has been asking for since 2026-09-09.

## The actual problem

`frame()` calls `buildDrawList` and repaints **every** op **every**
frame, including every trail stroke, gradient and hub — for content that
only changes when the player actually steps on a tile. ~46k canvas
operations a frame to redraw something essentially identical to the last
frame.

## The fix, and the trap in it

Cache the static content to an offscreen canvas, blit it with one
`drawImage` per frame, and only rebuild when something really changed.

**The trap:** paint order is *per-cell interleaved*, not layered.
`buildCellOps` emits, per cell, `ground → questGlow → portalShadow →
trail → glyphs`, and cells run in row-major order — so cell B's *ground*
deliberately paints over cell A's overhanging tree. The naive
"all floors first, then all sprites" split therefore changes obstacle
overlap, and BACKLOG.md separately warns it changes how trail strokes
end at unvisited tiles (a tile's ground clips its neighbour's round cap).

**So the cut is not floor-vs-sprite, it is static-vs-animated.** Trees
and decorations are every bit as static as the trail —
`pickTileVariant`/`hash01` make them a pure function of world
coordinates. Caching *whole cells*, in the existing row-major order,
preserves the interleaving exactly.

### The split

A cell is **dynamic** (drawn live every frame) if it is any of:

- the player's own cell,
- `questReady` (the glow pulses),
- a portal tile (`portalShadow` pulses),
- a guardian.

Everything else is **static** and goes in the cache.

Note the fidelity argument that makes this safe: a dynamic cell drawn
*after* the cache could cover a later static cell's ground that used to
clip it — but portals and guardians are **already** `zBoosted` (drawn in
a separate later pass today), and the hero is **already** drawn in a
final pass after every tile. So for three of the four categories the
ordering is unchanged by construction. Only `questReady` genuinely
moves, it is town-only, and town never pans. **Check the quest board in
town against the live build before calling this done.**

## Invalidation — where the real design work is

Two independent reasons the cache goes stale:

1. **Content changed.** A step re-marks the tile stepped onto and the
   tile stepped off, so their trails change.
2. **Camera panned** past what the cache covers.

Rebuilding on (1) means a full rebuild every ~110ms — a ~7.7ms spike
landing on the exact frame the step lands on. That risks reintroducing
the per-step hitch 0.32.2 and 0.32.4 just removed, so **do not ship a
naive rebuild-on-step**.

Recommended instead — a **hot zone**:

- Draw a small live neighbourhood (3x3) around the player every frame,
  on top of the cache. Every tile whose trail can change is within one
  tile of the player, so it is always inside the zone.
- Content changes therefore never invalidate the cache at all.
- When the zone moves, **patch the cells that just left it** into the
  cache (≤3 per step). Their content is final by then — the player is
  2+ tiles away and can no longer alter them without coming back.
- Rebuild in full only on camera-out-of-bounds. Cache viewport + a
  generous pad (~12 tiles) so that is roughly once per 12 steps.

If the out-of-bounds rebuild spike is visible, the next step is
scroll-blitting: `drawImage` the old cache into its new offset position
and redraw only the newly exposed strip, instead of the whole thing.
Don't build that until it is measured to be needed.

When patching a single cell into the cache, remember the ordering rule
above: redrawing cell C in place lets C's ground cover content that
bled *up* into C from the row below (obstacles anchor bottom and bleed
upward). Patch a small block in row-major order including the row below,
rather than the one cell.

## Suggested order of work

1. Split `buildDrawList` output into `staticOps` / `dynamicOps` (pure
   data change in `js/systems/mapDrawList.js`, fully unit-testable — no
   canvas needed, which is the whole point of that module's seam).
2. Add the offscreen cache + blit in `js/screens/mapCanvasRenderer.js`,
   with the dumbest possible invalidation (rebuild on any change).
   **Measure.** Confirm the per-frame win is real.
3. Add the hot zone + leaving-cell patching. **Measure again**, and
   specifically look for the per-step spike.
4. Visual check against a real save: obstacle overlap, trail ends at
   unvisited tiles, the town quest board's glow, portal shadow bleed.
   `?renderer=dom` still exists to A/B against the old renderer.

Measure at each step rather than at the end — this loop has twice now
had a plan overturned by a measurement (see BACKLOG.md's "Micro-pause
once per step" and "Residual walk micro-stutter" entries).

## Testing notes worth not rediscovering

- jsdom returns null from `getContext('2d')`, so the canvas renderer's
  `frame()` no-ops out on its first line. `tests/mapWalkSmoothness.test.js`
  (added 0.32.4) shows the working pattern: a recording Proxy stub for
  the 2d context, plus stubbed `clientWidth`/`clientHeight` to drive a
  chosen viewport size.
- The animation-frame stub **must be a real queue**. mapScreen's walk
  loop and the renderer's draw loop each hold a registration at the same
  time; a single-callback stub silently drops one and the character
  never takes a second step. This cost a debugging round already.
- `__testables.readCameraState()` exposes camera/hero position for
  assertions.
