// Small dev-only Node authoring server for the terrain painter. Built-in
// `http`/`fs` only, no new npm dependency. Serves the painter's static
// files and writes changes straight to disk, replacing the old
// `python3 -m http.server` + File System Access API flow (which needed
// Chrome/Edge and a manual "Choose Repo Folder" step every session).
//
// Never deployed - `.github/workflows/deploy.yml` stages an explicit
// allowlist of files/dirs into the live build, and `tools/` isn't on it.
//
// Run: `node tools/terrain-painter/server.js`, then open
// http://localhost:8000/tools/terrain-painter/index.html (or just
// http://localhost:8000/ - see serveStatic below).
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..', '..');

// A new dungeon's map id becomes both a MAPS registry key and a file's
// exported const name (see JS_IDENTIFIER_RE in painter.js, which already
// validates this client-side at dungeon-creation time) - re-validated here
// too since this server is what actually holds the write handle; never
// trust path fragments from a request body, client-side validation or not.
const JS_IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

// The real, fixed set of wilderness screen ids (mirrors painter.js's
// GRID_LAYOUT keys) - handlePatchWilderness only ever patches one of these
// 25 existing files, so a screenId outside this set is rejected outright
// rather than trusted straight into a file path (a value like
// '../dungeonMap' would otherwise resolve outside js/maps/wilderness/).
const SCREEN_IDS = new Set([
  'farNorthwest', 'northNorthwest', 'farNorth', 'northNortheast', 'farNortheast',
  'westNorthwest', 'northwest', 'north', 'northeast', 'eastNortheast',
  'farWest', 'west', 'center', 'east', 'farEast',
  'westSouthwest', 'southwest', 'south', 'southeast', 'eastSoutheast',
  'farSouthwest', 'southSouthwest', 'farSouth', 'southSoutheast', 'farSoutheast',
]);

// superBossId is data-driven (not a fixed small set like SCREEN_IDS above),
// so it can't be validated against a static allowlist the same way - escaped
// before use in a RegExp instead (below) so it can only ever match a literal
// entry, never be interpreted as regex syntax.
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// --- Ported verbatim from painter.js's client-side patch functions -----
// (same pure string transforms - only readFileText/writeFileText, the
// browser-only File System Access calls, are swapped for Node's
// fs.readFile/fs.writeFile at the call sites below.)
function patchLegendRows(originalText, newLegendRowsText, fileLabel) {
  const legendRe = /const LEGEND = \{[\s\S]*?\};/;
  const rowsRe = /const ROWS = \[[\s\S]*?\];/;
  const legendMatch = originalText.match(legendRe);
  const rowsMatch = originalText.match(rowsRe);
  if (!legendMatch || !rowsMatch) throw new Error(`${fileLabel}: could not find LEGEND/ROWS block`);
  if (rowsMatch.index <= legendMatch.index) throw new Error(`${fileLabel}: ROWS appears before LEGEND - unexpected file shape, aborting`);
  if (!/'.+',/.test(rowsMatch[0])) throw new Error(`${fileLabel}: ROWS block doesn't look like row strings - aborting`);
  const newLegendText = newLegendRowsText.match(legendRe)[0];
  const newRowsText = newLegendRowsText.match(rowsRe)[0];
  return originalText.replace(legendRe, newLegendText).replace(rowsRe, newRowsText);
}

// Ported for parity with painter.js's own patch functions (Step 1 of this
// task's brief) - not wired to an HTTP route below, since the dungeon
// entrance and all four tool dungeon entrances are already placed and
// stable on this branch (see js/state.js / js/data/toolDungeons.js history).
// The old File System Access "Choose Repo Folder" + "Export All" flow
// remains available client-side for the rare case either needs to move
// again.
function patchDungeonEntrancePosition(originalText, pos) {
  const re = /export const DEFAULT_DUNGEON_ENTRANCE_POSITION = \{[^}]*\};/;
  if (!re.test(originalText)) throw new Error('state.js: could not find DEFAULT_DUNGEON_ENTRANCE_POSITION');
  return originalText.replace(re, `export const DEFAULT_DUNGEON_ENTRANCE_POSITION = { screenId: '${pos.screenId}', x: ${pos.x}, y: ${pos.y} };`);
}

