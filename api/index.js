// Vercel entry point. Vercel treats any exported (req, res) function under
// /api as a serverless function, so this file is the whole backend for
// production. It wraps the same Express app used for local dev (src/app.js)
// — nothing about the app's behavior changes, only how it's invoked.
//
// bootstrapAdmin() is memoized on the module scope so it only actually runs
// once per warm function instance (a cold start), not on every request.

const createApp = require('../src/app');
const bootstrapAdmin = require('../src/bootstrapAdmin');

let appPromise;

function getApp() {
    if (!appPromise) {
        appPromise = bootstrapAdmin()
            .catch(err => console.error('[TaskFlow] Bootstrap error:', err))
            .then(() => createApp());
    }
    return appPromise;
}

module.exports = async (req, res) => {
    const app = await getApp();
    app(req, res);
};
