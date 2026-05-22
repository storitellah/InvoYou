/*
 * InvoYou — Service Worker
 *
 * Caches the app shell (HTML, manifest, icons) so the app loads instantly
 * on repeat visits and works offline. API requests (/api/*) are always
 * network-first since they're either user data or auth-sensitive.
 *
 * Strategy:
 *   - Navigation requests (HTML pages): cache-first with background revalidate.
 *     Means: instant launch even offline, with the latest version arriving
 *     in the background and ready on next launch.
 *   - Static assets (manifest, icons): cache-first.
 *   - /api/* requests: network-only, never cached.
 *   - Google Fonts: cache-first with long TTL (they're versioned URLs).
 *
 * Cache name is versioned. Bumping CACHE_VERSION on a new deploy purges
 * the old cache and forces a fresh fetch of the HTML.
 */

const CACHE_VERSION = 'invoyou-v6';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
  '/icons/favicon-64.png',
];

// ── INSTALL ──────────────────────────────────────────────
// Pre-cache the app shell so first offline launch works.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // addAll is atomic: if any file fails, none get cached. We don't want
      // that for optional assets like fonts, so we add the critical ones
      // individually and ignore failures.
      return Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) =>
            console.warn(`[sw] Failed to cache ${url}:`, err)
          )
        )
      );
    })
  );
  // Activate this SW immediately instead of waiting for all tabs to close
  self.skipWaiting();
});

// ── ACTIVATE ─────────────────────────────────────────────
// Delete old caches from previous versions.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION)
          .map((k) => caches.delete(k))
      )
    )
  );
  // Take control of all open clients (tabs) immediately
  self.clients.claim();
});

// ── FETCH ────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GETs — POST/PUT/DELETE go straight through (sync, support PUT, etc)
  if (req.method !== 'GET') return;

  // /api/* — never cache. Always go to network. Failures bubble up to the
  // app, which handles offline state in its own logic (sync queueing, etc.)
  if (url.pathname.startsWith('/api/')) {
    return; // let browser handle it normally
  }

  // /cdn-cgi/* — Cloudflare's edge endpoints (Access auth, etc). Never cache.
  if (url.pathname.startsWith('/cdn-cgi/')) {
    return;
  }

  // Navigation requests (top-level page loads): cache-first with background revalidate.
  // This is what makes the app launch instantly and work offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) => {
        const networkFetch = fetch(req)
          .then((networkRes) => {
            if (networkRes && networkRes.ok) {
              const copy = networkRes.clone();
              caches.open(CACHE_VERSION).then((c) => c.put('/index.html', copy));
            }
            return networkRes;
          })
          .catch(() => cached); // offline → fall back to cache
        return cached || networkFetch;
      })
    );
    return;
  }

  // Google Fonts (CSS + WOFF2): cache-first with long TTL.
  // URLs are content-hashed so they're effectively immutable.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(CACHE_VERSION + '-fonts').then((cache) =>
        cache.match(req).then((cached) =>
          cached ||
          fetch(req).then((networkRes) => {
            if (networkRes && networkRes.ok) cache.put(req, networkRes.clone());
            return networkRes;
          })
        )
      )
    );
    return;
  }

  // html2pdf CDN: same — cache-first since it's a versioned URL
  if (url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(
      caches.open(CACHE_VERSION + '-cdn').then((cache) =>
        cache.match(req).then((cached) =>
          cached ||
          fetch(req).then((networkRes) => {
            if (networkRes && networkRes.ok) cache.put(req, networkRes.clone());
            return networkRes;
          })
        )
      )
    );
    return;
  }

  // Same-origin static assets (icons, manifest): cache-first.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        return (
          cached ||
          fetch(req).then((networkRes) => {
            if (networkRes && networkRes.ok && networkRes.type === 'basic') {
              const copy = networkRes.clone();
              caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
            }
            return networkRes;
          })
        );
      })
    );
    return;
  }

  // Anything else: let the browser handle it normally
});

// ── MESSAGE: skip waiting ────────────────────────────────
// Lets the page request an immediate SW update after a redeploy.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
