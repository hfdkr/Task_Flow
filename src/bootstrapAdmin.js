const bcrypt = require('bcrypt');
const env = require('./config/env');
const { readUsers, writeUsers, readMembers, writeMembers } = require('./store/jsonStore');

async function bootstrapAdmin() {
    if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return;
    const users = await readUsers();
    if (users.some(u => u.email === env.ADMIN_EMAIL)) return;
    const hash  = await bcrypt.hash(env.ADMIN_PASSWORD, env.SALT_ROUNDS);
    const admin = {
        id: Date.now(), name: env.ADMIN_NAME, email: env.ADMIN_EMAIL,
        password: hash, role: 'admin', createdAt: new Date().toISOString(),
    };
    users.unshift(admin);
    await writeUsers(users);
    const members = await readMembers();
    if (!members.some(m => m.name.toLowerCase().trim() === env.ADMIN_NAME.toLowerCase().trim())) {
        members.push({ id: Date.now() + 1, name: env.ADMIN_NAME });
        await writeMembers(members);
    }
    console.log(`[TaskFlow] ✓ Admin created: ${env.ADMIN_EMAIL}`);
}

module.exports = bootstrapAdmin;
