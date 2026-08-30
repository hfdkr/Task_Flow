const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('./testApp');

const admin = { name: 'Admin User', email: 'admin@example.com', password: 'secret123', securityQuestion: 'q', securityAnswer: 'a' };
const member = { name: 'Regular Member', email: 'member@example.com', password: 'secret123', securityQuestion: 'q', securityAnswer: 'a' };

async function registeredAgent(user) {
    const agent = request.agent(app);
    await agent.post('/api/register').send(user);
    return agent;
}

test('admin can create, update and delete a task; member cannot', async () => {
    const adminAgent = await registeredAgent(admin);
    const memberAgent = await registeredAgent(member);

    const memberCreate = await memberAgent.post('/api/tasks').send({ title: 'Not allowed', member: member.name });
    assert.equal(memberCreate.status, 403);

    const create = await adminAgent.post('/api/tasks').send({ title: 'Write tests', member: admin.name, status: 'To Do', priority: 'High' });
    assert.equal(create.status, 201);
    assert.equal(create.body.task.title, 'Write tests');
    const taskId = create.body.task.id;

    const memberRead = await memberAgent.get('/api/tasks');
    assert.equal(memberRead.status, 200);
    assert.equal(memberRead.body.tasks.length, 1);

    const memberUpdate = await memberAgent.put(`/api/tasks/${taskId}`).send({ status: 'Done' });
    assert.equal(memberUpdate.status, 403);

    const update = await adminAgent.put(`/api/tasks/${taskId}`).send({ status: 'Done' });
    assert.equal(update.status, 200);
    assert.equal(update.body.task.status, 'Done');

    const memberDelete = await memberAgent.delete(`/api/tasks/${taskId}`);
    assert.equal(memberDelete.status, 403);

    const del = await adminAgent.delete(`/api/tasks/${taskId}`);
    assert.equal(del.status, 200);

    const finalRead = await adminAgent.get('/api/tasks');
    assert.equal(finalRead.body.tasks.length, 0);
});

test('members and projects: read allowed for all, write admin-only', async () => {
    // Only the very first account ever registered in this data store becomes admin
    // (see server-side role assignment), so reuse the admin created in the previous test.
    const adminAgent = request.agent(app);
    await adminAgent.post('/api/login').send({ email: admin.email, password: admin.password });
    const memberAgent = await registeredAgent({ name: 'Member Two', email: 'member2@example.com', password: 'secret123', securityQuestion: 'q', securityAnswer: 'a' });

    const memberAddProject = await memberAgent.post('/api/projects').send({ name: 'Blocked' });
    assert.equal(memberAddProject.status, 403);

    const addProject = await adminAgent.post('/api/projects').send({ name: 'TaskFlow v2' });
    assert.equal(addProject.status, 201);

    const readProjects = await memberAgent.get('/api/projects');
    assert.equal(readProjects.status, 200);
    assert.ok(readProjects.body.projects.some(p => p.name === 'TaskFlow v2'));
});
