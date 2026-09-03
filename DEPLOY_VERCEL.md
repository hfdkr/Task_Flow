# Deploying Task Flow to Vercel

## Why the original repo didn't work on Vercel

Vercel runs your backend as **serverless functions**: stateless, short-lived, with no writable/persistent disk. Task Flow's backend (`src/store/jsonStore.js`) wrote to `data/data.json` on disk, and `express-session` kept logins in server RAM. Both assumptions break on Vercel — different requests can hit different, disposable function instances, so the JSON file and in-memory sessions don't survive between requests. That's the "he not read my backend / my data" problem: the API routes exist, but any data they wrote (or any session they created) could vanish before the next request.

This version fixes that by moving both the data store and the session store to **Vercel KV** — a key-value store built into your Vercel project (Storage tab, one click to add, no external account, not MySQL). Locally, with no KV connected, everything falls back automatically to a JSON file in `data/`, so `npm run dev` still works with zero setup, exactly like before.

## What changed

- `src/store/kvClient.js` — new. Picks real Vercel KV when `KV_REST_API_URL`/`KV_REST_API_TOKEN` are set, otherwise a local JSON-file mock for dev.
- `src/store/jsonStore.js` — same read/write API, but now backed by KV and fully `async`.
- `src/store/kvSessionStore.js` — new. An `express-session` store backed by KV, replacing the default in-memory store.
- `src/routes/*.js`, `src/bootstrapAdmin.js` — updated to `await` the now-async store calls. Reset tokens (forgot-password) moved from an in-memory `Map` to KV with the same 10-minute TTL.
- `api/index.js` — new. The Vercel entry point; wraps the existing Express app.
- `vercel.json` — new. Routes every request to `api/index.js` and bundles `public/` into the function.
- `package.json` — added the `@vercel/kv` dependency.

Nothing about the app's features, routes, or frontend changed — only how data and sessions are stored.

## Deploy steps (VS Code + Vercel, no external services)

1. **Push this repo to GitHub** (or GitLab/Bitbucket) from VS Code's Source Control panel — Vercel deploys from a git repo.

2. **Import the project in Vercel**
   Go to vercel.com → Add New → Project → import your repo. Framework preset: "Other". Leave build/output settings default (there's no build step).

3. **Add a KV database** (this replaces "MySQL" — it's a Vercel-native store, no separate signup)
   In your new Vercel project → **Storage** tab → **Create Database** → **KV** → create it, then **Connect** it to this project. Vercel automatically adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` (and a couple other `KV_*` vars) to your project's environment variables — you don't type these in yourself.

4. **Set the remaining environment variables**
   Project → Settings → Environment Variables, add for Production (and Preview if you want):
   - `SESSION_SECRET` — generate one locally with `openssl rand -hex 32`
   - `NODE_ENV` = `production`
   - optionally `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` to auto-create an admin on first boot

5. **Deploy**
   Trigger a deploy (push to your connected branch, or click Deploy in the dashboard). Vercel installs dependencies and deploys `api/index.js` as the function serving the whole app, with `public/` served alongside it.

6. **Verify**
   Visit `https://<your-project>.vercel.app/api/health` → should return `{"status":"ok"}`. Then open the site itself and register/log in — data should now persist across page reloads and repeated visits.

### Local development (unchanged)

```
npm install
cp .env.example .env   # fill in SESSION_SECRET at minimum
npm run dev
```

No KV setup needed locally — it uses `data/kv-dev.json` automatically. If you want your local dev server to read/write the same production data, run `vercel env pull .env` after connecting KV (optional).

### A note on `bcrypt`

`bcrypt` is a native module. It's left as-is here since Vercel builds your `npm install` on its own Linux servers (not your machine), so it compiles correctly for that platform automatically — you don't need to change anything. If you ever see a build error mentioning `bcrypt`, swapping it for the pure-JS `bcryptjs` package (same API) is the usual fix, but it shouldn't be necessary.
