import { loadState, saveState } from './state.js';
import { mountScreen, mountOverlay, unmountOverlay } from './screens/screenManager.js';
import * as mapScreen from './screens/mapScreen.js';
import * as battleScreen from './screens/battleScreen.js';
import * as shopScreen from './screens/shopScreen.js';
import * as smithScreen from './screens/smithScreen.js';
import * as statsPanel from './screens/statsPanel.js';
import * as inventoryScreen from './screens/inventoryScreen.js';
import * as messageLogScreen from './screens/messageLogScreen.js';
import * as startScreen from './screens/startScreen.js';
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
import { applyXp, LATE_GAME_LEVEL_THRESHOLD, LEVEL_UP_PARTIAL_HEAL_FRACTION } from './systems/leveling.js';
import { rollDrop } from './systems/loot.js';
import { addGold, addItem, getEquipmentBonuses } from './systems/inventory.js';
import { computeEdgeLandingPosition, isValidSavedPosition } from './systems/world.js';
import { getMiniDungeonEntrance, isTreasureTaken, markTreasureTaken, rollMiniDungeonTreasure } from './systems/miniDungeons.js';
import { getBossTierStats, pickBossReturnFlavor, shouldPromptForRematch, resolveBattleXp, nextBossTierToAttempt, resolveBossTierAfterWin } from './systems/bossTiers.js';
import * as bossPromptScreen from './screens/bossPromptScreen.js';
import { listSlots, createSlot, deleteSlot, touchSlot, migrateLegacySave } from './systems/saveSlots.js';
import { canStartNgPlus, getNgPlusCombatOverrides, getNgPlusRewardMultiplier, scaleDropTable, resetWorldForNgPlus } from './systems/ngPlus.js';
import { incrementQuestProgress } from './systems/quests.js';
import { incrementLossStreak, potionsForStreak, getComebackMessage } from './systems/comeback.js';
import * as questBoardScreen from './screens/questBoardScreen.js';

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

let state = null;
let activeSlotId = null;

