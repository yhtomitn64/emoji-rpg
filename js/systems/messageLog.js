export const MESSAGE_LOG_CAP = 50;

export function appendMessage(log, text) {
  const next = [...log, text];
  if (next.length > MESSAGE_LOG_CAP) {
    return next.slice(next.length - MESSAGE_LOG_CAP);
  }
  return next;
}

const OUTCOME_VERBS = {
  won: (monsterName) => `Defeated ${monsterName}!`,
  lost: (monsterName) => `${monsterName} defeated you.`,
  fled: (monsterName) => `Fled from ${monsterName}.`,
  surrender: (monsterName) => `${monsterName} surrenders!`,
  'fled-with-loot': (monsterName) => `${monsterName} flees, dropping loot!`,
  'fled-empty': (monsterName) => `${monsterName} flees!`,
};

export function formatBattleOutcomeMessage(outcome, monsterName, player) {
  const headline = OUTCOME_VERBS[outcome](monsterName);
  const stats = `Lv.${player.level} ATK ${player.attack} DEF ${player.defense} HP ${player.hp}/${player.maxHp}`;
  return `${headline} (${stats})`;
}

export function describeMonsterGroup(monsterIds, monsterNameById) {
  if (monsterIds.length === 0) return '';
  const name = monsterNameById(monsterIds[0]);
  return monsterIds.length === 1 ? name : `${monsterIds.length} ${name}s`;
}
