import { MONSTERS } from '../data/monsters.js';
import { ITEMS } from '../data/items.js';
import { calculateDamage, tickGauge, isReady } from '../systems/combat.js';
import { getEquipmentBonuses } from '../systems/inventory.js';

let rootEl = null;
let state = null;
let monsterId = null;
let callbacks = null;
let intervalId = null;
let playerCombatant = null;
let monsterCombatant = null;
let battleOver = false;
let log = [];

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

function render() {
  rootEl.innerHTML = `
    <div class="battle-screen">
      <div class="combatant">${monsterCombatant.emoji} ${monsterCombatant.name} — HP ${monsterCombatant.hp}/${monsterCombatant.maxHp}</div>
      <div class="combatant">${playerCombatant.emoji} You — HP ${playerCombatant.hp}/${playerCombatant.maxHp}</div>
      <div class="battle-log">${log.slice(-4).join('<br>')}</div>
      <div class="battle-menu" id="battle-menu"></div>
    </div>
  `;

  if (isReady(playerCombatant.atb) && !battleOver) {
    renderMenu();
  }
}

function renderMenu() {
  const menu = document.getElementById('battle-menu');
  if (!menu) return;
  menu.innerHTML = `
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
  checkOutcome();
  render();
}

function playerUseItem() {
  const potionEntry = state.inventory.find((entry) => entry.itemId === 'potion' && entry.quantity > 0);
  if (!potionEntry) {
    log.push('No potions left.');
    render();
    return;
  }
  potionEntry.quantity -= 1;
  state.inventory = state.inventory.filter((entry) => entry.quantity > 0);
  const heal = ITEMS.potion.heal;
  playerCombatant.hp = Math.min(playerCombatant.maxHp, playerCombatant.hp + heal);
  log.push(`You drink a potion and heal ${heal}.`);
  playerCombatant.atb = 0;
  render();
}

function playerFlee() {
  if (MONSTERS[monsterId].isBoss) {
    log.push('You cannot flee from this battle!');
    playerCombatant.atb = 0;
    render();
    return;
  }
  endBattle('fled');
}

function monsterAttack() {
  const damage = calculateDamage(monsterCombatant, playerCombatant);
  playerCombatant.hp = Math.max(0, playerCombatant.hp - damage);
  log.push(`${monsterCombatant.name} hits you for ${damage}.`);
  monsterCombatant.atb = 0;
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

  render();
}

function endBattle(outcome) {
  battleOver = true;
  clearInterval(intervalId);
  state.player.hp = playerCombatant.hp;
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
  render();
  intervalId = setInterval(tick, 300);
}

export function unmount() {
  clearInterval(intervalId);
}
