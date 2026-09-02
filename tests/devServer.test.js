import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendTelemetryEvents, resolveStaticFilePath } from '../tools/dev-server.mjs';

function tempAnalyticsPaths() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emoji-rpg-telemetry-'));
  return { analyticsDir: dir, analyticsFile: path.join(dir, 'events.jsonl') };
}

test('appendTelemetryEvents writes one JSON line per event, creating the directory if missing', () => {
  const { analyticsDir, analyticsFile } = tempAnalyticsPaths();
  fs.rmSync(analyticsDir, { recursive: true, force: true }); // exercise the mkdirSync path
  const body = JSON.stringify({ events: [{ type: 'level_up', level: 2 }, { type: 'level_up', level: 3 }] });
  const result = appendTelemetryEvents(body, { analyticsFile, analyticsDir });
  assert.equal(result.ok, true);
  assert.equal(result.count, 2);
  const lines = fs.readFileSync(analyticsFile, 'utf8').trim().split('\n');
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).level, 2);
  assert.equal(JSON.parse(lines[1]).level, 3);
});

test('appendTelemetryEvents appends to an existing file rather than overwriting it', () => {
  const { analyticsDir, analyticsFile } = tempAnalyticsPaths();
  appendTelemetryEvents(JSON.stringify({ events: [{ type: 'a' }] }), { analyticsFile, analyticsDir });
  appendTelemetryEvents(JSON.stringify({ events: [{ type: 'b' }] }), { analyticsFile, analyticsDir });
  const lines = fs.readFileSync(analyticsFile, 'utf8').trim().split('\n');
  assert.equal(lines.length, 2);
});

test('appendTelemetryEvents rejects malformed JSON without throwing', () => {
  const { analyticsDir, analyticsFile } = tempAnalyticsPaths();
  const result = appendTelemetryEvents('not json', { analyticsFile, analyticsDir });
  assert.equal(result.ok, false);
});

test('appendTelemetryEvents rejects a body with no events array', () => {
  const { analyticsDir, analyticsFile } = tempAnalyticsPaths();
  const result = appendTelemetryEvents(JSON.stringify({ notEvents: [] }), { analyticsFile, analyticsDir });
  assert.equal(result.ok, false);
});

test('resolveStaticFilePath maps / to /index.html under the given root', () => {
  const resolved = resolveStaticFilePath('/', '/repo/root');
  assert.equal(resolved, path.normalize('/repo/root/index.html'));
});

test('resolveStaticFilePath blocks path traversal outside the root', () => {
  const resolved = resolveStaticFilePath('/../../etc/passwd', '/repo/root');
  assert.equal(resolved, null);
});

test('resolveStaticFilePath blocks path traversal via sibling directory name collision', () => {
  const resolved = resolveStaticFilePath('/../root-evil/secret.txt', '/repo/root');
  assert.equal(resolved, null);
});

test('resolveStaticFilePath returns null (not a throw) for a malformed percent-escape', () => {
  assert.equal(resolveStaticFilePath('/%', '/repo/root'), null);
  assert.equal(resolveStaticFilePath('/%zz', '/repo/root'), null);
});

test('appendTelemetryEvents rejects a bare JSON null without crashing', () => {
  const { analyticsDir, analyticsFile } = tempAnalyticsPaths();
  const result = appendTelemetryEvents('null', { analyticsFile, analyticsDir });
  assert.equal(result.ok, false);
});
