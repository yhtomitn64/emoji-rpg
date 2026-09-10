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
  // Faultline's own per-enemy impact. It resolves as a staggered walk across
  // every living enemy (SWEEP_STAGGER_MS in js/screens/battleScreen.js), so
  // its impacts land 260ms apart and need to be shorter and more brittle
  // than the general-purpose hitNormal thud, or consecutive hits smear.
  abilitySweepImpact: 'combat',
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

// Sounds with more than one recorded take, so playback can rotate between
// them instead of machine-gunning the same file. Worth it for anything that
// fires repeatedly in quick succession - hits, footsteps, menu ticks - and
// pointless for one-offs like levelUp. Number is how many takes exist; files
// are `<soundId>.mp3`, `<soundId>-2.mp3`, `<soundId>-3.mp3`, ... so adding a
// take is this number plus dropping the file in.
export const SOUND_VARIANTS = {
  // hitNormal: 3,
};

function variantFilenames(soundId) {
  const count = SOUND_VARIANTS[soundId] || 1;
  return Array.from({ length: count }, (_, i) => (i === 0 ? soundId : `${soundId}-${i + 1}`));
}

function themePaths(soundId, category, theme = DEFAULT_THEME) {
  const folder = category === 'music' ? 'music' : 'sfx';
  const paths = variantFilenames(soundId).map((name) => `assets/audio/${theme}/${folder}/${name}.mp3`);
  return paths.length === 1 ? paths[0] : paths;
}

export const SOUND_THEMES = {
  [DEFAULT_THEME]: Object.fromEntries(
    Object.entries(SOUND_CATEGORY).map(([soundId, category]) => [
      soundId,
      themePaths(soundId, category),
    ])
  ),
  // Future themes (e.g. metal, symphony, chiptune) get their own entry here,
  // filled in only for the sounds that theme covers - resolvePath() falls
  // back to `realistic` for anything missing, so a partial theme still works.
};

// Always an array, even for single-take sounds - callers that rotate between
// variants (playSfx) don't want to special-case the common one-file shape.
export function resolvePaths(theme, soundId) {
  if (!(soundId in SOUND_CATEGORY)) return [];
  const entry = SOUND_THEMES[theme]?.[soundId] ?? SOUND_THEMES[DEFAULT_THEME][soundId];
  if (!entry) return [];
  return Array.isArray(entry) ? entry : [entry];
}

export function resolvePath(theme, soundId) {
  return resolvePaths(theme, soundId)[0] ?? null;
}
