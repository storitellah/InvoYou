# InvoYou — Cloudflare Pages deployment with cloud sync

This bundle gets InvoYou online on Cloudflare Pages with optional cross-device sync. Everything lives in one Cloudflare project: the static HTML is served by Pages, the sync API is a Pages Function, and your data sits in Cloudflare KV. All on the free tier.

If you don't care about syncing between devices, you can also just upload the single `index.html` file and ignore the rest.

## What you need

- A free Cloudflare account (sign up at [https://dash.cloudflare.com](https://dash.cloudflare.com) — no card needed).  
- About 10 minutes.

## Folder structure to upload

Before uploading, arrange the files in this exact shape on your computer:

invoyou/

├── index.html                   ← the InvoYou app (renamed from InvoYou.html)

├── wrangler.toml                ← optional config, can be left in place

└── functions/

    └── api/

        └── sync.js              ← the sync API

The `functions/` folder is what tells Cloudflare to treat `sync.js` as an API endpoint at `/api/sync`. The path is structural — don't rename the folders.

## Step 1 — Create the KV namespace

This is where your synced data will live.

1. In the Cloudflare dashboard, go to **Storage & Databases → KV** (left sidebar).  
2. Click **Create instance**.  
3. Name it `invoyou-data` (or anything you like — the name is just for you).  
4. Click **Add**.

You don't need to add any keys — the sync function writes them automatically.

## Step 2 — Create the Pages project & upload

1. In the dashboard, go to **Workers & Pages → Create → Pages → Upload assets**.  
2. Project name: `invoyou` (this becomes part of your URL, e.g. `invoyou.pages.dev`).  
3. Click **Upload assets**, then drag the **entire `invoyou/` folder** (the one containing `index.html` and `functions/`). Cloudflare picks up the file structure automatically.  
4. Click **Deploy site**. After \~30 seconds you'll get a live URL.

At this point the app loads but cloud sync won't work yet — KV isn't bound.

## Step 3 — Bind the KV namespace to your Pages project

1. In the Cloudflare dashboard, open your `invoyou` Pages project.  
2. Go to **Settings → Bindings**.  
3. Under **KV namespace bindings**, click **Add**.  
4. **Variable name**: `INVOYOU_KV` — must match exactly, case-sensitive.  
5. **KV namespace**: select the one you created in Step 1 (`invoyou-data`).  
6. Click **Save**.  
7. Go to **Deployments** → click **⋯** on the latest deployment → **Retry deployment**. (This re-deploys with the new binding active. Without this step the function won't see the KV namespace.)

## Step 4 — Enable sync in the app

1. Open your `*.pages.dev` URL.  
2. Go to **Settings** in the sidebar.  
3. Scroll to the **Cloud sync** card.  
4. Check **Enable cloud sync**.  
5. Click **Generate** to create a new sync key.  
6. Click **Copy** — save this key somewhere safe (a password manager, encrypted notes).  
7. Click **Save settings** — your existing local data uploads to the cloud immediately.

The status line should change to `✓ Synced · just now`.

## Step 5 — Sync to your other devices

On every other device you want to sync:

1. Open the same `*.pages.dev` URL.  
2. Settings → Cloud sync → **Enable cloud sync**.  
3. Paste the **same sync key** you saved in Step 4\.  
4. Click **Save settings**. The data downloads from the cloud and replaces what was local.

Edits on any device will sync to the others within \~30 seconds, or instantly when you reload.

## How it works (so you can trust it)

- **Auth.** Your sync key is the only secret. Anyone with it can read or overwrite your data. Anyone without it gets HTTP 401\.  
- **Where data lives.** A single KV record keyed by `state:<your-key>`. The blob is your full state — invoices, clients, settings — as JSON.  
- **Conflict resolution.** Each save bumps a timestamp. On boot, each device pulls from the cloud and keeps the newer copy (cloud or local). If you edit on Device A while Device B is offline, then sync both, last-write-wins. For a solo user editing one device at a time, this is invisible.  
- **Offline.** Local autosave (in your browser's localStorage) keeps working. The cloud push is queued and retries when you're back online.  
- **What's NOT synced.** Your sync key itself, your URL, and `lastSyncedAt` are per-device — they don't get pushed. So changing the URL on Device A doesn't affect Device B.  
- **Rate limits.** Cloud writes are debounced 30 seconds; KV's free tier allows 1,000/day. Even with constant editing you'd write \~120/hour at most.

## Free-tier headroom (Cloudflare, as of 2026\)

- **Pages**: unlimited bandwidth, unlimited requests to static files.  
- **Pages Functions**: 100,000 requests/day.  
- **KV**: 100,000 reads/day, 1,000 writes/day, 1 GB storage.

For one user managing a freelance invoicing pipeline, you'll use a tiny fraction of any of these.

## Updating the app or the function later

**Option A — re-upload via dashboard.** Pages project → **Create deployment** → upload the new files (or just the ones that changed). Re-deploy.

**Option B — connect a GitHub repo.** Push your `invoyou/` folder to a GitHub repo, then in Pages choose **Connect to Git** when creating the project (or for an existing project: Settings → Builds & deployments → Connect a Git provider). Every commit auto-deploys in \~30 seconds. Recommended if you expect frequent tweaks — gives you version history too.

## Custom domain (optional)

In your Pages project → **Custom domains** → **Set up a custom domain**. Cloudflare handles SSL automatically. The sync URL stays `/api/sync` — it follows whichever domain you're on.

## Troubleshooting

**"KV namespace not bound"** in the sync error message → You haven't done Step 3 yet, or you skipped the retry-deployment part. The binding only activates on the next deploy.

**Sync status stays at `⚠ HTTP 404`** → The `functions/api/sync.js` path is wrong, or you uploaded just `index.html` without the `functions/` folder. Re-upload with the correct structure.

**Sync status stays at `⚠ HTTP 401`** → The sync key field is empty or differs between devices. Re-paste the exact same key on each device.

**One device has old data, the other has new data, both think they're right** → Open the device that was edited most recently first; let it sync to push its data up. Then open the other device — it'll pull the newer copy. Last-write-wins, by timestamp.

**Wipe everything and start over** → Settings → Cloud sync → **Wipe cloud copy** (removes only the KV record). On each device, Settings → Data & backup → **Wipe all data** (removes local storage). To remove the KV namespace itself, do it in the Cloudflare dashboard → Storage & Databases → KV.

## Treat your sync key like a password

If you lose the key, you can't recover the cloud data (it's encrypted-at-rest by Cloudflare but the key is the only auth). Your local data on each device is unaffected — generate a new key and start fresh. If someone else gets your key, rotate it: generate a new one in the app, save it on every device, then **Wipe cloud copy** to remove the old data.  
