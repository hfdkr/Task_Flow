// express-session Store backed by Vercel KV.
//
// The default MemoryStore keeps sessions in the process's RAM, which does
// not work on Vercel: each request can be served by a different, short-lived
// function instance, so logins would randomly appear/disappear. This store
// puts session data in Vercel KV instead, with a TTL matching the cookie's
// maxAge, so any instance can read any user's session.

const session = require('express-session');
const { kv } = require('./kvClient');

const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // fallback if the cookie has no maxAge

class KVSessionStore extends session.Store {
    constructor(options = {}) {
        super(options);
        this.prefix = options.prefix || 'sess:';
    }

    _ttlSeconds(session) {
        const maxAge = session && session.cookie && session.cookie.maxAge;
        return maxAge ? Math.ceil(maxAge / 1000) : DEFAULT_TTL_SECONDS;
    }

    async get(sid, cb) {
        try {
            const data = await kv.get(this.prefix + sid);
            cb(null, data || null);
        } catch (err) { cb(err); }
    }

    async set(sid, session, cb) {
        try {
            await kv.set(this.prefix + sid, session, { ex: this._ttlSeconds(session) });
            cb && cb();
        } catch (err) { cb && cb(err); }
    }

    async destroy(sid, cb) {
        try {
            await kv.del(this.prefix + sid);
            cb && cb();
        } catch (err) { cb && cb(err); }
    }

    async touch(sid, session, cb) {
        try {
            await kv.expire(this.prefix + sid, this._ttlSeconds(session));
            cb && cb();
        } catch (err) { cb && cb(err); }
    }
}

module.exports = KVSessionStore;