// Also ported for parity (see patchDungeonEntrancePosition's comment above)
// and as the exact pattern patchSuperBossEntry below mirrors.
function patchToolDungeonEntrance(originalText, toolId, pos) {
  const blockRe = new RegExp(`${toolId}: \\{[^}]*\\}`);
  const match = originalText.match(blockRe);
  if (!match) throw new Error(`toolDungeons.js: could not find '${toolId}' entry`);
  const mapIdMatch = match[0].match(/mapId: '([^']*)'/);
  const tileKindMatch = match[0].match(/tileKind: '([^']*)'/);
  if (!mapIdMatch || !tileKindMatch) throw new Error(`toolDungeons.js: '${toolId}' entry missing mapId/tileKind`);
  const newBlock = `${toolId}: {\n    screenId: '${pos.screenId}', x: ${pos.x}, y: ${pos.y}, mapId: '${mapIdMatch[1]}', tileKind: '${tileKindMatch[1]}',\n  }`;
  return originalText.replace(blockRe, newBlock);
}

// New: mirrors patchToolDungeonEntrance's exact shape for SUPER_BOSSES'
// slightly wider entry ({ id, monsterId, screenId, x, y, hasDungeon,
// dungeonMapId }). Like patchToolDungeonEntrance preserves mapId/tileKind
// straight off disk rather than trusting the client for them, this
// preserves monsterId AND dungeonMapId off disk - the painter's client-side
// superBossMarkers only ever track screenId/x/y/hasDungeon (see
// painter.js's init()), never a superboss's permanent monsterId or its
// dungeon file link, so those two fields must survive untouched here.
// dungeonMapId is written unquoted (bare `null`) when there's no dungeon
// yet, quoted when there is - matching SUPER_BOSSES' own doc comment.
function patchSuperBossEntry(originalText, superBossId, entry) {
  const blockRe = new RegExp(`${escapeRegExp(superBossId)}: \\{[^}]*\\}`);
  const match = originalText.match(blockRe);
  if (!match) throw new Error(`superBosses.js: could not find '${superBossId}' entry`);
  const monsterIdMatch = match[0].match(/monsterId: '([^']*)'/);
  const dungeonMapIdMatch = match[0].match(/dungeonMapId: (null|'[^']*')/);
  if (!monsterIdMatch || !dungeonMapIdMatch) throw new Error(`superBosses.js: '${superBossId}' entry missing monsterId/dungeonMapId`);
  const screenIdText = entry.screenId === null || entry.screenId === undefined ? 'null' : `'${entry.screenId}'`;
  const newBlock = `${superBossId}: {\n    id: '${superBossId}', monsterId: '${monsterIdMatch[1]}', screenId: ${screenIdText}, x: ${entry.x}, y: ${entry.y}, hasDungeon: ${entry.hasDungeon}, dungeonMapId: ${dungeonMapIdMatch[1]},\n  }`;
  return originalText.replace(blockRe, newBlock);
}

// --- Static file serving -------------------------------------------------
// Rooted at the repo root, not this directory - painter.js's own init()
// does `import('../../js/state.js')` etc. (dynamic ES module imports,
// resolved and fetched by the browser as ordinary URLs off painter.js's
// own location), so anything under js/ has to be reachable too, not just
// tools/terrain-painter/ itself. "/" is special-cased to the painter's
// own page for convenience.
const STATIC_ROOT = REPO_ROOT;
const MIME_TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

async function serveStatic(req, res) {
  const urlPath = req.url === '/' ? '/tools/terrain-painter/index.html' : req.url.split('?')[0];
  // req.url is attacker-controlled (this server binds to every interface,
  // not just loopback - see server.listen below) - join() alone happily
  // resolves a `..`-bearing path outside STATIC_ROOT (e.g.
  // `/../../../../etc/passwd`), so the resolved path is checked against
  // STATIC_ROOT's own prefix before ever reaching readFile.
  const resolved = resolve(STATIC_ROOT, '.' + urlPath);
  if (resolved !== STATIC_ROOT && !resolved.startsWith(STATIC_ROOT + sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  try {
    const content = await readFile(resolved);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[extname(resolved)] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}

// --- API endpoints ---------------------------------------------------------

async function handlePatchWilderness(req, res) {
  const { screenId, legendRowsText } = await readJsonBody(req);
  if (!SCREEN_IDS.has(screenId)) throw new Error(`Unknown wilderness screenId: '${screenId}'`);
  const filePath = join(REPO_ROOT, 'js', 'maps', 'wilderness', `${screenId}.js`);
  const originalText = await readFile(filePath, 'utf8');
  const patched = patchLegendRows(originalText, legendRowsText, filePath);
  if (patched !== originalText) await writeFile(filePath, patched);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ changed: patched !== originalText }));
}

async function handlePatchSuperBoss(req, res) {
  const { superBossId, entry } = await readJsonBody(req);
  const filePath = join(REPO_ROOT, 'js', 'data', 'superBosses.js');
  const originalText = await readFile(filePath, 'utf8');
  const patched = patchSuperBossEntry(originalText, superBossId, entry);
  if (patched !== originalText) await writeFile(filePath, patched);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ changed: patched !== originalText }));
}

