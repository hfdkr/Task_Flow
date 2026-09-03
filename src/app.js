const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const env = require('./config/env');
const KVSessionStore = require('./store/kvSessionStore');

const authRoutes = require('./routes/auth.routes');
const taskRoutes = require('./routes/tasks.routes');
const projectRoutes = require('./routes/projects.routes');
const memberRoutes = require('./routes/members.routes');
const accountRoutes = require('./routes/account.routes');
const adminRoutes = require('./routes/admin.routes');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

function createApp() {
    const app = express();

    // Vercel (and most PaaS hosts) sit behind a reverse proxy — required for
    // secure cookies and correct client IPs to work.
    app.set('trust proxy', 1);

    app.use(helmet({ contentSecurityPolicy: false }));
    app.use(cors({ origin: true, credentials: true }));
    app.use(express.json());
    app.use(session({
        store: new KVSessionStore(),
        secret: env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: env.IS_PRODUCTION,
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 24 * 60 * 60 * 1000,
        },
    }));

    app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

    app.use('/api', authRoutes);
    app.use('/api/tasks', taskRoutes);
    app.use('/api/projects', projectRoutes);
    app.use('/api/members', memberRoutes);
    app.use('/api/account', accountRoutes);
    app.use('/api/admin', adminRoutes);

    app.use(express.static(PUBLIC_DIR));

    return app;
}

module.exports = createApp;
