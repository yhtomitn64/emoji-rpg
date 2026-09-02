# Playthrough telemetry logging — design

**Status:** approved for planning
**Session:** 2026-09-01 brainstorming, spun off from the NG+ ceiling
uncap session (see `docs/superpowers/BACKLOG.md`'s "New threads raised
2026-09-01" index entry)

## Problem

Every balance decision in this project so far (NG+ uncap, parry window,
Mythic-tier multiplier) has come from hand-authored numbers, a hunch, or
a one-off `scripts/simulate-balance.js` sweep — never from real play
data. Timothy: "are we logging anything as I'm playing that you can then
query later to see how I'm doing as a playthrough. I think we should do
that so you have actual data." The goal is a record of what actually
happens across a real session (levels, fights, drops, gear choices) that
can be handed to Claude for analysis, without standing up new
infrastructure or accounts.

## Non-goals

- **No Google Analytics or other third-party analytics service.**
  Evaluated and rejected for this use case: GA4 is built for
  marketing/traffic dashboards, not structured gameplay events; querying
  it programmatically needs a service account + BigQuery export or the
  Data API; it adds a third-party script and network dependency to a
  page that currently makes zero external calls; and a live site using
  it would need a consent/opt-out banner (a real Timothy ask, but
  explicitly backlogged — see BACKLOG.md). Revisit only if this design
  proves insufficient.
- **Not multi-user analytics.** Single player (Timothy), local file or
  manual copy/paste, no aggregation, no server-side storage beyond a
  local gitignored file.
- **Not the dev-tunable balance-config layer, difficulty presets, or
  de-addiction settings.** Separate backlog items raised the same
  session; unrelated mechanism, not designed here.
- **Not distinguishing active from idle/backgrounded-tab time.**
  Elapsed-time fields below are wall-clock since session start, which
  can include idle time if a tab is left open. Acceptable for v1 —
  flagged as a possible future refinement, not required now.

## Event envelope

Every event shares this shape; only `type` and its own payload fields
vary:

```json
{
  "ts": "2026-09-01T18:04:22.501Z",
  "elapsedMs": 143207,
  "sessionId": "a1b2c3d4",
  "type": "level_up",
  "...payload fields": "..."
}
```

- `ts` — wall-clock `Date.now()` at the moment the event fired, as an
  ISO string.
- `elapsedMs` — milliseconds since this session's `session_start` event.
  Included on every event so time-between-events math never has to be
  reconstructed from raw timestamps later.
- `sessionId` — a random id generated once per page load (module-level
  state in `js/systems/telemetry.js`, never persisted to the save file).
  Lets one growing log file hold many sessions while staying
  distinguishable.

## Event catalog

| type | payload | fires when |
|---|---|---|
| `session_start` | `{ continuing, level, ngPlusCycle }` | a new game is created or an existing slot is loaded |
| `level_up` | `{ level, ngPlusCycle, elapsedMsSincePreviousLevel }` | the player's level increases |
| `tool_acquired` | `{ toolId, level, ngPlusCycle, elapsedMsSincePreviousTool }` | axe/pick/canoe/portal scroll first picked up |
| `battle_end` | `{ outcome, monsterIds, ngPlusCycle, playerLevel, hpPercentRemaining, durationMs }` | a battle resolves; `outcome` is `main.js`'s own literal strings: `'won' \| 'surrender' \| 'lost' \| 'fled-with-loot' \| 'fled'` (checked against `handleBattleEnd`'s actual callers during planning — richer than a plain win/loss/fled split) |
| `ability_used` | `{ abilityId, inBattle }` | any of the 5 unlockable abilities is triggered |
| `potion_used` | `{ itemId, inBattle }` | any consumable (heal potion or buff potion) is drunk, in battle or from a menu |
| `item_drop` | `{ itemId, tier, sourceMonsterId, ngPlusCycle }` | `rollDrop` produces a non-null `item` |
| `gear_equipped` | `{ itemId, slot, tier, upgradeLevel, replacedItemId }` | `equipItem` succeeds |
| `upgrade_purchased` | `{ itemId, slot, tier, newLevel, goldSpent }` | `upgradeItem` succeeds |
| `ng_plus_started` | `{ newCycle, playerLevel }` | `resetWorldForNgPlus` runs |
| `inventory_snapshot` | `{ equipment, unequippedGear }` | fired alongside every `level_up` and `ng_plus_started` — a full equipped-vs-held dump, since "left a better item unequipped" isn't an event on its own and can only be reconstructed from a periodic snapshot |

