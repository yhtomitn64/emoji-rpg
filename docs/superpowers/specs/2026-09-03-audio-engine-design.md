# Audio engine — design

**Status:** approved for planning
**Session:** 2026-09-02/03 brainstorming, following the content catalog in
`docs/superpowers/specs/2026-09-03-audio-asset-catalog-handoff.md`

## Problem

The game has no audio at all — no `Audio`/`AudioContext` usage anywhere
in `js/`. We want sound/music, sourced from a hybrid of curated CC0
clips and locally-generated audio (tracked in the handoff doc above,
happening on a separate machine). This doc covers the **playback
engine and settings** only — asset content is out of scope here.

Two requirements shape the architecture more than a basic "play a
clip" system would:
1. **Volume/mute controls split across 4 categories** (Combat/UI/World/
   Music), not just a single master volume.
2. **Sound themes** (e.g. "realistic," future "metal"/"symphony"/
   "chiptune" packs) that swap every sound in the game, loaded on
   demand so an unused theme never costs bandwidth.

## Architecture

New module `js/systems/audio.js`, built on the Web Audio API rather
than plain `<audio>` elements — needed for overlapping SFX (combat can
fire several hits in quick succession) and for looping/crossfading
music without gaps.

- One `AudioContext`, created lazily and resumed on the first user
  gesture (`unlockAudio()`, called once from wherever the game already
  handles its first click/keypress — e.g. `startScreen.js`) to satisfy
  browser autoplay policies.
- A gain-node graph: `masterGain → categoryGain[Combat|UI|World|Music]
  → per-play GainNode → destination`. Category gains implement the 4
  sliders; the per-play node lets one clip fade independently (used for
  music crossfade).
- Decoded `AudioBuffer`s are cached in memory keyed by `` `${theme}:${soundId}` ``
  after first fetch+decode, so repeat plays of the same sound are
  instant and each buffer is only ever downloaded once per session.
- `playSfx(soundId)` — fire-and-forget, respects the Combat/UI/World
  category from the manifest.
- `playMusic(soundId, { crossfadeMs = 1500 } = {})` — starts a looping
  source, ramping the previous music track's gain to 0 and the new
  one's up over `crossfadeMs`, then stops the old source.
- `stopMusic({ fadeMs } = {})` — fades out and stops.
- `setCategoryVolume(category, 0..1)` / `setCategoryMuted(category, bool)`
  / `setTheme(themeId)`.
- A missing or failed-to-load file **never throws** — `playSfx`/
  `playMusic` catch the fetch/decode error, `console.warn` once per
  `soundId` (not once per play, to avoid log spam), and no-op. This is
  deliberate: most call sites will be wired up before all the audio
  files exist.

## Sound manifest and theming

`js/data/soundManifest.js` — the single source of truth mapping every
sound ID from the catalog doc to its category and its per-theme file
path:

```js
export const SOUND_CATEGORY = {
  hitNormal: 'combat',
  menuMove: 'ui',
  walking: 'world',
  townTheme: 'music',
  // ...one entry per catalog sound ID
};

export const DEFAULT_THEME = 'realistic';

// Only entries that exist get filled in; missing per-theme entries
// fall back to DEFAULT_THEME (see resolvePath below).
export const SOUND_THEMES = {
  realistic: { hitNormal: 'assets/audio/realistic/sfx/hitNormal.mp3', /* ... */ },
  metal: { /* filled in later, only for sounds that exist */ },
};
```

Path resolution: `resolvePath(theme, soundId)` returns
`SOUND_THEMES[theme]?.[soundId] ?? SOUND_THEMES[DEFAULT_THEME][soundId]`.
This is what makes partial themes work — a theme pack can cover 5
sounds or all 50, and anything it doesn't have silently borrows the
default theme's file rather than playing nothing.

