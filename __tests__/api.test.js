const request = require('supertest');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const app = require('../server');
const db = require('../config/db');

function getDbConfig() {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'personal_finance';

  return { host, port, user, password, database };
}

async function getAdminConnection() {
  const { host, port, user, password } = getDbConfig();
  return mysql.createConnection({ host, port, user, password, multipleStatements: true });
}

async function ensureSchema() {
  const conn = await getAdminConnection();
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
    await conn.query(schemaSql);

    try {
      await conn.query(`ALTER TABLE Users
        ADD COLUMN reset_password_token_hash VARCHAR(64) NULL,
        ADD COLUMN reset_password_expires_at DATETIME NULL`);
    } catch (err) {
      if (!(err && (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060))) {
        throw err;
      }
    }
  } finally {
    await conn.end();
  }
}

async function resetDb() {
  const conn = await getAdminConnection();
  const { database } = getDbConfig();

  try {
    await conn.query(`USE \`${database}\``);

    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE Transactions');
    await conn.query('TRUNCATE TABLE Budgets');
    await conn.query('TRUNCATE TABLE Categories');
    await conn.query('TRUNCATE TABLE Users');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    await conn.end();
  }
}

describe('Personal Finance API - integration', () => {
  beforeAll(async () => {
    await ensureSchema();
  });

  afterAll(async () => {
    if (db && typeof db.end === 'function') {
      await db.end();
    }
  });

  beforeEach(async () => {
    await resetDb();
  });

  test('Auth cookie flow: login sets cookie, /me works, logout clears cookie', async () => {
    const agent = request.agent(app);

    const email = 'u1@example.com';
    const password = 'Password123!';

    await agent
      .post('/api/auth/register')
      .send({ username: 'user1', email, password })
      .expect(201);

    const loginRes = await agent
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    expect(loginRes.headers['set-cookie']).toBeDefined();

    const meRes = await agent.get('/api/auth/me').expect(200);
    expect(meRes.body && meRes.body.user && meRes.body.user.email).toBe(email);

    const csrfRes = await agent.get('/api/auth/csrf').expect(200);
    const csrfToken = csrfRes.body && csrfRes.body.csrfToken;
    expect(typeof csrfToken).toBe('string');

    const logoutRes = await agent
      .post('/api/auth/logout')
      .set('x-csrf-token', csrfToken)
      .send({})
      .expect(200);
    expect(logoutRes.body && logoutRes.body.message).toBe('Logged out');

    await agent.get('/api/auth/me').expect(401);
  });

  test('Forgot/reset password: can reset password using token and login with new password', async () => {
    const email = 'u5@example.com';
    const oldPassword = 'Password123!';

    await request(app)
      .post('/api/auth/register')
      .send({ username: 'user5', email, password: oldPassword })
      .expect(201);

    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email })
      .expect(200);

    const resetToken = forgotRes.body && forgotRes.body.resetToken;
    expect(typeof resetToken).toBe('string');

    const newPassword = 'Newpass1234';
    await request(app)
      .post('/api/auth/reset-password')
      .send({ email, token: resetToken, newPassword })
      .expect(200);

    await request(app)
      .post('/api/auth/login')
      .send({ email, password: oldPassword })
      .expect(400);

    await request(app)
      .post('/api/auth/login')
      .send({ email, password: newPassword })
      .expect(200);
  });

  test('CSRF: state-changing request without token is rejected; with token is accepted', async () => {
    const agent = request.agent(app);

    await agent.post('/api/categories').send({ name: 'NoCsrf', type: 'expense' }).expect(403);

    const email = 'u2@example.com';
    const password = 'Password123!';

    await agent
      .post('/api/auth/register')
      .send({ username: 'user2', email, password })
      .expect(201);

    await agent.post('/api/auth/login').send({ email, password }).expect(200);

    const csrfRes = await agent.get('/api/auth/csrf').expect(200);
    const csrfToken = csrfRes.body && csrfRes.body.csrfToken;
    expect(typeof csrfToken).toBe('string');

    await agent
      .post('/api/categories')
      .set('x-csrf-token', csrfToken)
      .send({ name: 'WithCsrf', type: 'expense' })
      .expect(201);
  });

  test('Transactions pagination: limit/offset returns expected number of results', async () => {
    const agent = request.agent(app);

    const email = 'u3@example.com';
    const password = 'Password123!';

    await agent
      .post('/api/auth/register')
      .send({ username: 'user3', email, password })
      .expect(201);

    await agent.post('/api/auth/login').send({ email, password }).expect(200);

    const csrfRes = await agent.get('/api/auth/csrf').expect(200);
    const csrfToken = csrfRes.body.csrfToken;

    const categoryRes = await agent
      .post('/api/categories')
      .set('x-csrf-token', csrfToken)
      .send({ name: 'TestCat', type: 'expense' })
      .expect(201);

    const categoryId = categoryRes.body.id;

    await agent
      .post('/api/transactions')
      .set('x-csrf-token', csrfToken)
      .send({ category_id: categoryId, amount: 10.5, transaction_date: '2026-01-01', description: 't1' })
      .expect(201);

    await agent
      .post('/api/transactions')
      .set('x-csrf-token', csrfToken)
      .send({ category_id: categoryId, amount: 20.5, transaction_date: '2026-01-02', description: 't2' })
      .expect(201);

    const page1 = await agent.get('/api/transactions?limit=1&offset=0').expect(200);
    expect(Array.isArray(page1.body)).toBe(true);
    expect(page1.body.length).toBe(1);

    const page2 = await agent.get('/api/transactions?limit=1&offset=1').expect(200);
    expect(Array.isArray(page2.body)).toBe(true);
    expect(page2.body.length).toBe(1);

    expect(page1.body[0].id).not.toBe(page2.body[0].id);
  });

  test('Delete category guard: cannot delete category that is used by a transaction', async () => {
    const agent = request.agent(app);

    const email = 'u4@example.com';
    const password = 'Password123!';

    await agent
      .post('/api/auth/register')
      .send({ username: 'user4', email, password })
      .expect(201);

    await agent.post('/api/auth/login').send({ email, password }).expect(200);

    const csrfRes = await agent.get('/api/auth/csrf').expect(200);
    const csrfToken = csrfRes.body.csrfToken;

    const categoryRes = await agent
      .post('/api/categories')
      .set('x-csrf-token', csrfToken)
      .send({ name: 'GuardedCat', type: 'expense' })
      .expect(201);

    const categoryId = categoryRes.body.id;

    await agent
      .post('/api/transactions')
      .set('x-csrf-token', csrfToken)
      .send({ category_id: categoryId, amount: 15, transaction_date: '2026-01-03', description: 'uses category' })
      .expect(201);

    const delRes = await agent
      .delete(`/api/categories/${categoryId}`)
      .set('x-csrf-token', csrfToken)
      .expect(400);

    expect(delRes.body && delRes.body.message).toBe('Category is in use by transactions and cannot be deleted');
  });
});
