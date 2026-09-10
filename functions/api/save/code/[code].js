// Cloudflare Pages Function: GET/PUT /api/save/code/:code
//
// Device-code cloud save - no auth, deliberately low-security (Timothy:
// "I don't think security on this particular thing needs to be real tight
// if using the code method"). Anyone who knows the 4-char code can read or
// overwrite that save while it's live. Backed by the SAVES KV namespace
// binding - must be created and bound in the Cloudflare Pages dashboard (or
// wrangler.toml) before this works; see docs/superpowers/BACKLOG.md's
// Cross-device save sync section.
//
// Raised 2026-09-09, in addition to the rate limiter: a code is only ever
// live for CODE_TTL_SECONDS after a PUT, via KV's own expirationTtl - the
// key is gone (GET 404s) after that, no matter whether it was ever read.
// This turns "save on one computer, load on another" into a narrow one-shot
// transfer window rather than a standing, indefinitely-guessable address -
// 60s is also Cloudflare KV's own enforced *minimum* TTL, so it's a hard
// floor, not just a chosen default. Keep in sync with
// js/systems/cloudSave.js's own CODE_TRANSFER_TTL_SECONDS (client-side is
// display-only - this is the value that's actually enforced).
import { checkRateLimit, rateLimitedResponse } from '../../../_shared/rateLimit.js';

const CODE_PATTERN = /^[a-z0-9]{4}$/;
const CODE_TTL_SECONDS = 60;
const MAX_BODY_BYTES = 200_000; // generous for a character save's JSON, small enough to block abuse

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestGet({ params, env, request }) {
  if (!(await checkRateLimit(env, request))) return rateLimitedResponse();
  if (!CODE_PATTERN.test(params.code)) return jsonResponse({ error: 'invalid code' }, 400);
  const raw = await env.SAVES.get(`code:${params.code}`);
  if (raw === null) return jsonResponse({ error: 'not found' }, 404);
  return new Response(raw, { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPut({ params, env, request }) {
  if (!(await checkRateLimit(env, request))) return rateLimitedResponse();
  if (!CODE_PATTERN.test(params.code)) return jsonResponse({ error: 'invalid code' }, 400);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return jsonResponse({ error: 'save too large' }, 413);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return jsonResponse({ error: 'invalid JSON' }, 400);
  }
  if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) {
    return jsonResponse({ error: 'expected { data }' }, 400);
  }
  await env.SAVES.put(
    `code:${params.code}`,
    JSON.stringify({ data: parsed.data, savedAt: new Date().toISOString() }),
    { expirationTtl: CODE_TTL_SECONDS },
  );
  return jsonResponse({ ok: true, expiresInSeconds: CODE_TTL_SECONDS });
}