// Creates a brand-new dungeon map file (New Dungeon mode's save action)
// AND inserts its import + MAPS registry entry into main.js - the one
// thing the old "patch a known block in an existing file" approach could
// never do at all, since there was no existing file/block to patch.
async function handleCreateDungeon(req, res) {
  const { mapId, legendRowsText, startX, startY, guardianMonsterId } = await readJsonBody(req);
  if (!JS_IDENTIFIER_RE.test(mapId)) throw new Error(`'${mapId}' isn't a legal JS identifier - refusing to use it as a file/registry name`);

  const mainPath = join(REPO_ROOT, 'js', 'main.js');
  let mainText = await readFile(mainPath, 'utf8');
  const importLine = `import { ${mapId}Map } from './maps/superBosses/${mapId}.js';`;
  const alreadyRegisteredByUs = mainText.includes(importLine);
  // A mapId that collides with an unrelated real MAPS key (e.g. naming a
  // new dungeon 'north') would otherwise produce a second `${mapId}Map`
  // binding from a different import path - a SyntaxError that breaks the
  // whole game until hand-fixed. Re-saving a dungeon this same flow already
  // created is fine (that's `alreadyRegisteredByUs`, which skips the
  // main.js write entirely below) - only a foreign binding is rejected.
  if (!alreadyRegisteredByUs && new RegExp(`\\b${escapeRegExp(mapId)}Map\\b`).test(mainText)) {
    throw new Error(`main.js already has a '${mapId}Map' binding from a different import - choose a different mapId.`);
  }

  const dirPath = join(REPO_ROOT, 'js', 'maps', 'superBosses');
  const filePath = join(dirPath, `${mapId}.js`);
  await mkdir(dirPath, { recursive: true });
  const fileContent = `${legendRowsText}\n\nexport const ${mapId}Map = {\n  id: '${mapId}',\n  legend: LEGEND,\n  rows: ROWS,\n  startPosition: { x: ${startX}, y: ${startY} },\n  encounterChance: 0,\n  cacheChance: 0,\n  monsterTable: [],\n  guardianMonsterId: '${guardianMonsterId}',\n};\n`;
  await writeFile(filePath, fileContent);

  if (!alreadyRegisteredByUs) {
    // Insert the import right before `const MAPS = {`, and the registry
    // entry right after its opening brace - matches this file's existing
    // ordering closely enough (every tool dungeon is imported just above
    // its own MAPS entry) without trying to re-sort the whole import list.
    // Each replace is asserted to have actually changed the text - if
    // 'const MAPS = {' were ever not found, a silent no-op here would still
    // report {created: true} while main.js never actually registered the
    // map.
    const withImport = mainText.replace('const MAPS = {', `${importLine}\nconst MAPS = {`);
    if (withImport === mainText) throw new Error(`main.js: could not find 'const MAPS = {' to insert the import`);
    const withRegistryEntry = withImport.replace('const MAPS = {', `const MAPS = {\n  ${mapId}: ${mapId}Map,`);
    if (withRegistryEntry === withImport) throw new Error(`main.js: could not find 'const MAPS = {' to insert the registry entry`);
    await writeFile(mainPath, withRegistryEntry);
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ created: true }));
}

const server = createServer(async (req, res) => {
  try {
    // Lets the painter's feature-detect (a same-origin OPTIONS preflight
    // against /api/patch-wilderness) distinguish "this server is running"
    // from "no server, or a plain static server with no /api/* routes" -
    // without this, an OPTIONS request would fall through to serveStatic
    // and 404 like any other missing file, and the feature-detect could
    // never tell the two cases apart.
    if (req.method === 'OPTIONS' && req.url.startsWith('/api/')) {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === 'POST' && req.url === '/api/patch-wilderness') return await handlePatchWilderness(req, res);
    if (req.method === 'POST' && req.url === '/api/patch-superboss') return await handlePatchSuperBoss(req, res);
    if (req.method === 'POST' && req.url === '/api/create-dungeon') return await handleCreateDungeon(req, res);
    return await serveStatic(req, res);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

const PORT = 8000;
const HOST = '127.0.0.1'; // loopback only - this server writes straight to repo files on request, never expose it beyond localhost
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use - is another instance of this server (or an old \`python3 -m http.server ${PORT}\`) already running? Stop that process first.`);
    process.exit(1);
  }
  throw err;
});
server.listen(PORT, HOST, () => {
  console.log(`Terrain painter authoring server running at http://localhost:${PORT}/`);
  console.log('Open http://localhost:8000/tools/terrain-painter/index.html');
});
