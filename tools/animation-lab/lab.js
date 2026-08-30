// tools/animation-lab/lab.js
//
// Dev-only UI for designing weapon-swing animations. Reuses the real battle
// screen's CSS/DOM classes (via index.html's <link> to css/styles.css) so
// the preview is what the game will actually render, not a lookalike.
import { ITEMS } from '../../js/data/items.js';
import { ABILITIES } from '../../js/systems/abilities.js';
import {
  buildWaapiKeyframes,
  validateDesign,
  generateKeyframesCaseCode,
  generateDurationEntryCode,
  patchMarkedBlock,
} from './keyframes.js';

// Derived from the real ABILITIES table so these can't drift from the
// actual in-game icons the way a hand-copied stab: '🥊' once did. Attack
// has no ability object of its own (falls back to the equipped weapon's
// emoji - see swingSpriteEmoji's real-game counterpart), so it stays null.
const ABILITY_ICON_LOOKUP = Object.fromEntries(ABILITIES.map((a) => [a.id, a.icon]));
const ABILITY_ICONS = {
  attack: null,
  stab: ABILITY_ICON_LOOKUP.stab,
  chop: ABILITY_ICON_LOOKUP.chop,
  slash: ABILITY_ICON_LOOKUP.slash,
  sweep: ABILITY_ICON_LOOKUP.sweep,
};

const abilitySelect = document.getElementById('abilitySelect');
const weaponSelect = document.getElementById('weaponSelect');
const targetCountSelect = document.getElementById('targetCountSelect');
const stage = document.getElementById('labStage');
const monsterRow = document.getElementById('labMonsterRow');
const heroZone = document.getElementById('labHeroZone');
const anchorHandle = document.getElementById('anchorHandle');

function populateWeaponSelect() {
  Object.values(ITEMS)
    .filter((item) => item.slot === 'weapon')
    .forEach((weapon) => {
      const option = document.createElement('option');
      option.value = weapon.id;
      option.textContent = `${weapon.swingEmoji || weapon.emoji} ${weapon.name}`;
      weaponSelect.appendChild(option);
    });
}

function currentSwingEmoji() {
  const abilityId = abilitySelect.value;
  if (ABILITY_ICONS[abilityId]) return ABILITY_ICONS[abilityId];
  const weapon = ITEMS[weaponSelect.value];
  return weapon?.swingEmoji || weapon?.emoji || '👊';
}

function renderTargets() {
  const count = Number(targetCountSelect.value);
  monsterRow.innerHTML = '';
  for (let i = 0; i < count; i += 1) {
    const slot = document.createElement('div');
    slot.className = 'battle-combatant battle-monster-slot';
    slot.id = `labMonsterZone${i}`;
    slot.innerHTML = '<div class="battle-emoji battle-monster-emoji">👹</div><div class="battle-name">Target</div>';
    monsterRow.appendChild(slot);
  }
}

populateWeaponSelect();
renderTargets();
abilitySelect.addEventListener('change', renderTargets);
targetCountSelect.addEventListener('change', renderTargets);
weaponSelect.addEventListener('change', renderTargets);

// Timeline and keyframe editing
const DEFAULT_KEYFRAME = { offset: 0, x: 0, y: 0, dxFactor: 0, dyFactor: 0, rotate: 0, scale: 1 };

let currentDesign = { pinned: false, anchor: { x: 0, y: 0 }, durationMs: 1500, keyframes: [{ ...DEFAULT_KEYFRAME }, { ...DEFAULT_KEYFRAME, offset: 1 }] };
let selectedKeyframeIndex = 0;

const addKeyframeBtn = document.getElementById('addKeyframeBtn');
const removeKeyframeBtn = document.getElementById('removeKeyframeBtn');
const pinnedToggle = document.getElementById('pinnedToggle');
const timelineEl = document.getElementById('timeline');
const kfOffsetInput = document.getElementById('kfOffset');
const kfXInput = document.getElementById('kfX');
const kfYInput = document.getElementById('kfY');
const kfRotateInput = document.getElementById('kfRotate');
const kfScaleInput = document.getElementById('kfScale');
const designDurationInput = document.getElementById('designDuration');

function renderTimeline() {
  timelineEl.innerHTML = '';
  currentDesign.keyframes.forEach((kf, i) => {
    const stop = document.createElement('button');
    stop.textContent = `${Math.round(kf.offset * 100)}%`;
    stop.style.border = i === selectedKeyframeIndex ? '2px solid #fff' : '2px solid #444';
    stop.addEventListener('click', () => selectKeyframe(i));
    timelineEl.appendChild(stop);
  });
  updateAnchorHandlePosition();
}

