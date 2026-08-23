let rootEl = null;
let callbacks = null;
let warpCost = 0;
let canAffordWarp = false;
let canWarpToDungeon = false;

export function mount(root, props) {
  rootEl = root;
  callbacks = props.callbacks;
  warpCost = props.warpCost;
  canAffordWarp = props.canAffordWarp;
  canWarpToDungeon = props.canWarpToDungeon;

  rootEl.innerHTML = `
    <div class="overlay-panel">
      <h2>Where to?</h2>
      <button id="btn-travel-town">Return to Town</button>
      ${canWarpToDungeon
        ? `<button id="btn-travel-dungeon" ${canAffordWarp ? '' : 'disabled'}>Warp to Dungeon Entrance (${warpCost}g)</button>`
        : ''}
    </div>
  `;

  document.getElementById('btn-travel-town').onclick = () => callbacks.onReturnToTown();
  const dungeonBtn = document.getElementById('btn-travel-dungeon');
  if (dungeonBtn) dungeonBtn.onclick = () => callbacks.onWarpToDungeon();
  document.getElementById('btn-travel-town').focus();
}

export function unmount() {}
