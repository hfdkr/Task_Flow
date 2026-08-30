const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'taskflow-test-'));
process.env.SESSION_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const createApp = require('../src/app');

module.exports = createApp();
