// Thin key/value client used by jsonStore.js, kvSessionStore.js, and the
// forgot-password reset tokens in auth.routes.js.
//
// Vercel's old "KV" product is deprecated — new Redis databases on Vercel
// now come from the Marketplace (an Upstash Redis integration) instead, and
// depending on how you connect it, it can inject different env var names.
// This checks every naming convention Vercel is known to use, in order,
// and talks to whichever one it finds via @upstash/redis's REST client
// (the same thing @vercel/kv used underneath — not deprecated).
//
// Locally, with no Redis integration connected, none of those env vars are
// set, so this falls back to a tiny JSON-file-backed store (data/kv-dev.json)
// that implements the same get/set/del/expire shape. That keeps `npm run dev`
// and `npm test` working with zero setup, exactly like before.

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

// Every env var pair Vercel is known to use for a connected Redis database,
// newest/most-likely first. We use whichever pair is actually present.
const CANDIDATE_ENV_PAIRS = [
    ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],                   // legacy Vercel KV / some Marketplace connections mirror this
    ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],     // standard Upstash naming
    ['REDIS_KV_REST_API_URL', 'REDIS_KV_REST_API_TOKEN'],       // integration named "redis" can prefix vars this way
];

function findRedisEnv() {
    for (const [urlKey, tokenKey] of CANDIDATE_ENV_PAIRS) {
        if (process.env[urlKey] && process.env[tokenKey]) {
            return { url: process.env[urlKey], token: process.env[tokenKey], urlKey };
        }
    }
    return null;
}

const redisEnv = findRedisEnv();

let kv;
if (redisEnv) {
    const { Redis } = require('@upstash/redis');
    kv = new Redis({ url: redisEnv.url, token: redisEnv.token });
} else {
    kv = createFileKv();
    if (process.env.NODE_ENV !== 'test') {
        console.warn(
            '[TaskFlow] ⚠ No Redis env vars found (checked ' +
            CANDIDATE_ENV_PAIRS.map(([u]) => u).join(', ') +
            ') — using a local JSON-file store (data/kv-dev.json) for development only. ' +
            'On Vercel, connect a Redis database from the Marketplace tab before deploying, ' +
            'or data will not persist.'
        );
    }
}

module.exports = { kv };
