let rootEl = null;
let callbacks = null;
let warpCost = 0;
let canAffordWarp = false;

export function mount(root, props) {
  rootEl = root;
  callbacks = props.callbacks;
  warpCost = props.warpCost;
  canAffordWarp = props.canAffordWarp;

  rootEl.innerHTML = `
    <div class="overlay-panel">
      <h2>Where to?</h2>
      <button id="btn-travel-town">Return to Town</button>
      <button id="btn-travel-dungeon" ${canAffordWarp ? '' : 'disabled'}>Warp to Dungeon Entrance (${warpCost}g)</button>
    </div>
  `;

  document.getElementById('btn-travel-town').onclick = () => callbacks.onReturnToTown();
  document.getElementById('btn-travel-dungeon').onclick = () => callbacks.onWarpToDungeon();
  document.getElementById('btn-travel-town').focus();
}

export function unmount() {}
