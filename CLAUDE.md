# emoji-rpg — project instructions

Solo personal project. A push to `main` **is** the release — CI
(`.github/workflows/deploy.yml`) deploys straight to
`rpg.burghertime.com` on every push, no separate release step. See
`CHANGELOG.md`'s own header for the MAJOR.MINOR.PATCH versioning rules
(when to bump MINOR vs. PATCH).

## Versioning checklist — run through this before every push

This repo has two changelogs that must move together, plus an in-game
footer that only reads one of them. They drifted out of sync once
already (game showed `v0.7.0` live while the dev changelog had already
moved to `0.7.1` with more unbumped fixes sitting in `Unreleased`) —
see the `0.7.2` entry in `CHANGELOG.md` for the full story. Follow this
every time to keep it from happening again:

1. **Every commit that touches non-doc files needs a `CHANGELOG.md`
   entry** under `## [Unreleased]`. CI already enforces this
   mechanically (fails the deploy if it's missing).
2. **Before pushing, bump `Unreleased` into a new dated version
   section** (`## [x.y.z] - YYYY-MM-DD`, today's date) rather than
   leaving it sitting in `Unreleased`. For this repo specifically,
   treat *every push* as a release: since a push deploys immediately,
   an un-bumped `Unreleased` block means the live game has shipped
   changes with no version number attached to them yet, which is
   exactly the confusing state that prompted this checklist. Pick
   PATCH vs. MINOR per the rules in `CHANGELOG.md`'s header.
3. **Add a matching entry to `js/data/playerChangelog.js`**
   (`PLAYER_CHANGELOG`, newest first) for that same version number.
   This is the one the in-game footer and "What's New" screen actually
   read (`PLAYER_CHANGELOG[0]` in `js/main.js`) — `CHANGELOG.md` is
   developer prose and is *not* shown to the player. Only list what a
   player would actually notice; skip internal-only changes (CI,
   tooling, refactors, dev-doc updates).
4. **Run `npm run test`.** `tests/versionSync.test.js` fails the whole
   suite if `CHANGELOG.md`'s newest dated version and
   `PLAYER_CHANGELOG[0].version` don't match — a mechanical backstop,
   not a substitute for actually doing step 2 and 3.
5. Commit the code change and both changelog files together, then
   push.

If a push is docs-only (no gameplay change), skip steps 2–3 — there's
nothing for a player to see — but still append `[skip ci]` to the
commit message per the personal global instructions.
