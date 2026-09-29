const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.APP_URL = 'https://taskflow.example.com/';
const app = require('./testApp');
const mailer = require('../src/services/mailer');

const user = {
    name: 'Grace Hopper',
    email: 'grace@example.com',
    password: 'oldpass123',
    securityQuestion: 'First language?',
    securityAnswer: 'COBOL',
};

let outbox = [];
mailer.sendPasswordResetEmail = async msg => { outbox.push(msg); };

beforeEach(() => { outbox = []; });

function tokenFromLink(link) {
    const match = /#reset=([a-f0-9]{64})$/.exec(link);
    assert.ok(match, `link has no reset token: ${link}`);
    return match[1];
}

test('setup: register user', async () => {
    const res = await request(app).post('/api/register').send(user);
    assert.equal(res.status, 201);
});

test('email reset: rejects an invalid email', async () => {
    const res = await request(app).post('/api/forgot-password/email').send({ email: 'not-an-email' });
    assert.equal(res.status, 400);
    assert.equal(outbox.length, 0);
});

test('email reset: unknown email gets the same generic response and no mail', async () => {
    const res = await request(app).post('/api/forgot-password/email').send({ email: 'nobody@example.com' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(outbox.length, 0);
});

test('email reset: known email receives a link built from APP_URL', async () => {
    const res = await request(app).post('/api/forgot-password/email').send({ email: ' GRACE@example.com ' });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].to, user.email);
    assert.equal(outbox[0].name, user.name);
    assert.match(outbox[0].link, /^https:\/\/taskflow\.example\.com\/#reset=[a-f0-9]{64}$/);
});

test('email reset: a second request inside the cooldown sends no new mail', async () => {
    const res = await request(app).post('/api/forgot-password/email').send({ email: user.email });
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(outbox.length, 0);
});

test('email reset: link token sets a new password and is single-use', async () => {
    // The cooldown from the previous test is still active, so clear it.
    const { kv } = require('../src/store/kvClient');
    await kv.del(`resetmail:${user.email}`);

    await request(app).post('/api/forgot-password/email').send({ email: user.email });
    const token = tokenFromLink(outbox[0].link);

    const reset = await request(app).post('/api/forgot-password/reset').send({ token, newPassword: 'newpass456' });
    assert.equal(reset.status, 200);
    assert.equal(reset.body.success, true);

    const oldLogin = await request(app).post('/api/login').send({ email: user.email, password: user.password });
    assert.equal(oldLogin.status, 401);
    const newLogin = await request(app).post('/api/login').send({ email: user.email, password: 'newpass456' });
    assert.equal(newLogin.status, 200);

    const reuse = await request(app).post('/api/forgot-password/reset').send({ token, newPassword: 'another789' });
    assert.equal(reuse.status, 400);
});

test('reset: rejects an unknown token', async () => {
    const res = await request(app).post('/api/forgot-password/reset').send({ token: 'f'.repeat(64), newPassword: 'whatever1' });
    assert.equal(res.status, 400);
});

test('reset: rejects a non-string token', async () => {
    const res = await request(app).post('/api/forgot-password/reset').send({ token: { $ne: null }, newPassword: 'whatever1' });
    assert.equal(res.status, 400);
});

test('security-question reset still works', async () => {
    const verify = await request(app).post('/api/forgot-password/verify').send({ email: user.email, answer: 'cobol' });
    assert.equal(verify.status, 200);
    const reset = await request(app).post('/api/forgot-password/reset').send({ token: verify.body.token, newPassword: 'viaquestion1' });
    assert.equal(reset.status, 200);
    const login = await request(app).post('/api/login').send({ email: user.email, password: 'viaquestion1' });
    assert.equal(login.status, 200);
});

async function registerUser(email) {
    const res = await request(app).post('/api/register').send({ ...user, email });
    assert.equal(res.status, 201);
}

async function requestResetLink(email) {
    const { kv } = require('../src/store/kvClient');
    await kv.del(`resetmail:${email}`);
    outbox = [];
    await request(app).post('/api/forgot-password/email').send({ email });
    return outbox.length ? tokenFromLink(outbox[0].link) : null;
}

test('email reset: older links stop working once the password changes', async () => {
    await registerUser('stale@example.com');
    const first  = await requestResetLink('stale@example.com');
    const second = await requestResetLink('stale@example.com');

    const used = await request(app).post('/api/forgot-password/reset').send({ token: second, newPassword: 'fresh1234' });
    assert.equal(used.status, 200);
    const stale = await request(app).post('/api/forgot-password/reset').send({ token: first, newPassword: 'hijack123' });
    assert.equal(stale.status, 400);
});

test('email reset: sends at most 5 emails per address per day', async () => {
    await registerUser('daily@example.com');
    const sent = [];
    for (let i = 0; i < 6; i++) sent.push(await requestResetLink('daily@example.com'));
    assert.equal(sent.filter(Boolean).length, 5);
    assert.equal(sent[5], null);
});

test('security question: locks the account after 5 wrong answers', async () => {
    await registerUser('locked@example.com');
    for (let i = 0; i < 5; i++) {
        const wrong = await request(app).post('/api/forgot-password/verify').send({ email: 'locked@example.com', answer: 'nope' });
        assert.equal(wrong.status, 401);
    }
    const correct = await request(app).post('/api/forgot-password/verify').send({ email: 'locked@example.com', answer: 'cobol' });
    assert.equal(correct.status, 429);
});
