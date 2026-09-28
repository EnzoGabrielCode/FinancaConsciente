const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { buildApp } = require('../src/main/container');

let app;
let db;

before(() => {
  ({ app, db } = buildApp({
    databasePath: ':memory:',
    jwtSecret: 'segredo-de-teste',
    jwtExpiresIn: '1h',
    bcryptRounds: 4,
  }));
});

const user = { name: 'Enzo', email: 'Enzo@Exemplo.com', password: 'senhaforte123' };

test('GET /api/health responde ok', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});

test('cadastra usuário e guarda a senha com bcrypt', async () => {
  const res = await request(app).post('/api/auth/register').send(user);
  assert.equal(res.status, 201);
  assert.equal(res.body.user.email, 'enzo@exemplo.com');
  assert.equal(res.body.user.passwordHash, undefined);

  const row = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('enzo@exemplo.com');
  assert.notEqual(row.password_hash, user.password);
  assert.match(row.password_hash, /^\$2[aby]\$/);
});

test('recusa e-mail duplicado', async () => {
  const res = await request(app).post('/api/auth/register').send(user);
  assert.equal(res.status, 409);
});

test('valida campos do cadastro', async () => {
  const res = await request(app).post('/api/auth/register').send({ name: '', email: 'x', password: '1' });
  assert.equal(res.status, 400);
});

test('login devolve JWT que acessa rota protegida', async () => {
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password: user.password });
  assert.equal(login.status, 200);
  assert.ok(login.body.token);

  const me = await request(app).get('/api/me').set('Authorization', `Bearer ${login.body.token}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.name, 'Enzo');
});

test('login com senha errada retorna 401', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password: 'errada123' });
  assert.equal(res.status, 401);
});

test('rota protegida sem token retorna 401', async () => {
  const res = await request(app).get('/api/me');
  assert.equal(res.status, 401);
});
