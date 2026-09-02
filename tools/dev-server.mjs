import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANALYTICS_DIR = path.join(ROOT_DIR, 'analytics');
const ANALYTICS_FILE = path.join(ANALYTICS_DIR, 'events.jsonl');
const DEFAULT_PORT = 8000;

const MIME_TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

export function appendTelemetryEvents(body, { analyticsFile = ANALYTICS_FILE, analyticsDir = ANALYTICS_DIR } = {}) {
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, error: 'Invalid JSON body' };
  }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.events)) {
    return { ok: false, error: 'Missing events array' };
  }
  fs.mkdirSync(analyticsDir, { recursive: true });
  const lines = parsed.events.map((event) => JSON.stringify(event)).join('\n');
  fs.appendFileSync(analyticsFile, lines ? `${lines}\n` : '');
  return { ok: true, count: parsed.events.length };
}

export function resolveStaticFilePath(requestUrl, rootDir = ROOT_DIR) {
  const urlPath = requestUrl.split('?')[0];
  let relativePath;
  try {
    relativePath = urlPath === '/' ? '/index.html' : decodeURIComponent(urlPath);
  } catch {
    return null; // malformed percent-escape - treat as not found, don't crash
  }
  const resolved = path.normalize(path.join(rootDir, relativePath));
  if (resolved !== rootDir && !resolved.startsWith(rootDir + path.sep)) return null; // blocks path traversal (../)
  return resolved;
}

export function createDevServer({ rootDir = ROOT_DIR, analyticsFile = ANALYTICS_FILE, analyticsDir = ANALYTICS_DIR } = {}) {
  return http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/__telemetry') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        const result = appendTelemetryEvents(body, { analyticsFile, analyticsDir });
        res.writeHead(result.ok ? 204 : 400, { 'Content-Type': 'application/json' });
        res.end(result.ok ? '' : JSON.stringify({ error: result.error }));
      });
      return;
    }

    const filePath = resolveStaticFilePath(req.url, rootDir);
    if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2]) || DEFAULT_PORT;
  createDevServer().listen(port, () => {
    console.log(`Serving ${ROOT_DIR} at http://localhost:${port} (POST /__telemetry appends to analytics/events.jsonl)`);
  });
}
