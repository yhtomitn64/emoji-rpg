// Shared per-IP rate limiter for functions/api/save/*, backed by the same
// SAVES KV namespace those routes already need (no extra provisioning).
//
// Raised 2026-09-09: with only a 4-char save code (36^4 ~= 1.68M
// combinations) as the sole credential on the device-code path, and no
// second secret (deliberately - Timothy wants the code short, not a long
// thing to remember), the only real defense against a script sweeping
// every possible code to overwrite/delete saves is throttling request
// volume. This isn't a hard security boundary (KV reads/writes aren't
// atomic, so a concurrent burst can slip a few requests past the count,
// and a distributed attacker with many IPs isn't slowed at all) - it's a
// deterrent sized for "keep a casual single-script sweep impractical,"
// matching this feature's own low-stakes threat model.
const DEFAULT_MAX_REQUESTS = 20;
const DEFAULT_WINDOW_SECONDS = 60;

export async function checkRateLimit(env, request, { max = DEFAULT_MAX_REQUESTS, windowSeconds = DEFAULT_WINDOW_SECONDS } = {}) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `ratelimit:${ip}`;
  const raw = await env.SAVES.get(key);
  const count = raw ? parseInt(raw, 10) : 0;
  if (count >= max) return false;
  await env.SAVES.put(key, String(count + 1), { expirationTtl: windowSeconds });
  return true;
}

export function rateLimitedResponse() {
  return new Response(JSON.stringify({ error: 'too many requests, slow down' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json' },
  });
}
