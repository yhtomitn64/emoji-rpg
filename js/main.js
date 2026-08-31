import { loadState, saveState, DEFAULT_HERO_EMOJI, DEFAULT_DUNGEON_ENTRANCE_POSITION, migrateRingSlots, migrateBestDamage } from './state.js';
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
import * as logoutConfirmScreen from './screens/logoutConfirmScreen.js';
import * as postDeathTravelScreen from './screens/postDeathTravelScreen.js';
import { townMap } from './maps/townMap.js';
import { dungeonMap } from './maps/dungeonMap.js';
import { axeDungeonMap } from './maps/toolDungeons/axeDungeon.js';
import { pickDungeonMap } from './maps/toolDungeons/pickDungeon.js';
import { canoeDungeonMap } from './maps/toolDungeons/canoeDungeon.js';
import { TOOL_DUNGEON_ENTRANCES } from './data/toolDungeons.js';
import { centerMap } from './maps/wilderness/center.js';
import { northMap } from './maps/wilderness/north.js';
import { southMap } from './maps/wilderness/south.js';
import { eastMap } from './maps/wilderness/east.js';
import { westMap } from './maps/wilderness/west.js';
import { northeastMap } from './maps/wilderness/northeast.js';
import { northwestMap } from './maps/wilderness/northwest.js';
import { southeastMap } from './maps/wilderness/southeast.js';
import { southwestMap } from './maps/wilderness/southwest.js';
import { farNorthwestMap } from './maps/wilderness/farNorthwest.js';
import { northNorthwestMap } from './maps/wilderness/northNorthwest.js';
import { farNorthMap } from './maps/wilderness/farNorth.js';
import { northNortheastMap } from './maps/wilderness/northNortheast.js';
import { farNortheastMap } from './maps/wilderness/farNortheast.js';
import { westNorthwestMap } from './maps/wilderness/westNorthwest.js';
import { farWestMap } from './maps/wilderness/farWest.js';
import { westSouthwestMap } from './maps/wilderness/westSouthwest.js';
import { eastNortheastMap } from './maps/wilderness/eastNortheast.js';
import { farEastMap } from './maps/wilderness/farEast.js';
import { eastSoutheastMap } from './maps/wilderness/eastSoutheast.js';
import { southSouthwestMap } from './maps/wilderness/southSouthwest.js';
import { farSouthMap } from './maps/wilderness/farSouth.js';
import { southSoutheastMap } from './maps/wilderness/southSoutheast.js';
import { farSouthwestMap } from './maps/wilderness/farSouthwest.js';
import { farSoutheastMap } from './maps/wilderness/farSoutheast.js';
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
import { playCelebration, playToolCelebration } from './screens/celebrationEffect.js';
import { playItemPickupToast } from './screens/itemPickupToast.js';
import { applyXp, LATE_GAME_LEVEL_THRESHOLD, LEVEL_UP_PARTIAL_HEAL_FRACTION, hasEverKilledSomething } from './systems/leveling.js';
import { ABILITIES } from './systems/abilities.js';
import { rollDrop } from './systems/loot.js';
import { tierLabel } from './systems/itemQuality.js';
import { addGold, addItem, spendGold, getEquipmentBonuses, migrateUpgradesToPerTier } from './systems/inventory.js';
import { isValidSavedPosition } from './systems/world.js';
import { buildWorldGrid } from './systems/worldGrid.js';
import { getMiniDungeonEntrance, isTreasureTaken, markTreasureTaken, rollMiniDungeonTreasure } from './systems/miniDungeons.js';
import { getBossTierStats, pickBossReturnFlavor, shouldPromptForRematch, resolveBattleXp, resolveBossTierAfterWin, getClearedTierList } from './systems/bossTiers.js';
import * as bossPromptScreen from './screens/bossPromptScreen.js';
import { listSlots, createSlot, deleteSlot, touchSlot, migrateLegacySave } from './systems/saveSlots.js';
import { canStartNgPlus, getNgPlusCombatOverrides, getNgPlusRewardMultiplier, scaleDropTable, resetWorldForNgPlus, migrateNgPlusToolCarryover } from './systems/ngPlus.js';
import { pickMonsterVariant } from './systems/monsterVariants.js';
import { resolveWeakMobEncounter } from './systems/combat.js';
import { incrementQuestProgress } from './systems/quests.js';
import { incrementKillCount } from './systems/groupEncounters.js';
import { incrementLossStreak, potionsForStreak, getComebackMessage, postDeathWarpCost } from './systems/comeback.js';
import * as questBoardScreen from './screens/questBoardScreen.js';
import * as changelogScreen from './screens/changelogScreen.js';
import { PLAYER_CHANGELOG } from './data/playerChangelog.js';

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
  farNorthwest: farNorthwestMap,
  northNorthwest: northNorthwestMap,
  farNorth: farNorthMap,
  northNortheast: northNortheastMap,
  farNortheast: farNortheastMap,
  westNorthwest: westNorthwestMap,
  farWest: farWestMap,
  westSouthwest: westSouthwestMap,
  eastNortheast: eastNortheastMap,
  farEast: farEastMap,
  eastSoutheast: eastSoutheastMap,
  southSouthwest: southSouthwestMap,
  farSouth: farSouthMap,
  southSoutheast: southSoutheastMap,
  farSouthwest: farSouthwestMap,
  farSoutheast: farSoutheastMap,
  miniDungeonA: miniDungeonVariantA,
  miniDungeonB: miniDungeonVariantB,
  miniDungeonC: miniDungeonVariantC,
  miniDungeonD: miniDungeonVariantD,
  miniDungeonE: miniDungeonVariantE,
  axeDungeon: axeDungeonMap,
  pickDungeon: pickDungeonMap,
  canoeDungeon: canoeDungeonMap,
};

