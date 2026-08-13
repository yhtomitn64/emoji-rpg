# Battle Screen v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the battle screen visual feedback (hit flash/shake, floating damage numbers, crits), visible ATB gauges, a full scrollable combat log, a brief pause on victory/defeat, keyboard shortcuts, and a monster-above/hero-below layout — validated against a live mockup — plus a modest monster HP bump so fights run a little longer without touching the balance already tuned.

**Architecture:** `js/screens/battleScreen.js` moves from "rebuild the whole panel's `innerHTML` every 300ms tick" to "build the DOM structure once on mount, then update specific elements (HP bar width, ATB bar width, log contents, menu visibility) as state changes." This is required for the new animations (flash/shake/floating numbers) to work at all — a full `innerHTML` replacement every tick would reset any CSS transition or animation mid-flight. Combat math additions (crit chance, crit multiplier) stay pure functions in `js/systems/combat.js`, consistent with the existing architecture.

**Tech Stack:** Same as the rest of the project — plain HTML/CSS/JS (ES modules), no build tooling, no npm dependencies, `node:test` for pure-logic tests.

## Global Constraints

- No build tooling: no bundler, no transpiler, no npm dependencies.
- Node.js 18+ required to run tests (`npm test` runs `node --test tests/*.js`).
- Pure game-logic modules (`js/systems/*.js`) must have no `document`/`window`/DOM references.
- No animation may delay when the game actually accepts input — the ATB gauge, menu, and keyboard shortcuts must always reflect the true, current combat state; animations are purely additive visual decoration on top of state that has already changed.
- This pass touches only the 6 "regular tier" monster HP values (`boar`, `bat`, `snake`, `goblin`, `direWolf`, `spider`). `orc`, `wraith`, and `dragon` are explicitly left untouched — their stats were carefully tuned across multiple balance passes already (most recently the dragon's `attack` value, tuned to keep potions viable below level 9), and the user has specifically praised the current dungeon/boss difficulty. Re-touching those numbers here risks undoing that work for a goal ("fights last a little longer") that doesn't need it there.
- Keyboard shortcuts (A/I/Esc) are only live while the action menu is showing (ATB ready, battle not over) — inert otherwise, so they can never fire an action out of turn.
- The victory/defeat pause is a fixed ~1.2 second timer (not a "press any key" gate), so it can never trap the player waiting.

---

## File Structure

```
js/
  systems/
    combat.js                  # MODIFY: add rollCrit, applyCritMultiplier
  screens/
    battleScreen.js             # MODIFY: DOM restructure, hit feedback, pacing, keyboard shortcuts
  data/
    monsters.js                  # MODIFY: HP bump for the 6 regular-tier monsters only
css/
  styles.css                     # MODIFY: new battle layout, hit-flash/shake/floating-number animations
tests/
  combat.test.js                 # MODIFY: add tests for rollCrit/applyCritMultiplier
scripts/
  simulate-balance.js             # unchanged, reused to verify the HP bump doesn't shift win rates
```

---

### Task 1: Critical Hit System

**Files:**
- Modify: `js/systems/combat.js`
- Modify: `tests/combat.test.js`

**Interfaces:**
- Produces: `CRIT_CHANCE: number` (0.1), `CRIT_MULTIPLIER: number` (1.5), `rollCrit(rng?: () => number): boolean`, `applyCritMultiplier(damage: number, isCrit: boolean): number`
- Consumes: nothing new

- [ ] **Step 1: Write the failing tests**

Append to `tests/combat.test.js`:

```js
test('rollCrit returns true below the crit chance threshold, false above it', () => {
  assert.equal(rollCrit(() => 0.05), true);
  assert.equal(rollCrit(() => 0.5), false);
});

test('applyCritMultiplier scales damage on a crit and leaves it unchanged otherwise', () => {
  assert.equal(applyCritMultiplier(10, false), 10);
  assert.equal(applyCritMultiplier(10, true), 15);
});
```

Update the file's import line to include the two new names:

```js
import { calculateDamage, tickGauge, isReady, ATB_MAX, rollCrit, applyCritMultiplier } from '../js/systems/combat.js';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `rollCrit`/`applyCritMultiplier` are not exported yet.

- [ ] **Step 3: Add the crit functions to `js/systems/combat.js`**

Append to `js/systems/combat.js` (after the existing `isReady` function):

```js
export const CRIT_CHANCE = 0.1;
export const CRIT_MULTIPLIER = 1.5;

export function rollCrit(rng = Math.random) {
  return rng() < CRIT_CHANCE;
}

export function applyCritMultiplier(damage, isCrit) {
  return isCrit ? Math.round(damage * CRIT_MULTIPLIER) : damage;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all previous tests + 2 new tests)

- [ ] **Step 5: Commit**

```bash
git add js/systems/combat.js tests/combat.test.js
git commit -m "feat: add critical hit chance and damage multiplier"
```

---

### Task 2: Monster HP Bump (Regular Tier Only)

**Files:**
- Modify: `js/data/monsters.js`

**Interfaces:** no interface change — only `hp` values change on 6 existing entries.

- [ ] **Step 1: Apply the HP increase**

In `js/data/monsters.js`, change only the `hp` field on these 6 entries (leave every other field — `attack`, `defense`, `speed`, `xp`, `goldRange`, `dropTable` — untouched, and do not touch `orc`, `wraith`, or `dragon` at all):

| Monster | Old HP | New HP |
|---|---|---|
| `boar` | 12 | 17 |
| `bat` | 8 | 11 |
| `snake` | 10 | 14 |
| `goblin` | 15 | 21 |
| `direWolf` | 22 | 30 |
| `spider` | 18 | 25 |

- [ ] **Step 2: Verify the bump doesn't shift the already-tuned matchups**

Run `node scripts/simulate-balance.js` (the committed simulation tool from the previous balance pass) and confirm the builds it already covers for `orc`/`wraith`/`dragon` are unaffected (they should be, since those monsters' stats didn't change) and that fights against the 6 bumped monsters now take visibly more exchanges without flipping any previously-comfortable win into a loss (a fight that was a clean win at ~100% HP remaining should still be a clean win, just take a couple more hits to land). If the script doesn't already cover the regular-tier monsters in detail, a quick manual read of its output/methodology is enough here — this is a sanity check on a small, low-risk numeric change, not a full re-tuning exercise.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — no test asserts specific monster HP values.

- [ ] **Step 4: Commit**

```bash
git add js/data/monsters.js
git commit -m "feat: bump regular-tier monster HP for slightly longer fights"
```

---

### Task 3: Battle Screen Layout Restructure

**Files:**
- Modify: `js/screens/battleScreen.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: `ATB_MAX` (newly imported from `js/systems/combat.js`, already exported)
- Produces: `mount(root, props)` / `unmount()` — same signatures as before. Internal structure changes: the module now builds its DOM once per battle and updates specific elements afterward, instead of replacing `innerHTML` on every tick.

This task is a faithful behavioral port of the existing battle screen (same Attack/Item/Flee logic, same win/loss/flee handling) onto the new layout and update model — no hit-feedback animations, pacing, or keyboard shortcuts yet (Tasks 4-6 add those on top of this foundation). This is DOM-only code with no unit tests — verify via a module-load smoke check and the manual playtest in Task 7.

- [ ] **Step 1: Replace the contents of `js/screens/battleScreen.js`**

```js
import { MONSTERS } from '../data/monsters.js';
import { ITEMS } from '../data/items.js';
import { calculateDamage, tickGauge, isReady, ATB_MAX } from '../systems/combat.js';
import { getEquipmentBonuses, removeItem } from '../systems/inventory.js';

let rootEl = null;
let state = null;
let monsterId = null;
let callbacks = null;
let intervalId = null;
let playerCombatant = null;
let monsterCombatant = null;
let battleOver = false;
let log = [];
let elements = {};

function buildPlayerCombatant() {
  const bonuses = getEquipmentBonuses(state);
  return {
    emoji: '🧑',
    hp: state.player.hp,
    maxHp: state.player.maxHp + bonuses.maxHp,
    attack: state.player.attack + bonuses.attack,
    defense: state.player.defense + bonuses.defense,
    speed: state.player.speed + bonuses.speed,
    atb: 0,
  };
}

function buildMonsterCombatant() {
  const monster = MONSTERS[monsterId];
  return {
    name: monster.name, emoji: monster.emoji,
    hp: monster.hp, maxHp: monster.hp,
    attack: monster.attack, defense: monster.defense, speed: monster.speed,
    atb: 0,
  };
}

function percent(value, max) {
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function buildDom() {
  rootEl.innerHTML = `
    <div class="overlay-panel battle-screen">
      <div class="battle-main">
        <div class="battle-combatant" id="battle-monster-zone">
          <div class="battle-emoji battle-monster-emoji" id="battle-monster-emoji">${monsterCombatant.emoji}</div>
          <div class="battle-name">${monsterCombatant.name}</div>
          <div class="battle-hp-bar"><div class="battle-hp-fill" id="battle-monster-hp-fill"></div></div>
          <div class="battle-hp-text" id="battle-monster-hp-text"></div>
          <div class="battle-atb-bar"><div class="battle-atb-fill" id="battle-monster-atb-fill"></div></div>
        </div>
        <div class="battle-divider">⚔️</div>
        <div class="battle-combatant" id="battle-hero-zone">
          <div class="battle-emoji" id="battle-hero-emoji">${playerCombatant.emoji}</div>
          <div class="battle-name">You</div>
          <div class="battle-hp-bar"><div class="battle-hp-fill battle-hp-fill-hero" id="battle-hero-hp-fill"></div></div>
          <div class="battle-hp-text" id="battle-hero-hp-text"></div>
          <div class="battle-atb-bar"><div class="battle-atb-fill" id="battle-hero-atb-fill"></div></div>
        </div>
        <div class="battle-menu" id="battle-menu"></div>
      </div>
      <div class="battle-sidebar">
        <div class="battle-log-label">Battle Log</div>
        <div class="battle-log" id="battle-log"></div>
      </div>
    </div>
  `;

  elements = {
    monsterZone: document.getElementById('battle-monster-zone'),
    monsterEmoji: document.getElementById('battle-monster-emoji'),
    monsterHpFill: document.getElementById('battle-monster-hp-fill'),
    monsterHpText: document.getElementById('battle-monster-hp-text'),
    monsterAtbFill: document.getElementById('battle-monster-atb-fill'),
    heroZone: document.getElementById('battle-hero-zone'),
    heroEmoji: document.getElementById('battle-hero-emoji'),
    heroHpFill: document.getElementById('battle-hero-hp-fill'),
    heroHpText: document.getElementById('battle-hero-hp-text'),
    heroAtbFill: document.getElementById('battle-hero-atb-fill'),
    menu: document.getElementById('battle-menu'),
    log: document.getElementById('battle-log'),
  };
}

function updateHpBars() {
  elements.monsterHpFill.style.width = `${percent(monsterCombatant.hp, monsterCombatant.maxHp)}%`;
  elements.monsterHpText.textContent = `HP ${monsterCombatant.hp}/${monsterCombatant.maxHp}`;
  elements.heroHpFill.style.width = `${percent(playerCombatant.hp, playerCombatant.maxHp)}%`;
  elements.heroHpText.textContent = `HP ${playerCombatant.hp}/${playerCombatant.maxHp}`;
}

function updateAtbBars() {
  elements.monsterAtbFill.style.width = `${percent(monsterCombatant.atb, ATB_MAX)}%`;
  elements.heroAtbFill.style.width = `${percent(playerCombatant.atb, ATB_MAX)}%`;
}

function updateLog() {
  elements.log.innerHTML = log.map((line) => `<div>${line}</div>`).join('');
  elements.log.scrollTop = elements.log.scrollHeight;
}

function updateMenu() {
  if (battleOver || !isReady(playerCombatant.atb)) {
    elements.menu.innerHTML = '';
    return;
  }
  elements.menu.innerHTML = `
    <button id="btn-attack">Attack</button>
    <button id="btn-item">Item</button>
    <button id="btn-flee">Flee</button>
  `;
  document.getElementById('btn-attack').onclick = playerAttack;
  document.getElementById('btn-item').onclick = playerUseItem;
  document.getElementById('btn-flee').onclick = playerFlee;
}

function playerAttack() {
  const damage = calculateDamage(playerCombatant, monsterCombatant);
  monsterCombatant.hp = Math.max(0, monsterCombatant.hp - damage);
  log.push(`You hit ${monsterCombatant.name} for ${damage}.`);
  playerCombatant.atb = 0;
  updateHpBars();
  updateAtbBars();
  updateLog();
  checkOutcome();
  updateMenu();
}

function playerUseItem() {
  const potionEntry = state.inventory.find((entry) => entry.itemId === 'potion' && entry.quantity > 0);
  if (!potionEntry) {
    log.push('No potions left.');
    updateLog();
    return;
  }
  Object.assign(state, removeItem(state, 'potion', 1));
  const heal = ITEMS.potion.heal;
  playerCombatant.hp = Math.min(playerCombatant.maxHp, playerCombatant.hp + heal);
  log.push(`You drink a potion and heal ${heal}.`);
  playerCombatant.atb = 0;
  updateHpBars();
  updateAtbBars();
  updateLog();
  updateMenu();
}

function playerFlee() {
  if (MONSTERS[monsterId].isBoss) {
    log.push('You cannot flee from this battle!');
    playerCombatant.atb = 0;
    updateAtbBars();
    updateLog();
    updateMenu();
    return;
  }
  endBattle('fled');
}

function monsterAttack() {
  const damage = calculateDamage(monsterCombatant, playerCombatant);
  playerCombatant.hp = Math.max(0, playerCombatant.hp - damage);
  log.push(`${monsterCombatant.name} hits you for ${damage}.`);
  monsterCombatant.atb = 0;
  updateHpBars();
  updateLog();
  checkOutcome();
}

function checkOutcome() {
  if (monsterCombatant.hp <= 0) {
    endBattle('won');
  } else if (playerCombatant.hp <= 0) {
    endBattle('lost');
  }
}

function tick() {
  if (battleOver) return;
  playerCombatant.atb = tickGauge(playerCombatant.atb, playerCombatant.speed, 1);
  monsterCombatant.atb = tickGauge(monsterCombatant.atb, monsterCombatant.speed, 1);

  if (isReady(monsterCombatant.atb) && !isReady(playerCombatant.atb)) {
    monsterAttack();
  }

  updateAtbBars();
  updateMenu();
}

function endBattle(outcome) {
  battleOver = true;
  clearInterval(intervalId);
  state.player.hp = playerCombatant.hp;
  updateMenu();
  callbacks.onBattleEnd(outcome, monsterId);
}

export function mount(root, props) {
  rootEl = root;
  state = props.state;
  monsterId = props.monsterId;
  callbacks = props.callbacks;
  battleOver = false;
  log = [`A wild ${MONSTERS[monsterId].name} appears!`];
  playerCombatant = buildPlayerCombatant();
  monsterCombatant = buildMonsterCombatant();
  buildDom();
  updateHpBars();
  updateAtbBars();
  updateLog();
  updateMenu();
  intervalId = setInterval(tick, 300);
}

export function unmount() {
  clearInterval(intervalId);
}
```

- [ ] **Step 2: Replace the battle-related CSS in `css/styles.css`**

Replace:
```css
.battle-screen, .shop-screen, .smith-screen {
  max-width: 480px;
  margin: 0 auto;
}
.combatant { margin-bottom: 8px; font-size: 1.3rem; }
.battle-log { min-height: 80px; background: #111; padding: 8px; margin: 8px 0; font-size: 0.9rem; }
```
with (note the `.overlay-panel.battle-screen` compound selector on the new width rule — the battle panel also carries the generic `.overlay-panel` class, which separately sets `max-width: 480px`; a single-class `.battle-screen` selector would have equal specificity and lose to `.overlay-panel` since that rule appears later in the file, so the compound selector is required to actually win):
```css
.shop-screen, .smith-screen {
  max-width: 480px;
  margin: 0 auto;
}

.overlay-panel.battle-screen {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  gap: 16px;
}
.battle-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.battle-combatant {
  text-align: center;
  position: relative;
}
.battle-emoji {
  font-size: 3rem;
  line-height: 1;
}
.battle-name {
  font-weight: 600;
  margin-top: 4px;
}
.battle-divider {
  font-size: 1.4rem;
  color: #555;
}
.battle-hp-bar {
  width: 200px;
  background: #333;
  border-radius: 4px;
  height: 10px;
  margin: 4px auto 0;
  overflow: hidden;
}
.battle-hp-fill {
  height: 100%;
  background: #c0392b;
  transition: width 0.2s;
}
.battle-hp-fill-hero {
  background: #27ae60;
}
.battle-hp-text {
  font-size: 0.75rem;
  color: #aaa;
  margin-top: 2px;
}
.battle-atb-bar {
  width: 200px;
  background: #222;
  border-radius: 4px;
  height: 6px;
  margin: 4px auto 0;
  overflow: hidden;
}
.battle-atb-fill {
  height: 100%;
  background: #f1c40f;
  transition: width 0.3s linear;
}
.battle-sidebar {
  width: 180px;
  background: #161616;
  border-radius: 6px;
  padding: 10px;
  display: flex;
  flex-direction: column;
}
.battle-log-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: #888;
  margin-bottom: 6px;
  letter-spacing: 0.05em;
}
.battle-log {
  flex: 1;
  overflow-y: auto;
  font-size: 0.78rem;
  line-height: 1.5;
  color: #ccc;
  max-height: 320px;
}
```

Also update the existing `.battle-monster-emoji` rule (currently `font-size: 2rem;`) to make the monster bigger than the hero's 3rem base, matching the mockup:
```css
.battle-monster-emoji {
  font-size: 4rem;
}
```

- [ ] **Step 3: Verify it loads without errors**

Run: `node --input-type=module -e "import('./js/screens/battleScreen.js').then(() => console.log('module loads OK'))"`
Expected: prints `module loads OK`

- [ ] **Step 4: Run the full test suite to confirm no regression**

Run: `npm test`
Expected: PASS (unchanged count — battle screen has no direct unit tests)

- [ ] **Step 5: Commit**

```bash
git add js/screens/battleScreen.js css/styles.css
git commit -m "feat: restructure battle screen to a monster-above/hero-below layout with HP/ATB bars and a sidebar log"
```

---

### Task 4: Hit Feedback (Flash, Shake, Floating Damage Numbers, Crits)

**Files:**
- Modify: `js/screens/battleScreen.js`
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: `rollCrit`, `applyCritMultiplier` (Task 1, `js/systems/combat.js`)
- Produces: no new exports — internal behavior only

- [ ] **Step 1: Update the import line and add hit-effect functions in `js/screens/battleScreen.js`**

Change the combat import to:
```js
import { calculateDamage, tickGauge, isReady, ATB_MAX, rollCrit, applyCritMultiplier } from '../systems/combat.js';
```

Add these two functions (anywhere above `playerAttack`, e.g. right after `updateMenu`):
```js
function showDamageNumber(zoneEl, amount, isCrit) {
  const numberEl = document.createElement('div');
  numberEl.textContent = `-${amount}`;
  numberEl.className = 'battle-damage-number' + (isCrit ? ' battle-damage-number-crit' : '');
  zoneEl.appendChild(numberEl);
  setTimeout(() => numberEl.remove(), 900);
}

function playHitEffect(zoneEl, emojiEl, amount, isCrit) {
  emojiEl.classList.add('battle-hit-flash');
  zoneEl.classList.add('battle-hit-shake');
  showDamageNumber(zoneEl, amount, isCrit);
  setTimeout(() => {
    emojiEl.classList.remove('battle-hit-flash');
    zoneEl.classList.remove('battle-hit-shake');
  }, 220);
}
```

- [ ] **Step 2: Wire crits and hit effects into `playerAttack`**

Replace `playerAttack`'s body:
```js
function playerAttack() {
  const isCrit = rollCrit();
  let damage = calculateDamage(playerCombatant, monsterCombatant);
  damage = applyCritMultiplier(damage, isCrit);
  monsterCombatant.hp = Math.max(0, monsterCombatant.hp - damage);
  log.push(isCrit ? `Critical! You hit ${monsterCombatant.name} for ${damage}!` : `You hit ${monsterCombatant.name} for ${damage}.`);
  playerCombatant.atb = 0;
  updateHpBars();
  updateAtbBars();
  updateLog();
  playHitEffect(elements.monsterZone, elements.monsterEmoji, damage, isCrit);
  checkOutcome();
  updateMenu();
}
```

- [ ] **Step 3: Wire crits and hit effects into `monsterAttack`**

Replace `monsterAttack`'s body:
```js
function monsterAttack() {
  const isCrit = rollCrit();
  let damage = calculateDamage(monsterCombatant, playerCombatant);
  damage = applyCritMultiplier(damage, isCrit);
  playerCombatant.hp = Math.max(0, playerCombatant.hp - damage);
  log.push(isCrit ? `Critical! ${monsterCombatant.name} hits you for ${damage}!` : `${monsterCombatant.name} hits you for ${damage}.`);
  monsterCombatant.atb = 0;
  updateHpBars();
  updateLog();
  playHitEffect(elements.heroZone, elements.heroEmoji, damage, isCrit);
  checkOutcome();
}
```

- [ ] **Step 4: Add the animation CSS**

Append to `css/styles.css`:
```css
.battle-hit-flash {
  filter: brightness(1.4) sepia(1) saturate(6) hue-rotate(-40deg);
}
@keyframes battle-shake {
  0% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  50% { transform: translateX(6px); }
  75% { transform: translateX(-3px); }
  100% { transform: translateX(0); }
}
.battle-hit-shake {
  animation: battle-shake 0.2s ease-in-out;
}
.battle-damage-number {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 1.3rem;
  font-weight: 700;
  color: #ff5555;
  pointer-events: none;
  animation: battle-float-up 0.9s ease-out forwards;
}
.battle-damage-number-crit {
  font-size: 1.8rem;
  color: #e67e22;
}
@keyframes battle-float-up {
  0% { transform: translate(-50%, 0); opacity: 1; }
  100% { transform: translate(-50%, -40px); opacity: 0; }
}
```

- [ ] **Step 5: Verify it loads without errors**

Run: `node --input-type=module -e "import('./js/screens/battleScreen.js').then(() => console.log('module loads OK'))"`
Expected: prints `module loads OK`

- [ ] **Step 6: Run the full test suite to confirm no regression**

Run: `npm test`
Expected: PASS (unchanged count)

- [ ] **Step 7: Commit**

```bash
git add js/screens/battleScreen.js css/styles.css
git commit -m "feat: add hit flash/shake, floating damage numbers, and critical hits"
```

---

### Task 5: Victory/Defeat Pacing

**Files:**
- Modify: `js/screens/battleScreen.js`

**Interfaces:** no signature change — `endBattle` still eventually calls `callbacks.onBattleEnd(outcome, monsterId)`, just after a short delay instead of immediately.

- [ ] **Step 1: Add a pause before the outcome callback fires**

Add a module-level timeout tracker near the other `let` declarations at the top of the file:
```js
let endBattleTimeoutId = null;
```

Add a constant near the top of the file (after the imports):
```js
const VICTORY_PAUSE_MS = 1200;
```

Replace `endBattle`:
```js
function endBattle(outcome) {
  battleOver = true;
  clearInterval(intervalId);
  state.player.hp = playerCombatant.hp;
  updateMenu();
  endBattleTimeoutId = setTimeout(() => {
    callbacks.onBattleEnd(outcome, monsterId);
  }, VICTORY_PAUSE_MS);
}
```

Replace `unmount` to also clear the pending timeout (so a battle can't fire its outcome callback after being torn down some other way):
```js
export function unmount() {
  clearInterval(intervalId);
  clearTimeout(endBattleTimeoutId);
}
```

- [ ] **Step 2: Verify it loads without errors**

Run: `node --input-type=module -e "import('./js/screens/battleScreen.js').then(() => console.log('module loads OK'))"`
Expected: prints `module loads OK`

- [ ] **Step 3: Run the full test suite to confirm no regression**

Run: `npm test`
Expected: PASS (unchanged count)

- [ ] **Step 4: Commit**

```bash
git add js/screens/battleScreen.js
git commit -m "feat: pause briefly on the final battle state before closing"
```

---

### Task 6: Keyboard Shortcuts (A / I / Esc)

**Files:**
- Modify: `js/screens/battleScreen.js`

**Interfaces:** no exported signature change — `mount`/`unmount` now also attach/detach a `keydown` listener, matching the pattern already used in `js/screens/mapScreen.js`.

- [ ] **Step 1: Add the keydown handler**

Add this function (e.g. right after `playHitEffect`):
```js
function handleKeydown(event) {
  if (battleOver || !isReady(playerCombatant.atb)) return;
  const key = event.key;
  if (key === 'a' || key === 'A') {
    playerAttack();
  } else if (key === 'i' || key === 'I') {
    playerUseItem();
  } else if (key === 'Escape') {
    playerFlee();
  }
}
```

- [ ] **Step 2: Attach/detach the listener in `mount`/`unmount`**

In `mount`, after `intervalId = setInterval(tick, 300);`, add:
```js
  window.addEventListener('keydown', handleKeydown);
```

Replace `unmount`:
```js
export function unmount() {
  clearInterval(intervalId);
  clearTimeout(endBattleTimeoutId);
  window.removeEventListener('keydown', handleKeydown);
}
```

- [ ] **Step 3: Verify it loads without errors**

Run: `node --input-type=module -e "import('./js/screens/battleScreen.js').then(() => console.log('module loads OK'))"`
Expected: prints `module loads OK`

- [ ] **Step 4: Run the full test suite to confirm no regression**

Run: `npm test`
Expected: PASS (unchanged count)

- [ ] **Step 5: Commit**

```bash
git add js/screens/battleScreen.js
git commit -m "feat: add A/I/Esc keyboard shortcuts for battle actions"
```

---

### Task 7: Manual Playtest & Polish

**Files:** none expected — this task verifies Tasks 1-6 together and fixes anything the playtest turns up in the files already touched by this plan.

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`
Expected: PASS (all tests from Task 1, unchanged count otherwise)

- [ ] **Step 2: Manual playtest**

Run `python3 -m http.server` (or reuse an already-running instance) and play through several battles, checking:

- Layout matches the validated mockup: monster centered above with name/HP bar/ATB bar, divider, hero below in the same arrangement, action menu, sidebar log to the side
- ATB gauges visibly fill for both sides in real time; the action menu appears exactly when your gauge is full, disappears the instant you act
- Landing a hit (either side) flashes/shakes the target and shows a floating damage number that rises and fades
- Occasionally a critical hit lands — bigger/different-colored number, distinct log line, same flash/shake
- The combat log keeps the entire fight's history and auto-scrolls as it grows — confirm by fighting long enough to fill more than the visible area
- Winning, losing, and fleeing all still work correctly (rewards/respawn/etc. unchanged from before this plan); on win/loss the panel visibly lingers on the final state for about a second before closing, not instantly and not with a noticeable stall
- Keyboard shortcuts: once the menu is showing, pressing A attacks, I uses an item (and correctly no-ops with a log message when you have none), Esc flees (and correctly refuses with a log message against the boss); shortcuts do nothing while the gauge is still filling
- Fights against the 6 bumped regular-tier monsters (Boar/Bat/Snake/Goblin/Dire Wolf/Spider) take a bit longer than before; fights against Orc/Wraith/Dragon feel unchanged from the last playtest
- No input feels delayed or blocked by an animation — clicking/pressing a shortcut always registers immediately

- [ ] **Step 3: Fix anything the playtest surfaces**

If the playtest finds a real bug in the files this plan touches (`js/screens/battleScreen.js`, `css/styles.css`, `js/data/monsters.js`, `js/systems/combat.js`), fix it directly and re-verify. If it's a duplicate/variant of a previously-known, already-deferred issue unrelated to this plan's scope, note it instead of expanding scope here.

- [ ] **Step 4: Commit** (only if Step 3 made a change)

```bash
git add -A
git commit -m "fix: address battle screen v2 playtest findings"
```

If no changes were needed, skip the commit and say so.
