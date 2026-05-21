// InvoYou — /api/whoami
// Returns the identity of the user as established by Cloudflare Access.
//
// When this site is protected by Cloudflare Access (Zero Trust), Cloudflare
// injects an HTTP header `Cf-Access-Authenticated-User-Email` on every request
// containing the email of the signed-in user. We surface that to the browser
// so the client can decide whether to show creator-only UI.
//
// If the site is NOT behind Cloudflare Access (e.g. fresh deploy, local dev),
// the header is absent and we return null. The client treats that as "anonymous
// visitor" and hides the creator-only UI.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};
const JSON_TYPE = { 'Content-Type': 'application/json' };

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...JSON_TYPE, ...CORS }
    });
  }

  const email = request.headers.get('Cf-Access-Authenticated-User-Email') || '';

  return new Response(JSON.stringify({
    email: email.toLowerCase() || null,
    authenticated: !!email
  }), { status: 200, headers: { ...JSON_TYPE, ...CORS } });
}
