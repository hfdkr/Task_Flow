# Task Flow

A full-stack task management app with an interactive Kanban board and analytics dashboard — Node/Express backend, vanilla JS frontend, Redis (Upstash) storage with a zero-setup local fallback.

## Features

* 🔐 Session-based authentication (bcrypt, rate-limited login/register)
* ✉️ Forgot password by email — a one-time reset link sent from your Gmail (security question as a fallback)
* 📋 Kanban board (To Do, In Progress, Done) with a list/table view
* 🎯 Task creation, editing, assignment, priorities, due dates
* 👥 Member & project management
* 🔍 Search and project filtering
* 📊 Dashboard analytics (completion rate, priority mix, member load, overdue tasks)
* 🌙 Dark / light theme
* 🖱️ Drag & drop task management (admin only)
* 👤 Role-based access — admins manage tasks/members/projects/users, members have read access

---

## Tech Stack

* **Backend:** Node.js, Express 5, express-session, bcrypt, helmet, express-rate-limit, nodemailer
* **Frontend:** HTML, CSS (Tailwind via the browser CDN build), vanilla JavaScript
* **Data storage:** Redis via `@upstash/redis` in production; a local JSON file in development — see [Data storage](#data-storage)
* **Hosting:** Vercel (serverless) — see [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md)

---

## Project structure

```
Task_Flow/
├── api/index.js              # Vercel serverless entry — wraps the Express app
├── public/                   # everything served to the browser
│   ├── index.html
│   ├── assets/               # images/icons
│   └── js/                   # frontend split by concern (loaded as classic scripts, in this order)
│       ├── ui-core.js         # theme, sidebar, mobile menu, DOM refs, auth-form UI helpers
│       ├── auth.js            # login/signup/logout, forgot password (email link + security question)
│       ├── api.js             # fetch wrappers for the /api/* endpoints
│       ├── members-projects.js
│       ├── tasks.js           # kanban render, drag & drop, filters, pagination
│       ├── dashboard.js
│       ├── admin-account.js   # admin settings, user management, account modal
│       └── main.js            # boots the app (and opens a reset link if the URL has one)
├── src/                      # backend
│   ├── server.js              # local entry point — bootstraps admin, starts listening
│   ├── app.js                 # Express app: middleware + route wiring (importable for tests)
│   ├── config/env.js          # reads & validates environment variables
│   ├── middleware/auth.js     # requireAuth / requireAdmin
│   ├── routes/                # one file per resource (auth, tasks, projects, members, account, admin)
│   ├── services/mailer.js     # sends password reset emails over SMTP
│   ├── store/kvClient.js      # Redis client, or a local JSON-file stand-in when Redis isn't configured
│   ├── store/jsonStore.js     # tasks/members/projects/users on top of kvClient
│   ├── store/kvSessionStore.js# express-session store on top of kvClient
│   ├── bootstrapAdmin.js      # optional first-boot admin creation from env vars
│   └── utils/sanitize.js
├── data/                      # local dev data — gitignored, created automatically
├── data.example.json          # shape reference for the stored data
├── tests/                     # node:test + supertest
├── vercel.json                # Vercel routing/function config
└── railway.json               # Railway deploy config (alternative host)
```

---

## Local development

```bash
npm install
# create a .env file (see "Environment variables" below) — optional for a first run
npm run dev             # nodemon, restarts on change
# or: npm start
```

Open `http://localhost:3000`. The first account you sign up becomes an admin automatically; every account after that is a regular member. You can also auto-provision an admin on boot by setting `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` in `.env`.

A minimal `.env` for local work looks like this — fill in your own values:

```ini
SESSION_SECRET=        # openssl rand -hex 32
NODE_ENV=development
PORT=3000

# Optional: auto-create an admin on first boot
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_NAME=Admin

# Optional: send real password reset emails (see "Password reset by email")
SMTP_USER=
SMTP_PASS=
```

> ⚠️ **Never commit secrets.** Every `.env*` file — including `.env.example` — is gitignored. Keep real values in your local `.env` and in Vercel → Settings → Environment Variables only.

### Tests

```bash
npm test
```

Runs the `node:test` + `supertest` suite (`tests/`) against the Express app in-process, using a throwaway temp data directory — it never touches your local `data/` or your Redis database, and never sends real email. Coverage focuses on the security-sensitive paths: auth (register/login/logout/session), password reset (email links, expiry, single use, rate limits, security-question lockout), and admin-only enforcement on tasks/projects/members.

---

## Data storage

All app data (`tasks`, `members`, `projects`, `users` with bcrypt-hashed passwords) is stored as one JSON document in Redis, along with sessions and password reset tokens. Vercel's serverless functions have no persistent disk, so a Redis database is required in production — connect an Upstash Redis database from your Vercel project's **Storage / Marketplace** tab and the connection variables are added for you (see [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md)).

Locally, if no Redis variables are set, `src/store/kvClient.js` falls back to a JSON file at `data/kv-dev.json` (location controlled by `DATA_DIR`), so `npm run dev` and `npm test` need no setup.

`data/` is gitignored — **never commit it**; it contains real user accounts. `data.example.json` at the repo root documents the expected shape.

---

## Password reset by email

1. On the sign-in screen the user clicks **Forgot password?**, enters their email and clicks **Send reset link**.
2. They receive an email with a **Set a new password** button linking to `APP_URL/#reset=<token>`.
3. The link opens the app on the "Set New Password" step. After saving, they sign in with the new password.

Reset links expire after **30 minutes**, work **once**, and stop working if the password changes by any other route. Each address gets at most one email per minute and five per day. Users who can't reach their inbox can still answer their security question (locked for 15 minutes after 5 wrong answers).

**Setting up Gmail as the sender:**

1. Turn on 2-Step Verification for the Google account: https://myaccount.google.com/security
2. Create an App Password: https://myaccount.google.com/apppasswords
3. Set `SMTP_USER` to the Gmail address and `SMTP_PASS` to the 16-character app password — **not** your normal Gmail password — in `.env` locally and in Vercel's environment variables in production.

Without SMTP settings, development prints the reset link in the server console instead of emailing it, and production shows users the security-question option instead.

---

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `SESSION_SECRET` | Yes, in production | Server refuses to start in production without it. Generate with `openssl rand -hex 32`. In development it falls back to a random per-process secret (sessions won't survive a restart). |
| `NODE_ENV` | No | `production` enables secure cookies and strict startup checks. |
| `PORT` | No | Defaults to `3000`. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Yes, in production | Redis connection, added automatically when you connect Upstash Redis on Vercel. `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` also work. Leave unset locally to use the JSON-file fallback. |
| `DATA_DIR` | No | Folder for the local JSON-file fallback. Defaults to `./data`. |
| `BCRYPT_ROUNDS` | No | Defaults to `12`. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | No | If set, an admin account is created on first boot if it doesn't already exist. |
| `SMTP_USER` / `SMTP_PASS` | For email password reset | SMTP login used to send "Forgot password?" links. For Gmail, use a 16-character [App Password](https://myaccount.google.com/apppasswords), not your normal password. |
| `SMTP_HOST` / `SMTP_PORT` | No | Default to `smtp.gmail.com` / `465`. |
| `MAIL_FROM` | No | Sender shown in the email. Defaults to `TaskFlow <SMTP_USER>`. |
| `APP_URL` | No | Public URL used in reset links. Defaults to Vercel's production URL, else `http://localhost:PORT`. Set it if you use a custom domain. |

---

## Deploying

### Vercel (current)

Full step-by-step guide: [DEPLOY_VERCEL.md](DEPLOY_VERCEL.md). In short: import the repo, connect an Upstash Redis database, set `SESSION_SECRET`, `NODE_ENV=production` and the `SMTP_*` variables, then deploy.

### Railway (alternative)

1. Create a new Railway project from this repo.
2. Add a Redis connection (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`), or add a **Volume** mounted at `/data` and set `DATA_DIR=/data` to use the JSON-file store.
3. Set `SESSION_SECRET`, `NODE_ENV=production`, and optionally `ADMIN_*` / `SMTP_*`.
4. Deploy. Railway builds with Nixpacks and uses `railway.json` for the start command and `/api/health` healthcheck.

### Known limitation

`helmet`'s Content-Security-Policy is disabled (`contentSecurityPolicy: false`) because the page loads Tailwind, Google Fonts and Flaticon UIcons from third-party CDNs — a correct CSP allowlist for those is a larger follow-up. Helmet's other protections (frame options, no-sniff, referrer policy, etc.) are still active.

---

## Security notes

* Passwords and security answers are bcrypt-hashed.
* Password reset tokens are random 256-bit values, stored only as SHA-256 hashes, single-use, and time-limited. Reset links carry the token in the URL fragment (`#reset=…`), so it never reaches server logs.
* Reset email links are built from `APP_URL`, never from the request's `Host` header, so they can't be pointed at another site.
* `/api/login`, `/api/register` and `/api/forgot-password/*` are rate-limited; reset emails and security-question attempts are also limited per account in Redis.
* All task/project/member/user mutations require an authenticated **admin** session; regular members have read-only access.
* Session cookies are `httpOnly`, `sameSite: lax`, and `secure` in production.

---

## Authors

**Hafid kr** — https://github.com/hfdkr
**Hamza Bari** — https://github.com/u0ke
**Hassan akbad** — https://github.com/akbad091
**Ilyas Assfar** — https://github.com/assfar35-stack
