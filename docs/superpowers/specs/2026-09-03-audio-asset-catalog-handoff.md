# Audio asset catalog — handoff

Reference doc for the sound-effects/music work brainstormed 2026-09-02/03.
Pulled down on the home machine (RTX 5090) to drive local generation
experiments. Not an implementation plan — no engine code depends on this
file; it's the content list plus the sourcing decisions made so far.

## Sourcing plan (hybrid)

- **Curate from CC0/free libraries** (Kenney.nl, Freesound, OpenGameArt)
  for anything where a real recorded sample beats generation — footsteps,
  common item pickup, coin/shop sounds, quest-complete chime. Diffusion
  audio models are architecturally weaker at sharp percussive transients
  than at tonal/ambient content, so don't lean on generation for the
  things that most need to sound "hard-hitting."
- **Generate music loops with ACE-Step** (github.com/ace-step/ACE-Step,
  MIT license) — purpose-built for instrumental loops, <4GB VRAM.
- **Generate/experiment with impact SFX using Stable Audio 3 Small SFX**
  (`stabilityai/stable-audio-3-small-sfx` on Hugging Face) — a dedicated
  SFX-only model trained on ~1.28M real recorded sounds specifically for
  foley/impact content, the closest thing found to a real upgrade over
  general text-to-audio diffusion for this. Gated repo: needs a free HF
  account, accepting the license on the model page, and a token.

## RTX 5090 setup notes

- Blackwell / sm_120 — needs PyTorch 2.7.0+ built against CUDA 12.8+
  (2.11.0 recommended as of this writing). Confirm the existing local-
  inference setup is already on a recent-enough stack before assuming
  it works out of the box.
- Both tools are trivial on 32GB VRAM; no need to reach for larger/
  heavier models on that basis alone.

## Content catalog

### Music loops (ACE-Step)
| Track | Prompt idea |
|---|---|
| Town theme | calm acoustic folk village theme, warm strings and light percussion, loopable, cozy |
| Overworld/outside theme | adventurous orchestral overworld exploration theme, moderate tempo, loopable |
| Regular battle theme | driving mid-tempo battle theme, percussion-forward, tense but not overwhelming, loopable |
| Boss battle theme | intense epic orchestral boss battle theme, heavy percussion and brass, loopable |

Music tracks need to crossfade against each other in-engine (e.g. town →
battle theme on encounter start) — not a generation concern, noted here
for the later engine design.

### Combat hits (Stable Audio 3 Small SFX)
| Sound | Prompt idea |
|---|---|
| Normal hit | blunt weapon impact hit, short punchy thud |
| Critical hit | heavy powerful weapon impact, sharp crunch, more intense than a normal hit |
| Miss/whiff | weapon swing whooshing through air, no impact |
| Parry success | metal clang, sword parry deflect, sharp and bright |
| Parry miss/fail | dull thud, failed block, weapon glancing off armor |
| Timing ability success | satisfying chime hit, precise successful timing cue |
| Timing ability fail | flat buzz, mistimed failure cue |
| Revive | uplifting magical revival swell, short |
| Monster ability (generic) | guttural creature attack sound, growl into a strike |

### Per-ability swing SFX (Stable Audio 3 Small SFX)
Matches `js/systems/abilities.js` (post ability-rotation-v2 rename).

| Ability (code id) | Flavor | Prompt idea |
|---|---|---|
| Impale (`stab`) | dagger/rapier thrust | quick sharp stabbing thrust sound, dagger |
| Sever (`chop`) | heavy axe chop | heavy axe chop impact, wood and bone crunch |
| Lacerate (`slash`) | sword slash | fast sword slash through the air, sharp swish into a cut |
| Faultline (`sweep`) | ground-shaking sweep | low rumbling ground smash, rock impact, earth shaking |
| Super Scream (`superScream`) | shout/roar (buff) | powerful battle shout roar, motivating war cry |

### UI/menu (Stable Audio 3 Small SFX)
Tactile and crisp, not electronic bleeps.

| Sound | Prompt idea |
|---|---|
| Menu move (navigate) | soft tactile click, subtle UI navigation tick |
| Menu select (confirm) | solid tactile click, slightly higher pitched confirm sound |
| Close dialog | soft short whoosh close, UI dismiss |
| Invalid action (e.g. not enough gold) | short dull buzz, denied error cue, not harsh |

### Progression/milestone
| Sound | Source | Prompt idea |
|---|---|---|
| Level up | generate | triumphant short magical chime rise, level up fanfare |
| Item pickup (common) | curate | small, snappy "item get" blip |
| Legendary/rare item reveal | generate | grand shimmering magical reveal, rare item fanfare |
| New tool celebration | generate | exciting triumphant short fanfare, unlock reward |
| Quest turn-in | curate | quest-complete chime |
| Shop buy/sell | curate | coin/cash register style clink |
| Smith upgrade success | generate | metal forge hammer strike, upgrade success clang |

### World/movement
Mostly curate — real recorded footsteps beat generated ones.

| Sound | Source | Notes |
|---|---|---|
| Walking/footstep | curate | stone/dirt footstep loop, Kenney/Freesound |
| Discovery/chokepoint reveal | generate | mysterious short discovery sting |
| Cache/mini-dungeon open | generate | heavy stone door or chest opening, echoey |
| Comeback/post-death warp | generate | eerie magical warp/teleport sound |

### Battle flow
| Sound | Prompt idea |
|---|---|
| Battle start | sudden dramatic sting, battle alert stinger |
| Battle end/victory | short triumphant victory jingle |
| Boss battle start | ominous epic dramatic stinger, boss encounter alert |
| Boss battle end/victory | grand triumphant epic victory fanfare, longer than normal victory |

### Potions (Stable Audio 3 Small SFX)
Matches `js/systems/buffPotions.js` + the base heal potion in
`js/data/items.js`.

| Potion (emoji) | Prompt idea |
|---|---|
| Potion 🧪 (heal) | bubbly liquid glug, refreshing potion drink |
| Strength Draught 💥 | powerful surge whoosh, muscle strain grunt, drink then power up |
| Iron Skin Tonic 🛡️ | metallic clank shield forming, protective drink |
| Swift Elixir 💨 | quick airy whoosh, speed boost drink |
| Vampiric Tonic 🩸 | dark wet squelch, ominous drink, faint heartbeat |
| Momentum Elixir 🌀 | swirling whirl sound, spinning energy drink |
| Ember Vial 🔥 | fire crackle sizzle, warm ignition drink |
| Thornbark Draught 🪵 | wood creak, thorny snap, earthy drink |
| Focus Tonic 🎯 | sharp focus chime, lock-on ping, clear-minded drink |
| Berserker Tonic 💢 | aggressive grunt roar, adrenaline surge drink |
| Second Wind 🕊️ | gentle angelic swell, second-chance chime |

## Not yet decided (forward context, not blocking generation)

- **Audio engine** — an `AudioManager` wired into `state.settings`
  (existing flat-object + `callbacks.onChange()` pattern seen in
  `js/screens/settingsScreen.js`) for per-category mute toggles and
  volume sliders. Category granularity not yet settled.
- Exact list of sound *categories* for the settings sliders (e.g.
  Master/SFX/Music, or finer-grained combat vs. UI vs. ambient) is still
  open — pick this once we've heard how the generated/curated sounds
  group naturally.
