# InvoYou

> Simple invoicing for independent work.

A clean, single-file invoicing app for freelancers. Create professional invoices and quotations, track payments, see your billing at a glance, and (optionally) sync across devices — all on Cloudflare's free tier. Built by Storitellah.

## What it does

**Create.** Invoices and quotations with line items, multi-currency support, VAT, discounts, attachments, and a Client PO number field for invoices. Four document layouts (Editorial, Modern, Classic, Studio), seven font pairings, customisable colours.

**Send.** One click opens a pre-filled draft in Gmail web or your default mail app, with the invoice details formatted in the body. Reminders for overdue invoices use the same flow.

**Track.** History view with status pills (Draft / Sent / Paid / Overdue / Accepted), client list with autocomplete, and an Insights dashboard with stat cards, a status donut, monthly revenue bars, and a calendar of issued/paid/due/overdue dates.

**Customise.** A creator-only **Dashboard** tab lets the project owner (set in `functions/api/support.js` → `CREATOR_EMAILS`) publish Buy Me a Coffee, Patreon, and/or generic support URLs. Visitors see the resulting buttons in the sidebar but can't edit them — the Dashboard tab is hidden from non-creator sessions, and the server endpoint rejects writes from anyone else.

**Keep.** Autosaves to your browser every 1.5 seconds. Optional cross-device sync via Cloudflare KV (one sync key, last-write-wins). Optional sign-in via Cloudflare Access (Google login).

**Export.** Print to PDF from your browser. Download Insights snapshots as PDF. Email a billing snapshot to yourself. Full JSON backup and restore.

## What's in this repo

```
.
├── index.html                   ← The whole app, one file. Everything runs in the browser.
├── functions/
│   └── api/
│       └── sync.js              ← Cloudflare Pages Function for optional cloud sync
├── wrangler.toml                ← Optional Cloudflare CLI config
├── .gitignore
└── README.md                    ← This file
```

The HTML file works completely on its own (open it in any browser, your data lives in localStorage). The `functions/` folder only matters if you want cross-device sync.

## Quick start — local

Just double-click `index.html`. That's it. Your data stays in your browser.

## Deploying to Cloudflare Pages

You need: a free Cloudflare account, about 10 minutes.

### 1. Push this repo to GitHub

