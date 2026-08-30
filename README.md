# Task Flow

A full-stack task management app with an interactive Kanban board and analytics dashboard — Node/Express backend, vanilla JS frontend, no database (JSON-file storage).

## Features

* 🔐 Session-based authentication (bcrypt, rate-limited login/register)
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

* **Backend:** Node.js, Express 5, express-session, bcrypt, helmet, express-rate-limit
* **Frontend:** HTML, CSS (Tailwind via the browser CDN build), vanilla JavaScript
* **Data storage:** a single JSON file (no database) — see [Data storage](#data-storage)

---

## Project structure

```
Task_Flow/
├── public/                  # everything served to the browser
│   ├── index.html
│   ├── assets/               # images/icons
│   └── js/                   # frontend split by concern (loaded as classic scripts, in this order)
│       ├── ui-core.js         # theme, sidebar, mobile menu, DOM refs, auth-form UI helpers
│       ├── auth.js            # login/signup/logout/forgot-password
│       ├── api.js             # fetch wrappers for the /api/* endpoints
│       ├── members-projects.js
│       ├── tasks.js           # kanban render, drag & drop, filters, pagination
│       ├── dashboard.js
│       ├── admin-account.js   # admin settings, user management, account modal
│       └── main.js            # boots the app
├── src/                      # backend
│   ├── server.js              # entry point — bootstraps admin, starts listening
│   ├── app.js                 # Express app: middleware + route wiring (importable for tests)
│   ├── config/env.js          # reads & validates environment variables
│   ├── middleware/auth.js     # requireAuth / requireAdmin
│   ├── routes/                # one file per resource (auth, tasks, projects, members, account, admin)
│   ├── store/jsonStore.js     # reads/writes data.json
│   ├── bootstrapAdmin.js      # optional first-boot admin creation from env vars
│   └── utils/sanitize.js
├── data/                      # JSON data store — gitignored, created automatically
├── data.example.json          # shape reference for data/data.json
├── tests/                     # node:test + supertest
├── .env.example
└── railway.json                # Railway deploy config
```

---

## Local development

```bash
npm install
cp .env.example .env   # optional locally; SESSION_SECRET falls back to a random dev-only value if unset
npm run dev             # nodemon, restarts on change
# or: npm start
```

Open `http://localhost:3000`. The first account you sign up becomes an admin automatically; every account after that is a regular member. You can also auto-provision an admin on boot by setting `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` in `.env`.

### Tests

```bash
npm test
```

Runs the `node:test` + `supertest` suite (`tests/`) against the Express app in-process, using a throwaway temp data directory — it never touches your local `data/data.json`. Coverage focuses on the security-sensitive paths: auth (register/login/logout/session), and admin-only enforcement on tasks/projects/members.

---

## Data storage

There is no database — `data/data.json` holds `tasks`, `members`, `projects` and `users` (bcrypt-hashed passwords). Its location is controlled by `DATA_DIR` (defaults to `./data`), so a hosting platform's persistent volume can be swapped in with a single env var.

`data/` is gitignored — **never commit your real `data.json`**. `data.example.json` at the repo root documents the expected shape.

---

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `SESSION_SECRET` | Yes, in production | Server refuses to start in production without it. Generate with `openssl rand -hex 32`. In development it falls back to a random per-process secret (sessions won't survive a restart). |
| `NODE_ENV` | No | `production` enables secure cookies and strict startup checks. |
| `PORT` | No | Defaults to `3000` (Railway sets this automatically). |
| `DATA_DIR` | No | Where `data.json` lives. Defaults to `./data`. |
| `BCRYPT_ROUNDS` | No | Defaults to `12`. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | No | If set, an admin account is created on first boot if it doesn't already exist. |

---

## Deploying to Railway

Railway was chosen because it supports **persistent volumes** — required since this app stores data in a JSON file rather than a database.

1. Push this repo to GitHub and create a new Railway project from it (branch: `new-version` or `main` once merged).
2. In the service settings, add a **Volume** mounted at `/data`.
3. Set environment variables: `SESSION_SECRET` (generate with `openssl rand -hex 32`), `NODE_ENV=production`, `DATA_DIR=/data`, and optionally `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME`.
4. Deploy. Railway builds with Nixpacks (auto-detected from `package.json`) and uses `railway.json` for the start command and `/api/health` healthcheck.
5. Railway assigns a public URL and sets `PORT` automatically.

### Known limitation

`helmet`'s Content-Security-Policy is disabled (`contentSecurityPolicy: false`) because the page loads Tailwind, Google Fonts and Flaticon UIcons from third-party CDNs — a correct CSP allowlist for those is a larger follow-up, not part of this pass. Helmet's other protections (frame options, no-sniff, etc.) are still active.

---

## Security notes

* Passwords are bcrypt-hashed; forgot-password uses a security question/answer (also hashed) and a short-lived reset token.
* `/api/login`, `/api/register` and `/api/forgot-password/*` are rate-limited.
* All task/project/member/user mutations require an authenticated **admin** session; regular members have read-only access.
* Session cookies are `httpOnly`, `sameSite: lax`, and `secure` in production.

---

## Authors

**Hafid kr** — https://github.com/hfdkr
**Hamza Bari** — https://github.com/u0ke
**Hassan akbad** — https://github.com/akbad091
**Ilyas Assfar** — https://github.com/assfar35-stack
