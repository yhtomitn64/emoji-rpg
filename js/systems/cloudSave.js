// Cross-device save sync: move a save from one computer to another without
// copy/pasting JSON by hand, via a short-lived transfer code. Lands in
// Cloudflare Workers KV (see functions/api/save/code/) - a KV namespace
// must be created and bound (wrangler.toml) before this works live; see
// docs/superpowers/BACKLOG.md's Cross-device save sync section for the
// setup checklist. Gated behind the cloudSaveBeta settings flag until then.
//
// A Google-account-based option was scaffolded (Sign in with Google,
// verified server-side) and then deliberately pulled 2026-09-09 before
// shipping - Timothy: "I think we can remove the google thing for now as
// well... don't want to load google stuff if we don't need to at this
// point." Nothing here loads any Google script or calls any Google
// endpoint. See the backlog entry for the removed design if it's ever
// wanted back.

// Deliberately short and low-security - Timothy: "I don't think security on
// this particular thing needs to be real tight if using the code method."
// Plain lowercase letters + digits (36 options), no exclusion of
// visually-similar characters (0/o, 1/l) - matches what was asked for
// exactly rather than second-guessing it. The real protection against
// brute-forcing this small a keyspace isn't the alphabet - it's that a code
// only exists for CODE_TRANSFER_TTL_SECONDS after startCodeTransfer (raised
// 2026-09-09: "only have a really short window to transfer over... That in
// addition to the timeout should make it pretty solid"), enforced
// server-side via KV's own expirationTtl (functions/api/save/code/[code].js)
// - this constant is display-only (the countdown UI), not itself enforcing
// anything.
const CODE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
export const SAVE_CODE_LENGTH = 4;
export const CODE_TRANSFER_TTL_SECONDS = 60;

export function generateSaveCode(random = Math.random) {
  let code = '';
  for (let i = 0; i < SAVE_CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return code;
}

export function isValidSaveCode(code) {
  return typeof code === 'string' && new RegExp(`^[a-z0-9]{${SAVE_CODE_LENGTH}}$`).test(code);
}

const codeSaveUrl = (code) => `/api/save/code/${code}`;

async function saveByCode(code, data, { fetchImpl = globalThis.fetch } = {}) {
  if (!isValidSaveCode(code)) throw new Error(`Invalid save code: ${code}`);
  const response = await fetchImpl(codeSaveUrl(code), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  return response.ok;
}

// Generates a fresh one-shot code, saves under it, and returns it for
// display with a countdown - this is the only way to write to the code
// path (no standing/reusable device code) so a save is never live for
// longer than the transfer window.
export async function startCodeTransfer(data, { fetchImpl = globalThis.fetch } = {}) {
  const code = generateSaveCode();
  const ok = await saveByCode(code, data, { fetchImpl });
  return { code, ok };
}

// Returns the saved data, or null if the code has nothing live under it
// right now (never used, a typo, or its transfer window already expired) -
// callers should treat null as "not found," not as an error.
export async function loadByCode(code, { fetchImpl = globalThis.fetch } = {}) {
  if (!isValidSaveCode(code)) throw new Error(`Invalid save code: ${code}`);
  const response = await fetchImpl(codeSaveUrl(code));
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Cloud load failed: ${response.status}`);
  const body = await response.json();
  return body.data ?? null;
}