`unequippedGear` in `inventory_snapshot` is every gear-slot item
(`ITEMS[id].slot` truthy) currently sitting in `state.inventory`, with
its tier and upgrade level — enough to compare against what's actually
equipped and see whether a real upgrade went unworn.

## Delivery mechanism

**`js/systems/telemetry.js`** — the only module game code calls into
(`logEvent(type, payload)`). Internally:

- Appends to an in-memory buffer, mirrored into `localStorage` under a
  dedicated key, capped at the most recent 2000 events (oldest trimmed
  first) so neither memory nor storage grows unbounded across a long
  session.
- Flushes on a timer (every 10s) or once the buffer passes 20
  unflushed events, whichever comes first.
- On the very first flush attempt each session, `POST`s to
  `/__telemetry`. Success marks a `serverAvailable` flag true for the
  rest of the session and every future flush also posts there
  (fire-and-forget — a failed post is dropped, not retried, so a
  server that vanishes mid-session doesn't create a retry storm).
  Failure (network error, 404 — no dev server, or the live site with no
  backend at all) just leaves `serverAvailable` false; nothing else
  changes.

**`tools/dev-server.mjs`** — a new zero-dependency script (`node:http` +
`node:fs` + `node:path` only, no npm install, no `package.json`
changes) that replaces `python3 -m http.server` for local dev. Serves
the repo root as static files identically to today's workflow, plus one
addition: `POST /__telemetry` reads the JSON body's `events` array and
appends each event as one line to `analytics/events.jsonl` (created on
first write). `analytics/` is added to `.gitignore` — this is
Timothy's own local play data, never committed. `README.md`'s "Run it"
section is updated to `node tools/dev-server.mjs` in place of
`python3 -m http.server 8000`.

**Settings screen (`js/screens/settingsScreen.js`)** — a new "Play Log"
section with a **Copy Play Log** button, always present regardless of
whether the server sink is active. Clicking it serializes the current
in-memory buffer as newline-delimited JSON and copies it via
`navigator.clipboard.writeText`; if the Clipboard API is unavailable or
denied, falls back to showing the text in a `<textarea>` for manual
select-and-copy. This is the only delivery path on the live site (no
backend there), and doubles as an on-demand manual export locally even
when the file sink is already running.

## Integration points

- **`js/main.js`** — `session_start` (new game / continue), `level_up`
  (wherever XP resolution already detects a level increase),
  `tool_acquired` (the existing first-pickup celebration hook already
  identifies "first time holding this tool" —
  `grantDropItem`/`playCelebration` call site), `ng_plus_started`
  (`resetWorldForNgPlus` call site), `item_drop` (the `rollDrop` call
  sites already present for battle/cache/treasure rewards).
- **`js/screens/battleScreen.js`** — `battle_end` (win/loss/flee
  resolution), `ability_used`, `potion_used` (in-battle branch).
- **`js/screens/smithScreen.js`** — `upgrade_purchased` (`tryUpgrade`'s
  success path).
- **`js/screens/inventoryScreen.js`** — `gear_equipped`, `potion_used`
  (out-of-battle branch).
- **`inventory_snapshot`** is emitted from `telemetry.js` itself,
  called alongside the `level_up` and `ng_plus_started` call sites
  above rather than needing its own separate integration point.

## Testing

- Unit tests for `telemetry.js`: buffer capping/trimming, flush
  triggers (time-based and count-based), the `serverAvailable`
  fall-back-on-failure behavior (mocked `fetch`).
- Unit tests for `tools/dev-server.mjs`'s `/__telemetry` handler:
  correct JSONL append, malformed-body handling, static-file serving
  unaffected.
- Manual verification: run `node tools/dev-server.mjs`, play a short
  session, confirm `analytics/events.jsonl` grows with one valid JSON
  object per line; separately, block or stop the server and confirm the
  Settings screen's copy button still produces the same event data.

## Open questions

None blocking — the deferred items above (active-vs-idle time, GA4,
config layer, difficulty presets, de-addiction settings) are out of
scope for this design, not unresolved parts of it.
