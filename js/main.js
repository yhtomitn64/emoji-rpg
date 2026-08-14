import { createNewGame, loadState, saveState } from './state.js';
import { mountScreen, mountOverlay, unmountOverlay } from './screens/screenManager.js';
import * as mapScreen from './screens/mapScreen.js';
import * as battleScreen from './screens/battleScreen.js';
import * as shopScreen from './screens/shopScreen.js';
import * as smithScreen from './screens/smithScreen.js';
import * as statsPanel from './screens/statsPanel.js';
import { townMap } from './maps/townMap.js';
import { dungeonMap } from './maps/dungeonMap.js';
import { centerMap } from './maps/wilderness/center.js';
import { northMap } from './maps/wilderness/north.js';
import { southMap } from './maps/wilderness/south.js';
import { eastMap } from './maps/wilderness/east.js';
import { westMap } from './maps/wilderness/west.js';
import { northeastMap } from './maps/wilderness/northeast.js';
import { northwestMap } from './maps/wilderness/northwest.js';
import { southeastMap } from './maps/wilderness/southeast.js';
import { southwestMap } from './maps/wilderness/southwest.js';
import { miniDungeonVariantA } from './maps/miniDungeons/variantA.js';
import { miniDungeonVariantB } from './maps/miniDungeons/variantB.js';
import { miniDungeonVariantC } from './maps/miniDungeons/variantC.js';
import { MONSTERS } from './data/monsters.js';
import { ITEMS } from './data/items.js';
import { FLAVOR_TEXT } from './data/flavorText.js';
import { showFlavorBanner } from './screens/flavorBanner.js';
import { applyXp } from './systems/leveling.js';
import { rollDrop } from './systems/loot.js';
import { addGold, addItem, equipItem, getEquipmentBonuses } from './systems/inventory.js';
import { computeEdgeLandingPosition, isWalkableAt } from './systems/world.js';
import { getMiniDungeonEntrance, isTreasureTaken, markTreasureTaken, rollMiniDungeonTreasure } from './systems/miniDungeons.js';

const MAPS = {
  town: townMap,
  dungeon: dungeonMap,
  center: centerMap,
  north: northMap,
  south: southMap,
  east: eastMap,
  west: westMap,
  northeast: northeastMap,
  northwest: northwestMap,
  southeast: southeastMap,
  southwest: southwestMap,
  miniDungeonA: miniDungeonVariantA,
  miniDungeonB: miniDungeonVariantB,
  miniDungeonC: miniDungeonVariantC,
};

const state = loadState() || createNewGame();
if (state.map === 'overworld') {
  state.map = 'center';
  state.position = null;
}
if (!state.position) {
  state.position = { ...MAPS[state.map].startPosition };
}
if (!isWalkableAt(MAPS[state.map], state.position.x, state.position.y)) {
  state.position = { ...MAPS[state.map].startPosition };
}
if (!state.visited) {
  state.visited = {};
}
if (!state.seenScreens) {
  state.seenScreens = {};
}
if (!state.caches) {
  state.caches = {};
}
if (!state.miniDungeons) {
  state.miniDungeons = {};
}
if (!state.activeMiniDungeon) {
  state.activeMiniDungeon = null;
}

// True while a battle overlay is mounted. The Stats button sits behind the
// full-viewport #overlay, so it is pointer-blocked but still keyboard-reachable;
// opening stats mid-battle would tear down the live battle overlay.
let battleActive = false;

function setStatsButtonEnabled(enabled) {
  const statsButton = document.getElementById('btn-open-stats');
  if (statsButton) {
    statsButton.disabled = !enabled;
  }
}

function renderHud() {
  const bonuses = getEquipmentBonuses(state);
  const hud = document.getElementById('hud');
  hud.innerHTML = '';

  const label = document.createElement('span');
  label.textContent = `Lv.${state.player.level} HP:${state.player.hp}/${state.player.maxHp + bonuses.maxHp} Gold:${state.player.gold}`;

  const statsButton = document.createElement('button');
  statsButton.id = 'btn-open-stats';
  statsButton.textContent = '📊 Stats';
  statsButton.disabled = battleActive;
  statsButton.onclick = openStats;

  hud.appendChild(label);
  hud.appendChild(statsButton);
}

function openStats() {
  if (battleActive) return;
  mountOverlay(statsPanel, {
    state,
    callbacks: { onClose: () => unmountOverlay() },
  });
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
      onEdgeTransition: handleEdgeTransition,
      onFirstVisit: handleFirstVisit,
      onCacheFound: handleCacheFound,
      onEnterMiniDungeon: handleEnterMiniDungeon,
    },
  });
}