function selectKeyframe(i) {
  selectedKeyframeIndex = i;
  const kf = currentDesign.keyframes[i];
  kfOffsetInput.value = kf.offset;
  kfXInput.value = kf.x;
  kfYInput.value = kf.y;
  kfRotateInput.value = kf.rotate;
  kfScaleInput.value = kf.scale;
  renderTimeline();
}

function updateAnchorHandlePosition() {
  const stageRect = stage.getBoundingClientRect();
  const heroRect = heroZone.getBoundingClientRect();
  const heroCenterX = heroRect.left + heroRect.width / 2 - stageRect.left;
  const heroCenterY = heroRect.top + heroRect.height / 2 - stageRect.top;
  anchorHandle.style.left = `${heroCenterX + currentDesign.anchor.x}px`;
  anchorHandle.style.top = `${heroCenterY + currentDesign.anchor.y}px`;
}

addKeyframeBtn.addEventListener('click', () => {
  currentDesign.keyframes.push({ ...DEFAULT_KEYFRAME, offset: 1 });
  currentDesign.keyframes.sort((a, b) => a.offset - b.offset);
  renderTimeline();
});

removeKeyframeBtn.addEventListener('click', () => {
  if (currentDesign.keyframes.length <= 2) return;
  currentDesign.keyframes.splice(selectedKeyframeIndex, 1);
  selectedKeyframeIndex = 0;
  renderTimeline();
  selectKeyframe(0);
});

pinnedToggle.addEventListener('change', () => {
  currentDesign.pinned = pinnedToggle.checked;
});

[kfXInput, kfYInput, kfRotateInput, kfScaleInput].forEach((input) => {
  input.addEventListener('input', () => {
    const kf = currentDesign.keyframes[selectedKeyframeIndex];
    kf.x = Number(kfXInput.value);
    kf.y = Number(kfYInput.value);
    kf.rotate = Number(kfRotateInput.value);
    kf.scale = Number(kfScaleInput.value);
  });
});

kfOffsetInput.addEventListener('input', () => {
  const editedKeyframe = currentDesign.keyframes[selectedKeyframeIndex];
  editedKeyframe.offset = Number(kfOffsetInput.value);
  // Changing an offset can reorder keyframes on the timeline - re-sort and
  // follow the edited keyframe object (not its old index) to its new
  // position so the inspector/timeline selection stays pointed at it.
  currentDesign.keyframes.sort((a, b) => a.offset - b.offset);
  selectedKeyframeIndex = currentDesign.keyframes.indexOf(editedKeyframe);
  renderTimeline();
});

designDurationInput.addEventListener('input', () => {
  currentDesign.durationMs = Number(designDurationInput.value);
});

let draggingAnchor = false;
anchorHandle.addEventListener('mousedown', () => { draggingAnchor = true; });
window.addEventListener('mouseup', () => { draggingAnchor = false; });
window.addEventListener('mousemove', (e) => {
  if (!draggingAnchor) return;
  const stageRect = stage.getBoundingClientRect();
  const heroRect = heroZone.getBoundingClientRect();
  const heroCenterX = heroRect.left + heroRect.width / 2;
  const heroCenterY = heroRect.top + heroRect.height / 2;
  currentDesign.anchor.x = e.clientX - heroCenterX;
  currentDesign.anchor.y = e.clientY - heroCenterY;
  updateAnchorHandlePosition();
});

renderTimeline();
selectKeyframe(0);

// Play/preview playback
const playBtn = document.getElementById('playBtn');

function firstTargetZone() {
  return monsterRow.firstElementChild;
}

function playPreview() {
  const targetZone = firstTargetZone();
  if (!targetZone) return;
  const heroRect = heroZone.getBoundingClientRect();
  const targetRect = targetZone.getBoundingClientRect();
  const dx = (targetRect.left + targetRect.width / 2) - (heroRect.left + heroRect.width / 2);
  const dy = (targetRect.top + targetRect.height / 2) - (heroRect.top + heroRect.height / 2);

  const sprite = document.createElement('div');
  sprite.textContent = currentSwingEmoji();
  sprite.className = 'battle-swing-sprite';
  sprite.style.position = 'fixed';
  sprite.style.left = `${heroRect.left + heroRect.width / 2}px`;
  sprite.style.top = `${heroRect.top + heroRect.height / 2}px`;
  document.body.appendChild(sprite);

  const waapiKeyframes = buildWaapiKeyframes(currentDesign, dx, dy);
  const animation = sprite.animate(waapiKeyframes, { duration: currentDesign.durationMs, easing: 'ease-out', fill: 'forwards' });
  animation.onfinish = () => sprite.remove();
}

playBtn.addEventListener('click', playPreview);

// Persistence - localStorage autosave + loading real designs
const AUTOSAVE_KEY = 'animation-lab-autosave-v1';

