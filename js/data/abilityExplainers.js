// In-battle explainer copy for js/screens/mechanicExplainerScreen.js -
// shown once per ability (js/main.js, right after the ability-unlocked
// celebration banner) and once for the attack-falloff mechanic
// (js/screens/battleScreen.js, the first time it actually decays a hit).
// Both trigger paths are gated behind the mechanicExplainersBeta feature
// flag (js/state.js) while these stay empty placeholders - Timothy writes
// this copy himself, not this session. Fill in the strings below when the
// real text is ready; leave the flag off until then.

export const ABILITY_EXPLAINERS = {
  stab: '',
  chop: '',
  slash: '',
  sweep: '',
  superScream: '',
};

export const ATTACK_FALLOFF_EXPLAINER = '';
