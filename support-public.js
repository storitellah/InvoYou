// InvoYou — /api/support-public
// PUBLIC, read-only endpoint that returns the currently-published support links.
// Visitors' browsers call this on every page load to render the support buttons
// in the sidebar. No auth required — this is meant to be public information.
//
// The matching write endpoint is /api/support, which IS behind Cloudflare Access
// and rejects writes from anyone who isn't a creator.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=60',  // 1-min edge cache; new support links propagate within a minute
};
const JSON_TYPE = { 'Content-Type': 'application/json' };

const STORAGE_KEY = 'creator:support';

const DEFAULTS = {
  show: false,
  bmac: '',
  patreon: '',
  generic: '',
  genericLabel: 'Support the project'
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_TYPE, ...CORS },
  });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed (this endpoint is read-only; use /api/support to write)' }, 405);
  }

  if (!env.INVOYOU_KV) {
    return json({ ...DEFAULTS });  // graceful fallback if KV not bound
  }

  try {
    const raw = await env.INVOYOU_KV.get(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return json({ ...DEFAULTS, ...(data || {}) });
  } catch (e) {
    return json({ ...DEFAULTS });
  }
}