function startGame(loadedState, slotId) {
  state = loadedState;
  activeSlotId = slotId;
  if (state.map === 'overworld') {
    state.map = 'center';
    state.position = null;
  }
  if (!state.position) {
    state.position = { ...MAPS[state.map].startPosition };
  }
  if (!isValidSavedPosition(MAPS[state.map], state.position.x, state.position.y)) {
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
  if (!state.bossTier) {
    state.bossTier = 0;
  }
  if (!state.ngPlusCycle) {
    state.ngPlusCycle = 0;
  }
  if (!state.questProgress) {
    state.questProgress = {
      boar: 0, bat: 0, snake: 0, goblin: 0,
      direWolf: 0, spider: 0, orc: 0, wraith: 0,
    };
  }
  if (!state.gateRewards) {
    state.gateRewards = {};
  }
  if (!state.lossStreak) {
    state.lossStreak = 0;
  }
  renderHud();
  goToMap(state.map);
}

function mountStartScreen() {
  mountScreen(startScreen, {
    slots: listSlots(),
    callbacks: {
      onContinue: (slotId) => startGame(loadState(slotId), slotId),
      onNewGame: (name) => {
        const created = createSlot(name);
        startGame(created.state, created.id);
      },
      onDelete: (slotId) => {
        deleteSlot(slotId);
        mountStartScreen();
      },
    },
  });
}

function persist() {
  saveState(state, activeSlotId);
  touchSlot(activeSlotId, { level: state.player.level, ngPlusCycle: state.ngPlusCycle });
}

// True while a battle overlay is mounted. The Stats button sits behind the
// full-viewport #overlay, so it is pointer-blocked but still keyboard-reachable;
// opening stats mid-battle would tear down the live battle overlay.
let battleActive = false;

// Set just before a boss fight starts, holding that fight's tier-scaled XP
// reward. handleBattleEnd reads and clears it (regardless of outcome) so it
// can never leak into a subsequent non-boss encounter's XP calculation.
let activeBossTierXp = null;
// Tier being attempted in the in-flight boss fight, mirroring activeBossTierXp.
// state.bossTier only advances on a win (handleBattleEnd resolves it via
// resolveBossTierAfterWin) — a loss leaves it untouched, so accepting a
// rematch escalation and losing never skips a tier you haven't actually beaten.
let activeBossTierAttempt = null;

function setHudButtonsEnabled(enabled) {
  const statsButton = document.getElementById('btn-open-stats');
  if (statsButton) {
    statsButton.disabled = !enabled;
  }
  const inventoryButton = document.getElementById('btn-open-inventory');
  if (inventoryButton) {
    inventoryButton.disabled = !enabled;
  }
  const logButton = document.getElementById('btn-open-log');
  if (logButton) {
    logButton.disabled = !enabled;
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

  const inventoryButton = document.createElement('button');
  inventoryButton.id = 'btn-open-inventory';
  inventoryButton.textContent = '🎒 Inventory';
  inventoryButton.disabled = battleActive;
  inventoryButton.onclick = openInventory;

  const logButton = document.createElement('button');
  logButton.id = 'btn-open-log';
  logButton.textContent = '📜 Log';
  logButton.disabled = battleActive;
  logButton.onclick = openMessageLog;

  hud.appendChild(label);
  hud.appendChild(statsButton);
  hud.appendChild(inventoryButton);
  hud.appendChild(logButton);
}

function openStats() {
  if (battleActive) return;
  mountOverlay(statsPanel, {
    state,
    callbacks: { onClose: () => unmountOverlay() },
  });
}

function openInventory() {
  if (battleActive) return;
  mountOverlay(inventoryScreen, {
    state,
    callbacks: {
      onChange: () => {
        const effectiveMaxHp = state.player.maxHp + getEquipmentBonuses(state).maxHp;
        state.player.hp = Math.min(state.player.hp, effectiveMaxHp);
        persist();
        renderHud();
      },
      onClose: () => unmountOverlay(),
    },
  });
}

function openMessageLog() {
  if (battleActive) return;
  mountOverlay(messageLogScreen, {
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
      onMove: () => persist(),
      onAction: handleTileAction,
      onEncounter: handleEncounter,
      onEdgeTransition: handleEdgeTransition,
      onFirstVisit: handleFirstVisit,
      onCacheFound: handleCacheFound,
      onEnterMiniDungeon: handleEnterMiniDungeon,
      onLockedGate: handleLockedGate,
      onGateReward: handleGateReward,
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
  if (action === 'enterQuestBoard') return goToQuestBoard();
  if (action === 'bossBattle') {
    handleBossBattle();
    return;
  }
  if (action === 'exitMiniDungeon') return handleExitMiniDungeon();
  if (action === 'collectTreasure') return handleTreasureFound();
}

function enterMap(mapId) {
  state.position = { ...MAPS[mapId].startPosition };
  state.map = mapId;
  persist();
  goToMap(mapId);
}

function handleEdgeTransition(neighborId, direction, currentPosition) {
  const neighborMap = MAPS[neighborId];
  state.position = computeEdgeLandingPosition(direction, currentPosition, neighborMap);
  state.map = neighborId;
  persist();
  goToMap(neighborId);
}

function handleFirstVisit(screenId) {
  const text = FLAVOR_TEXT[screenId];
  if (text) {
    showFlavorBanner(text);
  }
  persist();
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
  persist();
  renderHud();
}

function handleLockedGate(message) {
  showFlavorBanner(message);
}

function handleGateReward(loot) {
  Object.assign(state, addGold(state, loot.gold));
  Object.assign(state, addItem(state, loot.item, 1));
  showFlavorBanner(`You clear the way and find a stash: ${loot.gold} gold and 1 ${ITEMS[loot.item].name}!`);
  persist();
  renderHud();
}

function handleEnterMiniDungeon(screenId, x, y) {
  const entrance = getMiniDungeonEntrance(state.miniDungeons, screenId, x, y);
  state.activeMiniDungeon = { screenId, x, y };
  state.position = { ...MAPS[entrance.variantId].startPosition };
  state.map = entrance.variantId;
  persist();
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
  persist();
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
  showFlavorBanner(`You found a treasure: ${loot.gold} gold and a ${itemDef.name}!`);
  persist();
  renderHud();
}

function handleBossBattle() {
  const offerTierEscalation = shouldPromptForRematch(state);
  const offerNgPlus = canStartNgPlus(state);
  if (!offerTierEscalation && !offerNgPlus) {
    startBossFight(state.bossTier);
    return;
  }
  setHudButtonsEnabled(false);
  mountOverlay(bossPromptScreen, {
    text: pickBossReturnFlavor(),
    showTierEscalation: offerTierEscalation,
    showNgPlus: offerNgPlus,
    callbacks: {
      onAccept: () => {
        startBossFight(nextBossTierToAttempt(state.bossTier));
      },
      onDecline: () => {
        startBossFight(state.bossTier);
      },
      onStartNgPlus: () => {
        Object.assign(state, resetWorldForNgPlus(state));
        persist();
        startGame(state, activeSlotId);
      },
    },
  });
}

function startBossFight(tier) {
  const monsterId = dungeonMap.bossMonsterId;
  const tierStats = getBossTierStats(MONSTERS[monsterId], tier);
  activeBossTierXp = tierStats.xp;
  activeBossTierAttempt = tier;
  handleEncounter(monsterId, {
    hp: tierStats.hp,
    attack: tierStats.attack,
    defense: tierStats.defense,
    speed: tierStats.speed,
  });
}

function goToShop() {
  mountScreen(shopScreen, {
    state,
    callbacks: {
      onPurchase: () => { persist(); renderHud(); },
      onLeave: () => goToMap('town'),
    },
  });
}

function goToSmith() {
  mountScreen(smithScreen, {
    state,
    callbacks: {
      onUpgrade: () => { persist(); renderHud(); },
      onLeave: () => goToMap('town'),
    },
  });
}

function goToQuestBoard() {
  mountScreen(questBoardScreen, {
    state,
    callbacks: {
      onTurnIn: () => { persist(); renderHud(); },
      onLeave: () => goToMap('town'),
    },
  });
}

function handleEncounter(monsterId, monsterOverrides = null) {
  battleActive = true;
  setHudButtonsEnabled(false);
  const preScaled = { ...MONSTERS[monsterId], ...(monsterOverrides || {}) };
  const ngPlusOverrides = getNgPlusCombatOverrides(preScaled, state.ngPlusCycle);
  mountOverlay(battleScreen, {
    state,
    monsterId,
    monsterOverrides: ngPlusOverrides,
    callbacks: { onBattleEnd: handleBattleEnd },
  });
}

function handleBattleEnd(outcome, monsterId) {
  unmountOverlay();
  battleActive = false;
  setHudButtonsEnabled(true);
  const bossTierXp = activeBossTierXp;
  activeBossTierXp = null;
  const bossTierAttempt = activeBossTierAttempt;
  activeBossTierAttempt = null;

  if (outcome === 'won') {
    const monster = MONSTERS[monsterId];
    const rewardMultiplier = getNgPlusRewardMultiplier(state.ngPlusCycle);
    const baseXp = resolveBattleXp(bossTierXp, monster);
    const xp = Math.round(baseXp * rewardMultiplier.xp);
    const preLevelHp = state.player.hp;
    const { player, leveledUp } = applyXp(state.player, xp);
    state.player = player;
    if (leveledUp) {
      const effectiveMaxHp = state.player.maxHp + getEquipmentBonuses(state).maxHp;
      state.player.hp = state.player.level >= LATE_GAME_LEVEL_THRESHOLD
        ? Math.round(preLevelHp + (effectiveMaxHp - preLevelHp) * LEVEL_UP_PARTIAL_HEAL_FRACTION)
        : effectiveMaxHp;
    }

    const scaledMonster = { ...monster, dropTable: scaleDropTable(monster.dropTable, state.ngPlusCycle) };
    const drop = rollDrop(scaledMonster);
    const gold = Math.round(drop.gold * rewardMultiplier.gold);
    Object.assign(state, addGold(state, gold));
    if (drop.item) {
      Object.assign(state, addItem(state, drop.item, 1));
    }
    if (monster.isBoss) {
      state.flags.dungeonBossDefeated = true;
      if (bossTierAttempt !== null) {
        state.bossTier = resolveBossTierAfterWin(state.bossTier, bossTierAttempt);
      }
    }
    Object.assign(state, incrementQuestProgress(state, monsterId));
    state.lossStreak = 0;

    persist();
    renderHud();
  } else if (outcome === 'lost') {
    state.player.hp = state.player.maxHp + getEquipmentBonuses(state).maxHp;
    state.position = { ...townMap.startPosition };
    state.map = 'town';
    state.activeMiniDungeon = null;
    state.lossStreak = incrementLossStreak(state.lossStreak);
    const potionsGranted = potionsForStreak(state.lossStreak);
    Object.assign(state, addItem(state, 'potion', potionsGranted));
    showFlavorBanner(getComebackMessage(potionsGranted));
    persist();
    renderHud();
    goToMap('town');
  } else if (outcome === 'fled') {
    persist();
    renderHud();
  }
}

migrateLegacySave();
mountStartScreen();