Create a private repo on GitHub, then:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin git@github.com:YOUR_USERNAME/InvoYou.git
git push -u origin main
```

### 2. Connect Cloudflare Pages to the repo

In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**. Authorize Cloudflare to access your GitHub account, select this repo.

**Build settings:**
- Framework preset: **None**
- Build command: *(leave empty)*
- Build output directory: **/** (or just leave blank)
- Root directory: *(leave empty — index.html is at the repo root)*

Click **Save and Deploy**. After ~30 seconds you'll get a `*.pages.dev` URL.

Every future `git push` auto-deploys.

### 3. (Optional) Set up cloud sync

Sync invoices, clients, and settings across your devices. Free.

**3a. Create a KV namespace.** Dashboard → **Storage & Databases → KV → Create instance**. Name it `invoyou-data`. Save.

**3b. Bind it to your Pages project.** Your Pages project → **Settings → Bindings → Add → KV namespace**.
- Variable name: `INVOYOU_KV` (case-sensitive — must match exactly)
- KV namespace: select `invoyou-data`
- Save.

**3c. Re-deploy.** Pages project → **Deployments** → click **⋯** on the latest → **Retry deployment**. Without this step the binding isn't active.

**3d. Enable in the app.** Open your `*.pages.dev` URL → **Settings → Cloud sync** → check **Enable cloud sync** → **Generate** → **Copy** the key (save it somewhere safe, like a password manager) → **Save settings**. Your local data uploads.

**3e. Sync your other devices.** Open the same URL on another device → Settings → Cloud sync → enable → paste the same key → Save. Data downloads.

Edits sync within ~30 seconds (debounced to stay under KV's 1,000 writes/day free limit). On reload, sync is instant.

### 4. (Optional) Sign in with Google via Cloudflare Access

Put your app behind a Google login wall in 5 minutes — no code changes.

**Why this works without code:** Cloudflare Access sits in front of the whole site at the network layer. It checks your Google identity before any of the app even loads. The HTML and the sync function never need to know about it.

**4a. Enable Cloudflare Access (Zero Trust).** Dashboard → **Zero Trust** (left sidebar). If prompted, accept the free plan — it covers up to 50 users at no cost.

**4b. Add Google as a login method.** Zero Trust dashboard → **Settings → Authentication → Login methods → Add new → Google**. Follow Cloudflare's wizard — they walk you through creating Google OAuth credentials at console.cloud.google.com (about 3 minutes). Save.

**4c. Protect your Pages site.** Zero Trust dashboard → **Access → Applications → Add an application → Self-hosted**.
- Application name: `InvoYou`
- Session duration: pick something comfortable (24 hours, 1 week, 1 month — your call)
- Subdomain: leave blank
- Domain: select your `*.pages.dev` domain (or your custom domain)
- Path: leave blank (protects the whole app)
- Click **Next**.

**4d. Add a policy.** On the policies screen:
- Policy name: `My access`
- Action: **Allow**
- Configure rules: **Include → Emails → Add your Google email(s)**
- Click **Next → Add application**.

Done. Open your URL — you'll be redirected to Google's login, sign in with the whitelisted account, and land in the app. Anyone without an allowed email gets blocked at the door.

**Important caveat:** Cloudflare Access protects access, not data. Anyone who signs in sees the same shared data — it's a locked door to a shared room, not separate accounts. For a personal app for just you (or you + a partner) this is perfect. If you ever need true multi-user separation with different data per account, that's a code-level OAuth project — not this approach.

## How sync works (so you can trust it)

- **Auth.** The sync key is the only secret. Anyone with it can read or overwrite your data. Anyone without gets HTTP 401.
- **Storage.** One KV record per sync key, key format `state:<your-key>`, value is your full JSON state.
- **Conflict resolution.** Each save bumps a timestamp. On boot, each device pulls from cloud and keeps the newer copy. Last-write-wins.
- **Offline.** Local autosave (localStorage) always works. Cloud push is queued and retries when you're back online.
- **Per-device.** Your sync key, sync URL, and last-sync time are never pushed — they stay per device.

## Creator-only Dashboard (you vs your visitors)

InvoYou separates **the project creator** (you) from **visitors** (everyone else using your deployment). The creator gets a **Dashboard** tab where you can publish support links — Buy Me a Coffee, Patreon, and a generic third option. Those links appear in the sidebar for every visitor. The Dashboard form itself is hidden from visitors, and the API endpoint rejects writes from anyone who isn't a creator.

### How the creator check works

Two layers, both checking the same thing:

1. **UI layer (client-side).** The Dashboard tab carries a `data-creator-only` attribute. On every page load the app calls `/api/whoami`, which returns the email Cloudflare Access signed in with. If that email is in the `CREATOR_EMAILS` list (in `functions/api/support.js`), the Dashboard tab is shown; otherwise it's hidden. This is just UX cleanliness — anyone in DevTools can flip a CSS flag.

2. **Server layer (the one that actually matters).** When you save support links from the Dashboard, the app PUTs to `/api/support`. The Pages Function reads Cloudflare Access's `Cf-Access-Authenticated-User-Email` header (which is signed and trustworthy — set by Cloudflare's edge, not by the browser). If the email isn't in `CREATOR_EMAILS`, the write is rejected with HTTP 403. So even a determined visitor who bypasses the UI can't actually save anything.

### Setting yourself as the creator

The list of creator emails lives in **`functions/api/support.js`**:

```js
const CREATOR_EMAILS = [
  'bryanjaybee@gmail.com'    // edit me
];
```

To add or rotate creators, edit that array and redeploy (`git push`). No environment variables, no admin UI — keeping it in code makes accidental misconfiguration impossible.

### What this requires

For the server check to work, you **must** enable **Cloudflare Access with Google login** (covered in step 4 above). Without Access, the `Cf-Access-Authenticated-User-Email` header is never set, no one can be a creator, and the Dashboard is permanently hidden. (Visitors still see published support links — those just live as static data once you've saved them.)

If you don't deploy with Cloudflare Access, the app falls back to local-only mode: support links can still be saved per-browser (to localStorage), but they're personal to that browser, not published globally.

### What happens to visitors

Visitors who open your `*.pages.dev` URL:
- See your branding (logo, "by Storitellah" link, support buttons)
- Get their own private localStorage (their drafts, clients, settings are theirs)
- Can configure their own Settings (business info, currency, prefixes) — they need to, to use the app
- **Don't** see the Dashboard tab
- **Can't** modify your published support links, even by poking at the API

### What's per-visitor vs project-wide

- **Per-visitor (their localStorage):** business info, clients, documents, design preferences, sync settings
- **Project-wide (creator-managed):** the support links shown in the sidebar
- **In the code (git-managed):** the creator email list, the brand defaults, the page structure

## Free-tier limits (Cloudflare, as of 2026)

- **Pages:** unlimited bandwidth, unlimited requests to static files.
- **Pages Functions:** 100,000 requests/day.
- **KV:** 100,000 reads/day, 1,000 writes/day, 1 GB storage.
- **Zero Trust (Access):** 50 users free.

You'll use a tiny fraction.

## Updating the app

Just `git push` to your repo. Cloudflare Pages auto-deploys in ~30 seconds. Watch the **Deployments** tab for status.

## Custom domain

Pages project → **Custom domains → Set up a custom domain**. Cloudflare handles SSL automatically. Sync API stays at `/api/sync` on whatever domain you're using.

## Troubleshooting

**Sync status shows `⚠ HTTP 500: KV namespace not bound`**
→ You skipped step 3c. Bind `INVOYOU_KV` and re-deploy.

**Sync status shows `⚠ HTTP 404`**
→ The `functions/` folder didn't make it to deployment. Check that it's at the repo root (not nested) and committed.

**Sync status shows `⚠ HTTP 401`**
→ Sync key empty, missing, or different across devices. Re-paste the exact same key on each.

**Two devices disagree about data**
→ Open the most-recently-edited device first; let it sync. Then open the other — it'll pull the newer copy.

**Build failed in Cloudflare Pages**
→ Check the build log under Deployments → click the failed deployment → "Deployment details". The error is almost always in the last 20 lines. For this project, the build command must be **empty** — if Cloudflare detected a framework and added one, clear it in **Settings → Builds & deployments → Build configurations**.

**Cloudflare Access redirect loop**
→ Your Google OAuth credentials in step 4b are misconfigured. Re-run that wizard, double-check the redirect URI matches what Cloudflare shows.

**Dashboard tab doesn't show up even though I'm signed in**
→ Three things to check. (1) Cloudflare Access is enabled and you signed in with the email that's listed in `CREATOR_EMAILS` (case doesn't matter, but spelling does). (2) The deployment is current — if you added your email after deploying, push again. (3) Visit `/api/whoami` in your browser directly — it should show `{"email":"your@email.com","authenticated":true}`. If it shows `{"email":null,"authenticated":false}`, Access isn't passing the header; check that the Access application's domain in step 4c matches the URL you're actually using.

**"Forbidden" when saving support links**
→ Your signed-in email isn't in `CREATOR_EMAILS` in `functions/api/support.js`. Edit, commit, push.

**I lost my sync key**
→ Local data on every device is safe. Generate a new key, save it on every device, then **Wipe cloud copy** in Settings to clear the old data.

## Security notes

- Treat your sync key like a password. Anyone with it can read or overwrite your cloud copy.
- Cloudflare encrypts KV data at rest, but the key is the only auth.
- Don't commit your sync key to git. The `.gitignore` already excludes common backup file patterns.
- For real authentication, use the Cloudflare Access setup in step 4.

## Stack

- Plain HTML, CSS, JavaScript — no build step, no framework
- Google Fonts (Manrope for brand, Inter for UI, JetBrains Mono for numerals)
- html2pdf.js for Insights PDF export
- Cloudflare Pages (hosting) + Pages Functions (sync API) + KV (storage)
- Optional: Cloudflare Access for Google sign-in

## License

Private. All rights reserved.

---

Built with care for independent work.