const WORLD_GRID = buildWorldGrid(MAPS);

let state = null;
let activeSlotId = null;

function startGame(loadedState, slotId) {
  state = migrateUpgradesToPerTier(loadedState);
  state = migrateNgPlusToolCarryover(state);
  state = migrateRingSlots(state);
  state = migrateBestDamage(state);
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
  if (!state.questLevel) {
    state.questLevel = {
      boar: 1, bat: 1, snake: 1, goblin: 1,
      direWolf: 1, spider: 1, orc: 1, wraith: 1,
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
  if (!state.toolGateHintsShown) {
    state.toolGateHintsShown = {};
  }
  if (!state.clearedGates) {
    state.clearedGates = {};
  }
  if (!state.lossStreak) {
    state.lossStreak = 0;
  }
  if (!state.zone1Steps) {
    state.zone1Steps = 0;
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
  const logoutButton = document.getElementById('btn-logout');
  if (logoutButton) {
    logoutButton.disabled = !enabled;
  }
  const changelogButton = document.getElementById('btn-open-changelog');
  if (changelogButton) {
    changelogButton.disabled = !enabled;
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

  const logoutButton = document.createElement('button');
  logoutButton.id = 'btn-logout';
  logoutButton.textContent = '🚪 Switch Character';
  logoutButton.disabled = battleActive;
  logoutButton.onclick = openLogoutConfirm;

  hud.appendChild(label);
  hud.appendChild(statsButton);
  hud.appendChild(inventoryButton);
  hud.appendChild(logButton);
  hud.appendChild(lootButton);
  hud.appendChild(logoutButton);
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

function renderVersionFooter() {
  const footer = document.getElementById('version-footer');
  const latest = PLAYER_CHANGELOG[0];
  if (!latest) {
    footer.innerHTML = '';
    return;
  }
  footer.innerHTML = `<button id="btn-open-changelog">v${latest.version} · What's New</button>`;
  document.getElementById('btn-open-changelog').onclick = openChangelog;
}

function openChangelog() {
  if (battleActive) return;
  mountOverlay(changelogScreen, {
    entries: PLAYER_CHANGELOG,
    callbacks: { onClose: () => unmountOverlay() },
  });
}

function openLogoutConfirm() {
  if (battleActive) return;
  mountOverlay(logoutConfirmScreen, {
    callbacks: {
      onConfirm: () => {
        persist();
        unmountOverlay();
        mountStartScreen();
      },
      onCancel: () => unmountOverlay(),
    },
  });
}

function goToMap(mapId) {
  state.map = mapId;
  renderHud();
  mountScreen(mapScreen, {
    state,
    mapConfig: MAPS[mapId],
    maps: MAPS,
    worldGrid: WORLD_GRID,
    callbacks: {
      onMove: () => persist(),
      onAction: handleTileAction,
      onEncounter: handleEncounter,
      onFirstVisit: handleFirstVisit,
      onCacheFound: handleCacheFound,
      onEnterMiniDungeon: handleEnterMiniDungeon,
      onLockedGate: handleLockedGate,
      onToolGateCleared: handleToolGateCleared,
      onToolGateNearby: handleToolGateNearby,
      onGateReward: handleGateReward,
    },
  });
}

function handleTileAction(action) {
  if (action === 'enterTown') return enterMap('town');
  if (action === 'enterDungeon') return enterMap('dungeon');
  if (action === 'enterAxeDungeon') return enterMap(TOOL_DUNGEON_ENTRANCES.axe.mapId);
  if (action === 'enterPickDungeon') return enterMap(TOOL_DUNGEON_ENTRANCES.pick.mapId);
  if (action === 'enterCanoeDungeon') return enterMap(TOOL_DUNGEON_ENTRANCES.canoe.mapId);
  if (action === 'exitMap') {
    if (state.map === 'town') return enterMap('center');
    // Land back on the exact entrance tile, not the destination screen's
    // generic startPosition - otherwise leaving a dungeon drops the player
    // somewhere else on the screen entirely, with no immediate way back to
    // use whatever the dungeon just gave them (e.g. a tool-dungeon's own
    // shortcut, raised 2026-08-28).
    if (state.map === 'dungeon') {
      const { screenId, x, y } = state.dungeonEntrancePosition;
      return enterMap(screenId, { x, y });
    }
    for (const toolEntrance of Object.values(TOOL_DUNGEON_ENTRANCES)) {
      if (state.map === toolEntrance.mapId) {
        return enterMap(toolEntrance.screenId, { x: toolEntrance.x, y: toolEntrance.y });
      }
    }
    return;
  }
  if (action === 'enterShop') return goToShop();
  if (action === 'enterSmith') return goToSmith();
  if (action === 'enterQuestBoard') return goToQuestBoard();
  if (action === 'bossBattle') {
    handleBossBattle();
    return;
  }
  if (action === 'guardianBattle') {
    handleEncounter([MAPS[state.map].guardianMonsterId]);
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

function enterMap(mapId, position) {
  state.position = position ? { ...position } : { ...MAPS[mapId].startPosition };
  state.map = mapId;
  persist();
  goToMap(mapId);
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

function handleToolGateCleared(message) {
  showFlavorBanner(message);
}

function handleToolGateNearby(message) {
  showFlavorBanner(message);
  persist();
}

// A tool item (miningPick, axe) permanently unlocks something the moment
// you first get it, unlike a regular material - worth a first-time
// celebration that tells the player what they can now do. Any repeat drop
// of a tool the player already carries is a quiet, ordinary pickup.
function grantDropItem(itemId, tier) {
  const item = ITEMS[itemId];
  const isNewTool = item.type === 'tool' && !state.inventory.some((entry) => entry.itemId === itemId && entry.quantity > 0);
  Object.assign(state, addItem(state, itemId, 1, tier));
  const displayName = `${tierLabel(tier)}${item.name}`;
  if (isNewTool) {
    playToolCelebration(item.emoji, `You found a ${displayName}! ${item.description}.`, `${item.description}!`);
  } else {
    playItemPickupToast(item.emoji, displayName);
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
    currentTier: state.bossTier,
    callbacks: {
      onFight: (tier) => {
        startBossFight(tier);
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
  // A null monsterOverridesList means a regular (non-boss) encounter - boss
  // fights always pass their own explicit tier overrides, so this branch
  // never fires for those. Each monster in the group independently rolls a
  // named stat variant (js/systems/monsterVariants.js).
  const variantOverridesList = monsterOverridesList || monsterIds.map((monsterId) => pickMonsterVariant(MONSTERS[monsterId]));
  const ngPlusOverridesList = monsterIds.map((monsterId, i) => {
    const overrides = variantOverridesList[i];
    const preScaled = { ...MONSTERS[monsterId], ...(overrides || {}) };
    const ngPlusStats = getNgPlusCombatOverrides(preScaled, state.ngPlusCycle);
    // getNgPlusCombatOverrides only returns combat stats, not name - carry a
    // variant's name through separately so it isn't silently dropped.
    return overrides && overrides.name ? { ...ngPlusStats, name: overrides.name } : ngPlusStats;
  });

  // Solo, non-boss encounters get a pre-fight chance to resolve instantly
  // (surrender/flee) without ever opening the battle dialog - per Timothy's
  // explicit ask, the player shouldn't see a dialog open and close again for
  // an outcome that was already decided. Multi-mob groups are unaffected,
  // matching this mechanic's existing scope. forceFullBattle monsters (tool-
  // dungeon guardians) are also exempt - a "fled-empty" outcome here would
  // drop them with no reward, breaking their guaranteed-drop guarantee. Not
  // using isBoss for that exemption: isBoss also flips
  // state.flags.dungeonBossDefeated (NG+ eligibility, meant only for the
  // real dragon) and blocks mid-battle fleeing, neither of which a guardian
  // fight should do.
  if (monsterIds.length === 1 && !MONSTERS[monsterIds[0]].isBoss && !MONSTERS[monsterIds[0]].forceFullBattle) {
    const bonuses = getEquipmentBonuses(state);
    const playerStats = { attack: state.player.attack + bonuses.attack, defense: state.player.defense + bonuses.defense };
    const weakMobOutcome = resolveWeakMobEncounter(playerStats, ngPlusOverridesList[0], false);
    if (weakMobOutcome) {
      activeEncounterMonsterIds = monsterIds;
      mapScreen.playMonsterFleeEffect(MONSTERS[monsterIds[0]].emoji);
      handleBattleEnd(weakMobOutcome, []);
      return;
    }
  }

  battleActive = true;
  setHudButtonsEnabled(false);
  activeEncounterMonsterIds = monsterIds;
  mountOverlay(battleScreen, {
    state,
    monsterIds,
    monsterOverrides: ngPlusOverridesList,
    callbacks: { onBattleEnd: handleBattleEnd, onHpChange: renderHud },
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

  // Snapshot effective stats and equipped gear as they stood at the moment combat ended
  // (state.player.hp already reflects the battle's outcome here - battleScreen.js's
  // endBattle() synced it before this callback fires), before any post-battle reward/heal
  // mutations below change them, so the log entry reflects what actually fought this
  // battle, not what you have now.
  const bonuses = getEquipmentBonuses(state);
  const gearSlots = ['weapon', 'head', 'body', 'legs', 'accessory'];
  const playerSnapshot = {
    level: state.player.level,
    attack: state.player.attack + bonuses.attack,
    defense: state.player.defense + bonuses.defense,
    hp: state.player.hp,
    maxHp: state.player.maxHp + bonuses.maxHp,
    gear: gearSlots.map((slot) => {
      const itemId = state.equipment[slot];
      return itemId ? `${tierLabel(state.equipmentTiers?.[slot])}${ITEMS[itemId].name}` : null;
    }),
  };
  const groupName = describeMonsterGroup(encounterMonsterIds, (id) => MONSTERS[id].name);
  showFlavorBanner(formatBattleOutcomeMessage(outcome, groupName, playerSnapshot));

  if (outcome === 'won' || outcome === 'surrender') {
    if (!state.flags.firstKillCelebrated) {
      state.flags.firstKillCelebrated = true;
      playCelebration('🎉', 'First blood! You feel like a real adventurer now.');
    }
    const rewardMultiplier = getNgPlusRewardMultiplier(state.ngPlusCycle);
    const levelBeforeRewards = state.player.level;
    let leveledUpThisBattle = false;
    // A surrender leaves the monster at full HP - killedMonsterIds is empty,
    // so surrender (always solo) must reward the full original roster instead.
    const rewardedMonsterIds = outcome === 'surrender' ? encounterMonsterIds : killedMonsterIds;
    for (const monsterId of rewardedMonsterIds) {
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
      const drop = rollDrop(scaledMonster, Math.random, state.ngPlusCycle);
      const gold = Math.round(drop.gold * rewardMultiplier.gold);
      Object.assign(state, addGold(state, gold));
      if (drop.item) {
        grantDropItem(drop.item, drop.tier);
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
      playCelebration('⭐', `Level up! You are now level ${state.player.level}.`, { bigText: 'LEVEL UP!' });
      mapScreen.playLevelUpEffect();
      const newlyUnlockedAbilities = ABILITIES.filter(
        (ability) => ability.unlockLevel > levelBeforeRewards && ability.unlockLevel <= state.player.level
      );
      if (newlyUnlockedAbilities.length > 0) {
        const names = newlyUnlockedAbilities.map((ability) => `${ability.icon} ${ability.name}`).join(', ');
        const emoji = newlyUnlockedAbilities.length === 1 ? newlyUnlockedAbilities[0].icon : '🔓';
        // playCelebration isn't queued - it just overwrites the shared banner/burst
        // elements immediately, so firing this in the same tick as the level-up
        // celebration above would clobber it before it's ever seen. Stagger past
        // that celebration's own burst animation (celebrationEffect.js's
        // BURST_DURATION_MS, 1400ms) so the two show in sequence instead.
        setTimeout(() => {
          playCelebration(emoji, `New ability unlocked: ${names}!`);
        }, 1600);
      }
    }
    state.lossStreak = 0;

    persist();
    renderHud();
  } else if (outcome === 'lost') {
    state.player.hp = state.player.maxHp + getEquipmentBonuses(state).maxHp;
    state.activeMiniDungeon = null;
    state.lossStreak = incrementLossStreak(state.lossStreak);
    const potionsGranted = potionsForStreak(state.lossStreak);
    Object.assign(state, addItem(state, 'potion', potionsGranted));
    showFlavorBanner(getComebackMessage(potionsGranted));
    persist();
    renderHud();
    promptPostDeathTravel();
  } else if (outcome === 'fled-with-loot') {
    // Solo-only outcome from the pre-fight weak-mob check (battleScreen.js gates it to
    // monsterIds.length === 1) - the monster flees before taking any damage, so
    // killedMonsterIds is always empty here and can't tell us which monster it was.
    // encounterMonsterIds (captured in handleEncounter) is the only source left.
    const monster = MONSTERS[encounterMonsterIds[0]];
    const rewardMultiplier = getNgPlusRewardMultiplier(state.ngPlusCycle);
    const scaledMonster = { ...monster, dropTable: scaleDropTable(monster.dropTable, state.ngPlusCycle) };
    const drop = rollDrop(scaledMonster, Math.random, state.ngPlusCycle);
    const gold = Math.round(drop.gold * rewardMultiplier.gold);
    Object.assign(state, addGold(state, gold));
    if (drop.item) {
      grantDropItem(drop.item, drop.tier);
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
      const drop = rollDrop(scaledMonster, Math.random, state.ngPlusCycle);
      const gold = Math.round(drop.gold * rewardMultiplier.gold);
      Object.assign(state, addGold(state, gold));
      if (drop.item) {
        grantDropItem(drop.item, drop.tier);
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

function promptPostDeathTravel() {
  const diedInDungeon = state.map === 'dungeon';
  const warpCost = postDeathWarpCost(state.player.level);
  setHudButtonsEnabled(false);
  mountOverlay(postDeathTravelScreen, {
    canWarpToDungeon: diedInDungeon,
    warpCost,
    canAffordWarp: diedInDungeon && state.player.gold >= warpCost,
    callbacks: {
      onReturnToTown: () => {
        state.position = { ...townMap.startPosition };
        persist();
        goToMap('town');
      },
      onWarpToDungeon: () => {
        Object.assign(state, spendGold(state, warpCost));
        const { screenId, x, y } = state.dungeonEntrancePosition;
        state.position = { x, y };
        persist();
        goToMap(screenId);
      },
    },
  });
}

migrateLegacySave();
mountStartScreen();
renderVersionFooter();