function autosave() {
  try {
    const all = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || '{}');
    all[abilitySelect.value] = currentDesign;
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(all));
  } catch {
    // localStorage may be unavailable (private browsing, quota) - editing
    // still works for the current session, just without the safety net.
  }
}

// Only the four single-target abilities' fetch path goes through here -
// Sweep's { default, overrides } shape is a different concern, handled by
// its own guard below, and never reaches validateDesign (which validates
// against the flat single-target shape).
async function loadDesignForAbility(abilityId) {
  try {
    const all = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || '{}');
    if (all[abilityId] && validateDesign(all[abilityId]).length === 0) {
      currentDesign = all[abilityId];
      return;
    }
  } catch {
    // fall through to loading from the real file below
  }
  const response = await fetch(`./designs/${abilityId}.json`);
  if (!response.ok) {
    exportStatus.textContent = `Could not load designs/${abilityId}.json: HTTP ${response.status}.`;
    return;
  }
  const design = await response.json();
  const errors = validateDesign(design);
  if (errors.length > 0) {
    exportStatus.textContent = `designs/${abilityId}.json failed validation: ${errors.join('; ')}`;
    return;
  }
  currentDesign = design;
}

abilitySelect.addEventListener('change', async () => {
  updateSweepGuard();
  if (abilitySelect.value === 'sweep') return;
  await loadDesignForAbility(abilitySelect.value);
  selectedKeyframeIndex = 0;
  pinnedToggle.checked = currentDesign.pinned;
  designDurationInput.value = currentDesign.durationMs;
  renderTimeline();
  selectKeyframe(0);
});

[kfOffsetInput, kfXInput, kfYInput, kfRotateInput, kfScaleInput, pinnedToggle, designDurationInput].forEach((input) => {
  input.addEventListener('input', autosave);
});
addKeyframeBtn.addEventListener('click', autosave);
removeKeyframeBtn.addEventListener('click', autosave);

// Export-related element lookups are declared here, ahead of the Sweep
// guard below, since updateSweepGuard() (invoked synchronously a few lines
// down) disables copyJsonBtn/copyCodeBtn and needs them already
// initialized - declaring them further down in the file's "Export" section
// would hit a temporal-dead-zone ReferenceError on that first call.
const chooseRepoBtn = document.getElementById('chooseRepoBtn');
const repoStatus = document.getElementById('repoStatus');
const exportBtn = document.getElementById('exportBtn');
const copyJsonBtn = document.getElementById('copyJsonBtn');
const copyCodeBtn = document.getElementById('copyCodeBtn');
const exportStatus = document.getElementById('exportStatus');
const exportOutput = document.getElementById('exportOutput');

// Sweep guard - Sweep's design shape ({ default, overrides }, no top-level
// keyframes/pinned per Task 3's sweep.json) doesn't fit this tool's flat
// keyframe-list editor yet, so the timeline/inspector are disabled with a
// notice instead of attempting to render/edit it. Also disables every
// button that would mutate/export "the current design" while Sweep is
// selected - without this, they'd silently act on the previously-loaded
// single-target ability's design instead.
function updateSweepGuard() {
  const isSweep = abilitySelect.value === 'sweep';
  timelineEl.style.display = isSweep ? 'none' : 'flex';
  document.getElementById('keyframeInspector').style.display = isSweep ? 'none' : 'flex';
  playBtn.disabled = isSweep;
  addKeyframeBtn.disabled = isSweep;
  removeKeyframeBtn.disabled = isSweep;
  copyJsonBtn.disabled = isSweep;
  copyCodeBtn.disabled = isSweep;
  let notice = document.getElementById('sweepNotice');
  if (isSweep && !notice) {
    notice = document.createElement('p');
    notice.id = 'sweepNotice';
    notice.style.fontSize = '12px';
    notice.style.color = '#e0a539';
    notice.textContent = 'Sweep profile editing (per-target-count leadIn/perWaypoint fields) isn\'t wired into this UI yet - edit tools/animation-lab/designs/sweep.json by hand for now.';
    timelineEl.after(notice);
  }
  if (notice) notice.style.display = isSweep ? 'block' : 'none';
}

updateSweepGuard();

if (abilitySelect.value !== 'sweep') {
  loadDesignForAbility(abilitySelect.value).then(() => {
    pinnedToggle.checked = currentDesign.pinned;
    designDurationInput.value = currentDesign.durationMs;
    renderTimeline();
    selectKeyframe(0);
  });
}

// Export - direct-to-disk via File System Access API + copy/paste fallback
let repoHandle = null;