Because loading is already lazy (fetch-on-first-play), switching
`state.settings.soundTheme` costs nothing until a sound actually
triggers — no upfront download for a theme just because it's selected,
and the initial page load is unaffected no matter how many themes are
ever added. Switching themes clears the in-memory buffer cache for the
*previous* theme's entries (not the whole cache — `realistic` fallback
buffers already loaded stay cached) so memory doesn't grow unbounded
across repeated switching in one session.

File layout: `assets/audio/<theme>/sfx/<soundId>.<ext>` and
`assets/audio/<theme>/music/<soundId>.<ext>`. Extension is whatever the
dropped-in file is (`decodeAudioData` doesn't care) — the manifest
stores the full filename including extension, so mixing `.mp3` and
`.ogg` across sounds is fine.

## Settings

Extends the existing per-save-slot pattern (`state.settings`, flat
object, `js/state.js`) rather than introducing a separate prefs store —
matches `itemMenuAutoCloseMs` precedent:

```js
settings: {
  itemMenuAutoCloseMs: DEFAULT_ITEM_MENU_AUTO_CLOSE_MS,
  soundTheme: 'realistic',
  audioCombatVolume: 0.8, audioCombatMuted: false,
  audioUiVolume: 0.8,     audioUiMuted: false,
  audioWorldVolume: 0.8,  audioWorldMuted: false,
  audioMusicVolume: 0.6,  audioMusicMuted: false,
}
```

`migrateLegacySave` (`js/state.js`) gets the same treatment as the
existing settings migration — old saves default in these fields rather
than breaking.

`js/screens/settingsScreen.js` gets 4 new slider+toggle rows (mirroring
the existing `settings-row` markup) and a theme `<select>` populated
from `Object.keys(SOUND_THEMES)`. Same `callbacks.onChange()` wiring as
the existing auto-close input.

## Hook-point wiring

Every sound ID in the catalog doc gets a call site now, even though
most audio files don't exist yet (graceful no-op handles that). This
is the bulk of the implementation work — mechanical, one call per
existing effect function or event:

- Existing `play*Effect` functions (`playHitEffect`, `playPlayerSwing`,
  `playReviveEffect`, `playLevelUpEffect`, `playCelebration`,
  `playToolCelebration`, `playItemPickupToast`) — add one `playSfx(...)`
  call each.
- New call sites: menu nav/select — there's no shared menu-input
  module, each list-driven screen handles its own arrow-key/selection
  logic locally (confirmed at least `mapScreen.js` and
  `battleScreen.js` do; other screens with selectable lists get the
  same treatment during implementation), dialog close (`dialogChrome.js`), potion use
  (`buffPotions.js` / inventory & battle item-use paths), walking step
  (`exploration.js` or `worldGrid.js` movement handler), battle/boss
  start & end (`battleScreen.js`, `bossPromptScreen.js`), parry
  success/miss (`parry.js`), timing ability success/fail, discovery/
  cache/comeback (`discovery.js`, `caches.js`, `comeback.js`), elite
  encounter sting (`eliteEncounter.js`).
- Music: town/overworld/battle/boss/dungeon themes triggered on screen/
  encounter transitions (`screenManager.js`, `mapScreen.js`,
  `battleScreen.js` entry/exit), using `playMusic` so they crossfade.

## Testing

Unit tests (`tests/audio.test.js`, `node --test` + jsdom, matching
existing test style) cover the manager's pure logic with a mocked
`AudioContext`/`fetch`:
- Category volume math and mute overrides (mute wins over volume,
  volume of 0 vs. muted are distinct states).
- Theme path resolution, including fallback to `DEFAULT_THEME` for a
  sound the current theme doesn't have.
- Missing-file handling never throws and warns once, not per-play.
- Settings migration fills in new fields on old saves.

Actual audible playback isn't testable in Node — verified by ear in a
browser once real files land.

## Non-goals

- Producing the actual audio files — tracked entirely in the catalog
  handoff doc; this system just plays whatever exists.
- Building out `metal`/`symphony`/`chiptune` content — the plumbing
  supports them (drop files, add manifest entries, zero code changes),
  but only the default theme ships with real content initially.
