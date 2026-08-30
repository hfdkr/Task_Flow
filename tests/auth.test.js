const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('./testApp');

const validUser = {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    password: 'secret123',
    securityQuestion: 'First pet?',
    securityAnswer: 'Turing',
};

test('register: rejects missing fields', async () => {
    const res = await request(app).post('/api/register').send({ email: 'x@example.com' });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
});

test('register: first user becomes admin, creates a session', async () => {
    const res = await request(app).post('/api/register').send(validUser);
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.user.role, 'admin');
});

test('register: rejects duplicate email', async () => {
    const res = await request(app).post('/api/register').send(validUser);
    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
});

test('login: rejects wrong password', async () => {
    const res = await request(app).post('/api/login').send({ email: validUser.email, password: 'wrong' });
    assert.equal(res.status, 401);
});

test('login -> /api/me -> logout -> /api/me reflects session state', async () => {
    const agent = request.agent(app);

    const login = await agent.post('/api/login').send({ email: validUser.email, password: validUser.password });
    assert.equal(login.status, 200);
    assert.equal(login.body.success, true);

    const me = await agent.get('/api/me');
    assert.equal(me.body.authenticated, true);
    assert.equal(me.body.user.email, validUser.email);

    await agent.post('/api/logout');
    const meAfter = await agent.get('/api/me');
    assert.equal(meAfter.body.authenticated, false);
});

test('/api/tasks requires authentication', async () => {
    const res = await request(app).get('/api/tasks');
    assert.equal(res.status, 401);
});
