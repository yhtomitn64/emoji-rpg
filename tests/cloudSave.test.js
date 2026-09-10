import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAVE_CODE_LENGTH,
  generateSaveCode,
  isValidSaveCode,
  startCodeTransfer,
  loadByCode,
} from '../js/systems/cloudSave.js';

function fakeFetch(handler) {
  const calls = [];
  const fn = async (url, options) => {
    calls.push({ url, options });
    return handler(url, options);
  };
  fn.calls = calls;
  return fn;
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('generateSaveCode is 4 lowercase letters/digits', () => {
  for (let i = 0; i < 50; i++) {
    const code = generateSaveCode();
    assert.equal(code.length, SAVE_CODE_LENGTH);
    assert.match(code, /^[a-z0-9]{4}$/);
  }
});

test('generateSaveCode is deterministic for a given random source', () => {
  let calls = 0;
  const fixedRandom = () => { calls++; return 0; };
  assert.equal(generateSaveCode(fixedRandom), 'aaaa');
  assert.equal(calls, 4);
});

test('isValidSaveCode accepts only 4 lowercase letters/digits', () => {
  assert.equal(isValidSaveCode('ab12'), true);
  assert.equal(isValidSaveCode('AB12'), false);
  assert.equal(isValidSaveCode('ab1'), false);
  assert.equal(isValidSaveCode('ab123'), false);
  assert.equal(isValidSaveCode('ab-1'), false);
  assert.equal(isValidSaveCode(null), false);
});

test('startCodeTransfer generates a fresh code, PUTs to it, and returns both', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse(200, { ok: true, expiresInSeconds: 60 }));
  const { code, ok } = await startCodeTransfer({ hello: 'world' }, { fetchImpl });
  assert.equal(isValidSaveCode(code), true);
  assert.equal(ok, true);
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(fetchImpl.calls[0].url, `/api/save/code/${code}`);
  assert.equal(fetchImpl.calls[0].options.method, 'PUT');
  assert.deepEqual(JSON.parse(fetchImpl.calls[0].options.body), { data: { hello: 'world' } });
});

test('startCodeTransfer reports failure without throwing when the server rejects it', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse(500, { error: 'boom' }));
  const { ok } = await startCodeTransfer({}, { fetchImpl });
  assert.equal(ok, false);
});

test('loadByCode returns the saved data on success', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse(200, { data: { level: 5 }, savedAt: 'now' }));
  const data = await loadByCode('ab12', { fetchImpl });
  assert.deepEqual(data, { level: 5 });
});

test('loadByCode returns null for a 404 (nothing saved under that code)', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse(404, { error: 'not found' }));
  const data = await loadByCode('ab12', { fetchImpl });
  assert.equal(data, null);
});

test('loadByCode throws on an unexpected server error', async () => {
  const fetchImpl = fakeFetch(() => jsonResponse(500, { error: 'boom' }));
  await assert.rejects(() => loadByCode('ab12', { fetchImpl }));
});
