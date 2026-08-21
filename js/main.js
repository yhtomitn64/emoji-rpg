import { loadState, saveState, DEFAULT_HERO_EMOJI, DEFAULT_DUNGEON_ENTRANCE_POSITION } from './state.js';
import { mountScreen, mountOverlay, unmountOverlay } from './screens/screenManager.js';
import * as mapScreen from './screens/mapScreen.js';
import * as battleScreen from './screens/battleScreen.js';
import * as shopScreen from './screens/shopScreen.js';
import * as smithScreen from './screens/smithScreen.js';
import * as statsPanel from './screens/statsPanel.js';
import * as inventoryScreen from './screens/inventoryScreen.js';
import * as messageLogScreen from './screens/messageLogScreen.js';
import * as lootReferenceScreen from './screens/lootReferenceScreen.js';
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
import { miniDungeonVariantD } from './maps/miniDungeons/variantD.js';
import { miniDungeonVariantE } from './maps/miniDungeons/variantE.js';
import { MONSTERS } from './data/monsters.js';
import { ITEMS } from './data/items.js';
import { FLAVOR_TEXT } from './data/flavorText.js';
import { showFlavorBanner } from './screens/flavorBanner.js';
import { formatBattleOutcomeMessage, describeMonsterGroup } from './systems/messageLog.js';
import { playCelebration } from './screens/celebrationEffect.js';
import { applyXp, LATE_GAME_LEVEL_THRESHOLD, LEVEL_UP_PARTIAL_HEAL_FRACTION, hasEverKilledSomething } from './systems/leveling.js';
import { rollDrop } from './systems/loot.js';
import { addGold, addItem, getEquipmentBonuses } from './systems/inventory.js';
import { computeEdgeLandingPosition, isValidSavedPosition } from './systems/world.js';
import { getMiniDungeonEntrance, isTreasureTaken, markTreasureTaken, rollMiniDungeonTreasure } from './systems/miniDungeons.js';
import { getBossTierStats, pickBossReturnFlavor, shouldPromptForRematch, resolveBattleXp, nextBossTierToAttempt, resolveBossTierAfterWin, getClearedTierList } from './systems/bossTiers.js';
import * as bossPromptScreen from './screens/bossPromptScreen.js';
import { listSlots, createSlot, deleteSlot, touchSlot, migrateLegacySave } from './systems/saveSlots.js';
import { canStartNgPlus, getNgPlusCombatOverrides, getNgPlusRewardMultiplier, scaleDropTable, resetWorldForNgPlus } from './systems/ngPlus.js';
import { incrementQuestProgress } from './systems/quests.js';
import { rollEncounterGroup, incrementKillCount } from './systems/groupEncounters.js';
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
  miniDungeonD: miniDungeonVariantD,
  miniDungeonE: miniDungeonVariantE,
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
  if (!state.monsterKillCounts) {
    state.monsterKillCounts = {
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
  if (!state.dungeonEntrancePosition) {
    state.dungeonEntrancePosition = DEFAULT_DUNGEON_ENTRANCE_POSITION;
  }
  if (state.flags.firstKillCelebrated === undefined) {
    state.flags.firstKillCelebrated = hasEverKilledSomething(state.player);
  }
  if (!state.player.emoji) {
    state.player.emoji = DEFAULT_HERO_EMOJI;
  }
  renderHud();
  goToMap(state.map);
}

function mountStartScreen() {
  mountScreen(startScreen, {
    slots: listSlots(),
    callbacks: {
      onContinue: (slotId) => startGame(loadState(slotId), slotId),
      onNewGame: (name, heroEmoji) => {
        const created = createSlot(name, heroEmoji);
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

// Set just before an encounter's battle overlay mounts, holding the full list of
// monster ids in that encounter (not just the ones that end up killed). handleBattleEnd
// reads and clears it. Needed because callbacks.onBattleEnd only reports killedMonsterIds,
// which is always empty for the pre-fight weak-mob 'fled-with-loot' outcome (the solo
// monster flees before taking any damage) - that branch still needs to know which monster
// it was to price the loot roll.
let activeEncounterMonsterIds = null;

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
  const lootButton = document.getElementById('btn-open-loot-reference');
  if (lootButton) {
    lootButton.disabled = !enabled;
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

  const lootButton = document.createElement('button');
  lootButton.id = 'btn-open-loot-reference';
  lootButton.textContent = '📖 Loot';
  lootButton.disabled = battleActive;
  lootButton.onclick = openLootReference;

  hud.appendChild(label);
  hud.appendChild(statsButton);
  hud.appendChild(inventoryButton);
  hud.appendChild(logButton);
  hud.appendChild(lootButton);
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

function openLootReference() {
  if (battleActive) return;
  mountOverlay(lootReferenceScreen, {
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
      onToolGateCleared: handleToolGateCleared,
      onGateReward: handleGateReward,
    },
  });
}

function handleTileAction(action) {
  if (action === 'enterTown') return enterMap('town');
  if (action === 'enterDungeon') return enterMap('dungeon');
  if (action === 'exitMap') {
    if (state.map === 'town') return enterMap('center');
    if (state.map === 'dungeon') return enterMap(state.dungeonEntrancePosition.screenId);
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
  if (action === 'useWell') return handleUseWell();
}

function handleUseWell() {
  const effectiveMaxHp = state.player.maxHp + getEquipmentBonuses(state).maxHp;
  if (state.player.hp >= effectiveMaxHp) {
    showFlavorBanner('You are already at full health.');
    return;
  }
  state.player.hp = effectiveMaxHp;
  persist();
  renderHud();
  showFlavorBanner('You rest at the well and feel fully restored.');
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
  const isFalseDungeonHint =
    screenId === 'southeast' && state.dungeonEntrancePosition.screenId !== 'southeast';
  const text = FLAVOR_TEXT[screenId];
  if (text && !isFalseDungeonHint) {
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

function handleToolGateCleared(message) {
  showFlavorBanner(message);
}

// A tool item (miningPick, axe) permanently unlocks something the moment
// you first get it, unlike a regular material - worth a first-time
// celebration that tells the player what they can now do. Any repeat drop
// of a tool the player already carries is a quiet, ordinary pickup.
function grantDropItem(itemId) {
  const item = ITEMS[itemId];
  const isNewTool = item.type === 'tool' && !state.inventory.some((entry) => entry.itemId === itemId && entry.quantity > 0);
  Object.assign(state, addItem(state, itemId, 1));
  if (isNewTool) {
    playCelebration(item.emoji, `You found a ${item.name}! ${item.description}.`);
  }
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
    showNgPlus: offerNgPlus,
    clearedTiers: getClearedTierList(state),
    callbacks: {
      onFight: () => {
        startBossFight(offerTierEscalation ? nextBossTierToAttempt(state.bossTier) : state.bossTier);
      },
      onWalkAway: () => {
        unmountOverlay();
        setHudButtonsEnabled(true);
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
  handleEncounter([monsterId], [{
    hp: tierStats.hp,
    attack: tierStats.attack,
    defense: tierStats.defense,
    speed: tierStats.speed,
  }]);
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

function handleEncounter(monsterIds, monsterOverridesList = null) {
  battleActive = true;
  setHudButtonsEnabled(false);
  activeEncounterMonsterIds = monsterIds;
  const ngPlusOverridesList = monsterIds.map((monsterId, i) => {
    const overrides = monsterOverridesList ? monsterOverridesList[i] : null;
    const preScaled = { ...MONSTERS[monsterId], ...(overrides || {}) };
    return getNgPlusCombatOverrides(preScaled, state.ngPlusCycle);
  });
  mountOverlay(battleScreen, {
    state,
    monsterIds,
    monsterOverrides: ngPlusOverridesList,
    callbacks: { onBattleEnd: handleBattleEnd },
  });
}

function handleBattleEnd(outcome, killedMonsterIds) {
  unmountOverlay();
  battleActive = false;
  setHudButtonsEnabled(true);
  const bossTierXp = activeBossTierXp;
  activeBossTierXp = null;
  const bossTierAttempt = activeBossTierAttempt;
  activeBossTierAttempt = null;
  const encounterMonsterIds = activeEncounterMonsterIds;
  activeEncounterMonsterIds = null;

  // Snapshot effective stats as they stood at the moment combat ended (state.player.hp
  // already reflects the battle's outcome here - battleScreen.js's endBattle() synced it
  // before this callback fires), before any post-battle reward/heal mutations below change
  // them, so the log entry reflects what actually fought this battle, not what you have now.
  const bonuses = getEquipmentBonuses(state);
  const playerSnapshot = {
    level: state.player.level,
    attack: state.player.attack + bonuses.attack,
    defense: state.player.defense + bonuses.defense,
    hp: state.player.hp,
    maxHp: state.player.maxHp + bonuses.maxHp,
  };
  const groupName = describeMonsterGroup(killedMonsterIds, (id) => MONSTERS[id].name);
  showFlavorBanner(formatBattleOutcomeMessage(outcome, groupName, playerSnapshot));

  if (outcome === 'won' || outcome === 'surrender') {
    if (!state.flags.firstKillCelebrated) {
      state.flags.firstKillCelebrated = true;
      playCelebration('🎉', 'First blood! You feel like a real adventurer now.');
    }
    const rewardMultiplier = getNgPlusRewardMultiplier(state.ngPlusCycle);
    let leveledUpThisBattle = false;
    for (const monsterId of killedMonsterIds) {
      const monster = MONSTERS[monsterId];
      const baseXp = resolveBattleXp(bossTierXp, monster);
      const xp = Math.round(baseXp * rewardMultiplier.xp);
      const preLevelHp = state.player.hp;
      const { player, leveledUp } = applyXp(state.player, xp);
      state.player = player;
      if (leveledUp) {
        leveledUpThisBattle = true;
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
        grantDropItem(drop.item);
      }
      if (monster.isBoss) {
        state.flags.dungeonBossDefeated = true;
        if (bossTierAttempt !== null) {
          state.bossTier = resolveBossTierAfterWin(state.bossTier, bossTierAttempt);
        }
      }
      Object.assign(state, incrementQuestProgress(state, monsterId));
      Object.assign(state, { monsterKillCounts: incrementKillCount(state.monsterKillCounts, monsterId) });
    }
    if (leveledUpThisBattle) {
      playCelebration('⭐', `Level up! You are now level ${state.player.level}.`);
    }
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
  } else if (outcome === 'fled-with-loot') {
    // Solo-only outcome from the pre-fight weak-mob check (battleScreen.js gates it to
    // monsterIds.length === 1) - the monster flees before taking any damage, so
    // killedMonsterIds is always empty here and can't tell us which monster it was.
    // encounterMonsterIds (captured in handleEncounter) is the only source left.
    const monster = MONSTERS[encounterMonsterIds[0]];
    const rewardMultiplier = getNgPlusRewardMultiplier(state.ngPlusCycle);
    const scaledMonster = { ...monster, dropTable: scaleDropTable(monster.dropTable, state.ngPlusCycle) };
    const drop = rollDrop(scaledMonster);
    const gold = Math.round(drop.gold * rewardMultiplier.gold);
    Object.assign(state, addGold(state, gold));
    if (drop.item) {
      grantDropItem(drop.item);
    }
    persist();
    renderHud();
  } else if (outcome === 'fled') {
    const rewardMultiplier = getNgPlusRewardMultiplier(state.ngPlusCycle);
    for (const monsterId of killedMonsterIds) {
      const monster = MONSTERS[monsterId];
      const baseXp = resolveBattleXp(null, monster);
      const xp = Math.round(baseXp * rewardMultiplier.xp);
      const { player } = applyXp(state.player, xp);
      state.player = player;
      const scaledMonster = { ...monster, dropTable: scaleDropTable(monster.dropTable, state.ngPlusCycle) };
      const drop = rollDrop(scaledMonster);
      const gold = Math.round(drop.gold * rewardMultiplier.gold);
      Object.assign(state, addGold(state, gold));
      if (drop.item) {
        grantDropItem(drop.item);
      }
      Object.assign(state, incrementQuestProgress(state, monsterId));
      Object.assign(state, { monsterKillCounts: incrementKillCount(state.monsterKillCounts, monsterId) });
    }
    persist();
    renderHud();
  } else if (outcome === 'fled-empty') {
    persist();
    renderHud();
  }
}

migrateLegacySave();
mountStartScreen();
