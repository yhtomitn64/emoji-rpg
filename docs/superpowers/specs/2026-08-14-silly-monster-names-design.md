# Silly Monster Names — Design

## Purpose

Regular-tier and dungeon-tier trash monsters currently have generic fantasy names (Boar, Bat, Snake, Goblin, Dire Wolf, Giant Spider, Orc, Wraith). This feature replaces those display names with goofy food/object names, chosen collaboratively with the user, while the actual boss (Dragon) keeps a traditional, scary name. Emoji, stats, and drop tables are unchanged — this is a display-name and light-flavor-text change only.

## Scope

**In scope:**
- Rename `name` field for 8 monsters in `js/data/monsters.js`: `boar`, `bat`, `snake`, `goblin`, `direWolf`, `spider` (regular tier) and `orc`, `wraith` (dungeon tier, "intensified" style names, not paired 1:1 with any regular monster).
- `dragon` (the actual boss) is explicitly excluded — keeps the name "Dragon".
- Small flavor-text touch on encountering `orc` or `wraith`: a chance to show a themed flavor line instead of the generic "A wild X appears!" battle-log opener.

**Out of scope (deferred to backlog):**
- Changing any monster's emoji — all 8 keep their current emoji (🐗🦇🐍👺🐺🕷️👹👻); only the name changes.
- Item names (`wolfPelt`, `spiderSilk`, `snakeFang`, etc.) — untouched.
- A general flavor-text system for all monsters or all encounters — this feature only adds flavor lines for `orc` and `wraith`, reusing the pattern narrowly. A broader system is a separate future item if wanted.

## Names

| id | emoji | tier | old name | new name |
|---|---|---|---|---|
| `boar` | 🐗 | regular (near-town) | Boar | **Snorty McPigface** |
| `bat` | 🦇 | regular (near-town) | Bat | **Spooky Pancake** |
| `snake` | 🐍 | regular (near-town) | Snake | **Slippery Breadstick** |
| `goblin` | 👺 | regular (near-town) | Goblin | **Mean Meatball** |
| `direWolf` | 🐺 | regular (far-corner) | Dire Wolf | **Mega Muffin** |
| `spider` | 🕷️ | regular (far-corner) | Giant Spider | **Eight-Leg Eggroll** |
| `orc` | 👹 | dungeon | Orc | **Super Mean Meatloaf** |
| `wraith` | 👻 | dungeon | Wraith | **Ghost Apple Supreme** |
| `dragon` | 🐉 | boss | Dragon | *unchanged* |

### Reserve name bank (not used, kept for future monster additions)

Big Angry Ham, Bacon Bruiser, Grumpy Porkchop, Ceiling Nugget, Screechy Crouton, Grumpy Waffle, Angry Spaghetti, Sneaky Sausage, Noodle of Doom, Evil Eggplant, Cranky Cabbage, Grumpy Gourd, Dire Banana, Furious Fritter, Rowdy Rutabaga, Ghost Apple, Tangled Toast, Creepy Crumpet, Colossal Calzone, Furious Casserole, Dread Sourdough, Phantom Pudding, Super Spooky Marshmallow, Dread Yogurt.

## Encounter flavor text (orc, wraith only)

Each of `orc` and `wraith` gets a new `flavorLines` array (3 strings each) in `js/data/monsters.js`:

```js
orc: {
  // ...existing fields...
  flavorLines: [
    'You smell burnt garlic bread. Super Mean Meatloaf has entered the room.',
    'Super Mean Meatloaf lumbers out of the shadows, still steaming with rage.',
    'Super Mean Meatloaf glares at you like you insulted its secret recipe.',
  ],
},
wraith: {
  // ...existing fields...
  flavorLines: [
    'A chill rolls in. Ghost Apple Supreme has come for seconds.',
    'Ghost Apple Supreme drifts through the wall, unnervingly translucent and smelling faintly of cinnamon.',
    'Ghost Apple Supreme rattles its core ominously.',
  ],
},
```

No other monster gets a `flavorLines` field.

### Trigger logic

In `js/screens/battleScreen.js`, `mount()` currently sets:

```js
log = [`A wild ${MONSTERS[monsterId].name} appears!`];
```

This becomes: if the monster has a non-empty `flavorLines` array, roll a 35% chance to use a random entry from it as the opening log line instead of the generic template. Otherwise (65% of the time for orc/wraith, and always for every other monster), keep the existing `A wild ${name} appears!` line. The random pick is a simple `flavorLines[Math.floor(Math.random() * flavorLines.length)]` — no need to avoid immediate repeats given only 3 lines and infrequent dungeon encounters.

## Testing

Extend `tests/data.test.js`'s existing "every monster has required fields" loop with two more assertions per monster:
- `monster.name` is a non-empty string.
- If `monster.flavorLines` is present, it's a non-empty array of non-empty strings.

No test needs to assert the *specific* chosen names (that would make the test fragile to future renames) — just structural validity.

Manual verification: fight a boar/bat/snake/goblin/direWolf/spider and confirm the new name shows in the battle screen, stats panel is unaffected (monsters don't appear there), and the combat log reads correctly with the new name substituted into existing template strings (e.g. "You hit Mean Meatball for 5."). Fight the dungeon tier a few times to see both the generic appears-line and (eventually) a flavor line for orc and wraith. Confirm the dragon still says "Dragon".

## Non-goals confirmed with user

- No emoji changes.
- No 1:1 pairing between orc/wraith and any specific regular-tier monster — they're independently named with an "intensified" tone.
- No broader flavor-text system built now — just this narrow orc/wraith touch.
