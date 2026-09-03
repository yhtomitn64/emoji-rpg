export const DEFAULT_THEME = 'realistic';

export const SOUND_CATEGORY = {
  // Combat
  hitNormal: 'combat', hitCrit: 'combat', hitMiss: 'combat',
  parrySuccess: 'combat', parryFail: 'combat',
  timingSuccess: 'combat', timingFail: 'combat',
  revive: 'combat', monsterAbilityGeneric: 'combat',
  abilitySwingStab: 'combat', abilitySwingChop: 'combat',
  abilitySwingSlash: 'combat', abilitySwingSweep: 'combat',
  abilitySwingSuperScream: 'combat',
  battleStart: 'combat', battleEnd: 'combat',
  bossBattleStart: 'combat', bossBattleEnd: 'combat',
  eliteEncounterSting: 'combat',

  // UI
  menuMove: 'ui', menuSelect: 'ui', dialogClose: 'ui', actionInvalid: 'ui',

  // World
  levelUp: 'world', celebrationGeneric: 'world',
  itemPickupCommon: 'world', itemPickupLegendary: 'world',
  toolCelebration: 'world', questTurnIn: 'world', shopTransaction: 'world',
  smithUpgrade: 'world', walking: 'world', discoverySting: 'world',
  cacheOpen: 'world', comebackWarp: 'world',
  potionHeal: 'world', potionStrengthDraught: 'world', potionIronSkinTonic: 'world',
  potionSwiftElixir: 'world', potionVampiricTonic: 'world', potionMomentumElixir: 'world',
  potionEmberVial: 'world', potionThornbarkDraught: 'world', potionFocusTonic: 'world',
  potionBerserkerTonic: 'world', potionSecondWind: 'world',

  // Music
  townTheme: 'music', overworldTheme: 'music', battleTheme: 'music',
  bossBattleTheme: 'music', dungeonCavernTheme: 'music', toolDungeonTheme: 'music',
  dragonDungeonTheme: 'music', portalDungeonTheme: 'music', zoneEdgeTheme: 'music',
};

function sfxPath(soundId) {
  return `assets/audio/realistic/sfx/${soundId}.mp3`;
}
function musicPath(soundId) {
  return `assets/audio/realistic/music/${soundId}.mp3`;
}

export const SOUND_THEMES = {
  realistic: Object.fromEntries(
    Object.entries(SOUND_CATEGORY).map(([soundId, category]) => [
      soundId,
      category === 'music' ? musicPath(soundId) : sfxPath(soundId),
    ])
  ),
  // Future themes (e.g. metal, symphony, chiptune) get their own entry here,
  // filled in only for the sounds that theme covers - resolvePath() falls
  // back to `realistic` for anything missing, so a partial theme still works.
};

export function resolvePath(theme, soundId) {
  if (!(soundId in SOUND_CATEGORY)) return null;
  return SOUND_THEMES[theme]?.[soundId] ?? SOUND_THEMES[DEFAULT_THEME][soundId];
}