chooseRepoBtn.addEventListener('click', async () => {
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    // Sanity check: this should be the repo root, not some other folder -
    // confirm it directly contains a 'js' directory before trusting it.
    // Mirrors tools/terrain-painter/painter.js's pickRepoDirectory().
    await handle.getDirectoryHandle('js');
    repoHandle = handle;
    repoStatus.textContent = `Writing to: ${repoHandle.name}`;
  } catch (err) {
    if (err.name !== 'AbortError') repoStatus.textContent = `Could not use that folder: ${err.message}`;
  }
});

async function writeFile(relativePath, contents) {
  const parts = relativePath.split('/');
  let dir = repoHandle;
  for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
  const fh = await dir.getFileHandle(parts[parts.length - 1], { create: true });
  const writable = await fh.createWritable();
  await writable.write(contents);
  await writable.close();
}

async function readFile(relativePath) {
  const parts = relativePath.split('/');
  let dir = repoHandle;
  for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
  const fh = await dir.getFileHandle(parts[parts.length - 1]);
  return (await fh.getFile()).text();
}

// swingKeyframesFor's Attack case is the switch's `default:` arm, not a
// literal `case 'attack':` (js/screens/battleScreen.js, see Task 4's own
// note on this) - the generated case-header text is swapped for that one
// ability only, the marker comments and everything else about the patch
// are identical to every other ability.
function keyframesCodeFor(abilityId, design) {
  const code = generateKeyframesCaseCode(abilityId, design);
  if (abilityId === 'attack') return code.replace(/^case 'attack':/, 'default:');
  return code;
}

async function exportToFiles() {
  const abilityId = abilitySelect.value;
  if (abilityId === 'sweep') {
    exportStatus.textContent = 'Sweep export not wired up yet - edit designs/sweep.json by hand.';
    return;
  }
  if (!repoHandle) {
    exportStatus.textContent = 'Choose a repo folder first.';
    return;
  }
  try {
    const errors = validateDesign(currentDesign);
    if (errors.length > 0) {
      exportStatus.textContent = `Cannot export - design is invalid: ${errors.join('; ')}`;
      return;
    }

    // Compute both the JSON and the patched battleScreen.js content in
    // memory FIRST, before writing anything to disk. If patchMarkedBlock
    // throws (e.g. a bad/missing marker), we bail out here with neither
    // file touched - writing the JSON before the patch was attempted would
    // otherwise leave the JSON and the shipped code out of sync if the
    // patch failed.
    const designJson = JSON.stringify(currentDesign, null, 2);
    let battleScreenText = await readFile('js/screens/battleScreen.js');
    battleScreenText = patchMarkedBlock(battleScreenText, `${abilityId}:KEYFRAMES`, keyframesCodeFor(abilityId, currentDesign));
    battleScreenText = patchMarkedBlock(battleScreenText, `${abilityId}:DURATION`, generateDurationEntryCode(abilityId, currentDesign));

    // Both computations succeeded - now write both files together.
    await writeFile(`tools/animation-lab/designs/${abilityId}.json`, designJson);
    await writeFile('js/screens/battleScreen.js', battleScreenText);

    exportStatus.textContent = `Exported ${abilityId} to designs/${abilityId}.json and battleScreen.js.`;
  } catch (err) {
    exportStatus.textContent = `Export failed: ${err.message}`;
  }
}

exportBtn.addEventListener('click', exportToFiles);

copyJsonBtn.addEventListener('click', async () => {
  const text = JSON.stringify(currentDesign, null, 2);
  exportOutput.value = text;
  try { await navigator.clipboard.writeText(text); exportStatus.textContent = 'JSON copied to clipboard.'; }
  catch { exportStatus.textContent = 'Clipboard blocked - copy from the box below.'; }
});

copyCodeBtn.addEventListener('click', async () => {
  const abilityId = abilitySelect.value;
  // Defensive: updateSweepGuard() already disables this button while Sweep
  // is selected, but guard here too in case that wiring ever changes -
  // Sweep uses SWEEP_PROFILES, not a switch case, so keyframesCodeFor's
  // `case '<id>': { ... }` output wouldn't correspond to any real code.
  if (abilityId === 'sweep') {
    exportStatus.textContent = 'Sweep export not wired up yet - edit designs/sweep.json by hand.';
    return;
  }
  const text = `${keyframesCodeFor(abilityId, currentDesign)}\n\n${generateDurationEntryCode(abilityId, currentDesign)}`;
  exportOutput.value = text;
  try { await navigator.clipboard.writeText(text); exportStatus.textContent = 'Generated code copied to clipboard.'; }
  catch { exportStatus.textContent = 'Clipboard blocked - copy from the box below.'; }
});

if (!window.showDirectoryPicker) {
  chooseRepoBtn.disabled = true;
  exportBtn.disabled = true;
  repoStatus.textContent = 'File System Access API unavailable in this browser (Firefox/Safari) - use Copy JSON / Copy generated code instead.';
}