function handleTileAction(action) {
  if (action === 'enterTown') return enterMap('town');
  if (action === 'enterDungeon') return enterMap('dungeon');
  if (action === 'exitMap') {
    if (state.map === 'town') return enterMap('center');
    if (state.map === 'dungeon') return enterMap('southeast');
    return;
  }
  if (action === 'enterShop') return goToShop();
  if (action === 'enterSmith') return goToSmith();
  if (action === 'bossBattle') {
    handleEncounter(dungeonMap.bossMonsterId);
    return;
  }
  if (action === 'exitMiniDungeon') return handleExitMiniDungeon();
  if (action === 'collectTreasure') return handleTreasureFound();
}

function enterMap(mapId) {
  state.position = { ...MAPS[mapId].startPosition };
  state.map = mapId;
  saveState(state);
  goToMap(mapId);
}

function handleEdgeTransition(neighborId, direction, currentPosition) {
  const neighborMap = MAPS[neighborId];
  state.position = computeEdgeLandingPosition(direction, currentPosition, neighborMap);
  state.map = neighborId;
  saveState(state);
  goToMap(neighborId);
}

function handleFirstVisit(screenId) {
  const text = FLAVOR_TEXT[screenId];
  if (text) {
    showFlavorBanner(text);
  }
  saveState(state);
}

function handleCacheFound(loot) {
  Object.assign(state, addGold(state, loot.gold));
  let message = `You found a stash: ${loot.gold} gold`;
  if (loot.item) {
    Object.assign(state, addItem(state, loot.item, 1));
    message += `, 1 ${ITEMS[loot.item].name}`;
  }
  message += '!';
  showFlavorBanner(message);
  saveState(state);
  renderHud();
}

function handleEnterMiniDungeon(screenId, x, y) {
  const entrance = getMiniDungeonEntrance(state.miniDungeons, screenId, x, y);
  state.activeMiniDungeon = { screenId, x, y };
  state.position = { ...MAPS[entrance.variantId].startPosition };
  state.map = entrance.variantId;
  saveState(state);
  goToMap(entrance.variantId);
}

function handleExitMiniDungeon() {
  if (!state.activeMiniDungeon) {
    return enterMap('center');
  }
  const { screenId, x, y } = state.activeMiniDungeon;
  state.position = { x, y };
  state.map = screenId;
  state.activeMiniDungeon = null;
  saveState(state);
  goToMap(screenId);
}

function handleTreasureFound() {
  if (!state.activeMiniDungeon) return;
  const { screenId, x, y } = state.activeMiniDungeon;
  if (isTreasureTaken(state.miniDungeons, screenId, x, y)) return;
  Object.assign(state, { miniDungeons: markTreasureTaken(state.miniDungeons, screenId, x, y) });
  const loot = rollMiniDungeonTreasure();
  Object.assign(state, addGold(state, loot.gold));
  Object.assign(state, addItem(state, loot.item, 1));
  const itemDef = ITEMS[loot.item];
  if (itemDef.slot && !state.equipment[itemDef.slot]) {
    Object.assign(state, equipItem(state, loot.item, itemDef.slot));
  }
  showFlavorBanner(`You found a treasure: ${loot.gold} gold and a ${itemDef.name}!`);
  saveState(state);
  renderHud();
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
  battleActive = true;
  setStatsButtonEnabled(false);
  mountOverlay(battleScreen, {
    state,
    monsterId,
    callbacks: { onBattleEnd: handleBattleEnd },
  });
}

function handleBattleEnd(outcome, monsterId) {
  unmountOverlay();
  battleActive = false;
  setStatsButtonEnabled(true);

  if (outcome === 'won') {
    const monster = MONSTERS[monsterId];
    const { player, leveledUp } = applyXp(state.player, monster.xp);
    state.player = player;
    if (leveledUp) {
      state.player.hp = state.player.maxHp + getEquipmentBonuses(state).maxHp;
    }

    const drop = rollDrop(monster);
    Object.assign(state, addGold(state, drop.gold));
    if (drop.item) {
      Object.assign(state, addItem(state, drop.item, 1));
      const droppedItemDef = ITEMS[drop.item];
      if (droppedItemDef.slot) {
        Object.assign(state, equipItem(state, drop.item, droppedItemDef.slot));
      }
    }
    if (monster.isBoss) {
      state.flags.dungeonBossDefeated = true;
    }

    saveState(state);
    renderHud();
  } else if (outcome === 'lost') {
    state.player.hp = state.player.maxHp + getEquipmentBonuses(state).maxHp;
    state.position = { ...townMap.startPosition };
    state.map = 'town';
    state.activeMiniDungeon = null;
    saveState(state);
    renderHud();
    goToMap('town');
  } else if (outcome === 'fled') {
    saveState(state);
    renderHud();
  }
}

renderHud();
goToMap(state.map);
