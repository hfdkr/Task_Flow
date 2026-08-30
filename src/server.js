require('dotenv').config();

const createApp = require('./app');
const bootstrapAdmin = require('./bootstrapAdmin');
const env = require('./config/env');

bootstrapAdmin()
    .then(() => {
        const app = createApp();
        app.listen(env.PORT, () => console.log(`[TaskFlow] Server running → http://localhost:${env.PORT}`));
    })
    .catch(err => {
        console.error('[TaskFlow] Bootstrap error:', err);
        process.exit(1);
    });
