// InvoYou — /api/support (PUT only — CREATOR ONLY)
// This endpoint sits behind Cloudflare Access. Only the creator can reach it.
// Public reads go to /api/support-public instead.
//
// Authorization: Cloudflare Access verifies the user via Google OAuth and
// injects `Cf-Access-Authenticated-User-Email` on every authenticated request.
// We still double-check the email is in CREATOR_EMAILS as a defense-in-depth
// measure — even if someone bypasses or misconfigures Access, the write fails
// unless the email matches.

const CREATOR_EMAILS = [
  'bryanjaybee@gmail.com'
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};
const JSON_TYPE = { 'Content-Type': 'application/json' };

const STORAGE_KEY = 'creator:support';
const MAX_FIELD_LEN = 500;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_TYPE, ...CORS },
  });
}

function getCreatorEmail(request) {
  const email = (request.headers.get('Cf-Access-Authenticated-User-Email') || '').toLowerCase().trim();
  if (!email) return null;
  return CREATOR_EMAILS.map(e => e.toLowerCase()).includes(email) ? email : null;
}

function sanitizeUrl(s) {
  s = String(s || '').trim();
  if (!s) return '';
  if (s.length > MAX_FIELD_LEN) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.toString();
  } catch {
    return '';
  }
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (!env.INVOYOU_KV) {
    return json({
      error: 'KV namespace not bound. Bind INVOYOU_KV in Pages → Settings → Bindings.'
    }, 500);
  }

  if (request.method !== 'PUT') {
    return json({ error: 'Method not allowed (use GET /api/support-public to read)' }, 405);
  }

  const creatorEmail = getCreatorEmail(request);
  if (!creatorEmail) {
    return json({
      error: 'Forbidden. Cloudflare Access must be configured to protect this path with a Google login policy that includes your email. See README → Creator-only Dashboard.'
    }, 403);
  }

  try {
    const body = await request.text();
    if (body.length > 10_000) return json({ error: 'Payload too large' }, 413);

    let parsed;
    try { parsed = JSON.parse(body); }
    catch { return json({ error: 'Body must be JSON' }, 400); }

    if (!parsed || typeof parsed !== 'object') {
      return json({ error: 'Body must be a JSON object' }, 400);
    }

    const clean = {
      show: parsed.show === true,
      bmac: sanitizeUrl(parsed.bmac),
      kofi: sanitizeUrl(parsed.kofi),
      patreon: sanitizeUrl(parsed.patreon),
      generic: sanitizeUrl(parsed.generic),
      genericLabel: String(parsed.genericLabel || 'Support the project').trim().slice(0, 80) || 'Support the project'
    };

    await env.INVOYOU_KV.put(STORAGE_KEY, JSON.stringify({
      ...clean,
      updatedAt: Date.now(),
      updatedBy: creatorEmail
    }));

    return json({ ok: true, savedAt: Date.now(), config: clean });
  } catch (e) {
    return json({ error: 'Internal error: ' + (e && e.message ? e.message : 'unknown') }, 500);
  }
}
