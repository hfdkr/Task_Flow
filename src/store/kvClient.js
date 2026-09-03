// Thin key/value client used by jsonStore.js, kvSessionStore.js, and the
// forgot-password reset tokens in auth.routes.js.
//
// In production on Vercel, add a KV database to your project (Storage tab →
// Create Database → KV) and Vercel injects KV_REST_API_URL / KV_REST_API_TOKEN
// automatically — this then talks to real Vercel KV.
//
// Locally, with no KV database connected, those env vars won't be set, so
// this falls back to a tiny JSON-file-backed store (data/kv-dev.json) that
// implements the same get/set/del/expire shape. That keeps `npm run dev`
// and `npm test` working with zero setup, exactly like before — the real
// KV store only comes into play once you deploy.

const fs = require('fs');
const path = require('path');

function createFileKv() {
    // Honors DATA_DIR (as the old file store did) so tests can point it at
    // an isolated tmp dir instead of sharing state between test files.
    const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
    const file = path.join(dataDir, 'kv-dev.json');

    function load() {
        if (!fs.existsSync(file)) return {};
        try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return {}; }
    }
    function save(store) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(store, null, 2));
    }

    return {
        async get(key) {
            const store = load();
            const entry = store[key];
            if (!entry) return null;
            if (entry.expiresAt && entry.expiresAt < Date.now()) { delete store[key]; save(store); return null; }
            return entry.value;
        },
        async set(key, value, opts = {}) {
            const store = load();
            store[key] = { value, expiresAt: opts.ex ? Date.now() + opts.ex * 1000 : null };
            save(store);
        },
        async del(key) {
            const store = load();
            delete store[key];
            save(store);
        },
        async expire(key, seconds) {
            const store = load();
            if (store[key]) { store[key].expiresAt = Date.now() + seconds * 1000; save(store); }
        },
    };
}

const useRealKv = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

const kv = useRealKv ? require('@vercel/kv').kv : createFileKv();

if (!useRealKv && process.env.NODE_ENV !== 'test') {
    console.warn('[TaskFlow] ⚠ KV_REST_API_URL not set — using a local JSON-file store (data/kv-dev.json) for development only. Add Vercel KV before deploying.');
}

module.exports = { kv };
