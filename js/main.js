import { createNewGame, loadState, saveState } from './state.js';
import { mountScreen } from './screens/screenManager.js';
import * as mapScreen from './screens/mapScreen.js';
import * as battleScreen from './screens/battleScreen.js';
import * as shopScreen from './screens/shopScreen.js';
import * as smithScreen from './screens/smithScreen.js';
import { overworldMap } from './maps/overworldMap.js';
import { townMap } from './maps/townMap.js';
import { dungeonMap } from './maps/dungeonMap.js';
import { MONSTERS } from './data/monsters.js';
import { applyXp } from './systems/leveling.js';
import { rollDrop } from './systems/loot.js';
import { addGold, addItem } from './systems/inventory.js';

const MAPS = { overworld: overworldMap, town: townMap, dungeon: dungeonMap };

const state = loadState() || createNewGame();
if (!state.position) {
  state.position = { ...MAPS[state.map].startPosition };
}

function renderHud() {
  const hud = document.getElementById('hud');
  hud.textContent = `Lv.${state.player.level} HP:${state.player.hp}/${state.player.maxHp} Gold:${state.player.gold}`;
}

function goToMap(mapId) {
  state.map = mapId;
  renderHud();
  mountScreen(mapScreen, {
    state,
    mapConfig: MAPS[mapId],
    callbacks: {
      onMove: () => saveState(state),
      onAction: handleTileAction,
      onEncounter: handleEncounter,
    },
  });
}

function handleTileAction(action) {
  if (action === 'enterTown') return enterMap('town');
  if (action === 'enterDungeon') return enterMap('dungeon');
  if (action === 'exitMap') return enterMap('overworld');
  if (action === 'enterShop') return goToShop();
  if (action === 'enterSmith') return goToSmith();
  if (action === 'bossBattle') return handleEncounter(dungeonMap.bossMonsterId);
}

function enterMap(mapId) {
  state.position = { ...MAPS[mapId].startPosition };
  goToMap(mapId);
}

function goToShop() {
  mountScreen(shopScreen, {
    state,
    callbacks: {
      onPurchase: () => { saveState(state); renderHud(); },
      onLeave: () => goToMap('town'),
    },
  });
}

function goToSmith() {
  mountScreen(smithScreen, {
    state,
    callbacks: {
      onUpgrade: () => { saveState(state); renderHud(); },
      onLeave: () => goToMap('town'),
    },
  });
}

function handleEncounter(monsterId) {
  mountScreen(battleScreen, {
    state,
    monsterId,
    callbacks: { onBattleEnd: handleBattleEnd },
  });
}

function handleBattleEnd(outcome, monsterId) {
  if (outcome === 'won') {
    const monster = MONSTERS[monsterId];
    const { player } = applyXp(state.player, monster.xp);
    state.player = player;

    const drop = rollDrop(monster);
    Object.assign(state, addGold(state, drop.gold));
    if (drop.item) {
      Object.assign(state, addItem(state, drop.item, 1));
    }
    if (monster.isBoss) {
      state.flags.dungeonBossDefeated = true;
    }

    saveState(state);
    renderHud();
    goToMap(state.map);
  } else if (outcome === 'lost') {
    state.player.hp = state.player.maxHp;
    state.map = 'town';
    state.position = { ...townMap.startPosition };
    saveState(state);
    renderHud();
    goToMap('town');
  } else if (outcome === 'fled') {
    saveState(state);
    renderHud();
    goToMap(state.map);
  }
}

renderHud();
goToMap(state.map);
