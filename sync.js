// InvoYou cloud-sync API — Cloudflare Pages Function
// Routes:
//   GET    /api/sync   → return the saved state blob for the sync key (or {state:null} if empty)
//   PUT    /api/sync   → save the state blob keyed by the sync key
//   DELETE /api/sync   → remove the cloud copy
//
// Auth: a single header `X-Sync-Key` containing the user's sync key.
// The KV namespace must be bound as `INVOYOU_KV` in the Pages project's
// Settings → Bindings.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Key',
  'Access-Control-Max-Age': '86400',
};
const JSON_TYPE = { 'Content-Type': 'application/json' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_TYPE, ...CORS },
  });
}

const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5MB — well under KV's 25MB cap

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (!env.INVOYOU_KV) {
    return json({
      error: 'KV namespace not bound. In the Cloudflare dashboard, bind a KV namespace as INVOYOU_KV under Pages → Settings → Bindings, then redeploy.'
    }, 500);
  }

  // Auth: simple shared-secret header. Anyone with the key can read/write the user's blob.
  const key = request.headers.get('X-Sync-Key');
  if (!key)                                     return json({ error: 'Missing X-Sync-Key header' }, 401);
  if (key.length < 16 || key.length > 200)      return json({ error: 'Sync key must be 16-200 characters' }, 400);
  if (!/^[a-zA-Z0-9._-]+$/.test(key))           return json({ error: 'Sync key may only contain letters, digits, dot, dash, underscore' }, 400);

  const storageKey = 'state:' + key;

  try {
    if (request.method === 'GET') {
      const data = await env.INVOYOU_KV.get(storageKey);
      if (!data) return json({ state: null, updatedAt: null });
      // Pass through stored JSON verbatim, with CORS headers
      return new Response(data, { headers: { ...JSON_TYPE, ...CORS } });
    }

    if (request.method === 'PUT') {
      const body = await request.text();
      if (body.length > MAX_PAYLOAD_BYTES) {
        return json({ error: 'Payload too large (limit 5MB)' }, 413);
      }
      // Validate it's JSON shaped like {state, updatedAt}
      let parsed;
      try { parsed = JSON.parse(body); }
      catch { return json({ error: 'Body must be JSON' }, 400); }
      if (!parsed || typeof parsed !== 'object' || !('state' in parsed)) {
        return json({ error: 'Body must be { state, updatedAt }' }, 400);
      }
      await env.INVOYOU_KV.put(storageKey, body);
      return json({ ok: true, savedAt: Date.now() });
    }

    if (request.method === 'DELETE') {
      await env.INVOYOU_KV.delete(storageKey);
      return json({ ok: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (e) {
    return json({ error: 'Internal error: ' + (e && e.message ? e.message : 'unknown') }, 500);
  }
}
