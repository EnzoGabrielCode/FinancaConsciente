const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcrypt');

const { createApp } = require('../src/main/app');

const TEST_CONFIG = {
  port: 0,
  jwtSecret: 'segredo-de-teste-com-pelo-menos-32-caracteres',
  jwtExpiresIn: '1h',
  databasePath: ':memory:',
  bcryptRounds: 4, // rápido nos testes; em produção vem do .env
};

const VALID_USER = {
  name: 'Maria Silva',
  email: 'maria@example.com',
  password: 'senhaSegura123',
};

describe('API FinançaConsciente', () => {
  let app;
  let db;

  beforeEach(() => {
    ({ app, db } = createApp(TEST_CONFIG));
  });

  afterEach(() => {
    db.close();
  });

  describe('GET /api/health', () => {
    it('responde ok e envia o cabeçalho HSTS', async () => {
      const res = await request(app).get('/api/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'ok');
      assert.match(res.headers['strict-transport-security'], /max-age=31536000; includeSubDomains/);
    });
  });

  describe('POST /api/auth/register', () => {
    it('cadastra um usuário e não devolve a senha', async () => {
      const res = await request(app).post('/api/auth/register').send(VALID_USER);
      assert.equal(res.status, 201);
      assert.equal(res.body.user.name, VALID_USER.name);
      assert.equal(res.body.user.email, VALID_USER.email);
      assert.ok(res.body.user.id);
      assert.equal(res.body.user.password, undefined);
      assert.equal(res.body.user.passwordHash, undefined);
    });

    it('salva a senha como hash bcrypt, nunca em texto puro', async () => {
      await request(app).post('/api/auth/register').send(VALID_USER);
      const row = db.prepare('SELECT password_hash FROM users WHERE email = ?').get(VALID_USER.email);
      assert.notEqual(row.password_hash, VALID_USER.password);
      assert.match(row.password_hash, /^\$2[aby]\$\d{2}\$.{53}$/);
      assert.equal(await bcrypt.compare(VALID_USER.password, row.password_hash), true);
    });

    it('retorna 409 para e-mail duplicado (sem diferenciar maiúsculas)', async () => {
      await request(app).post('/api/auth/register').send(VALID_USER);
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...VALID_USER, email: '  MARIA@Example.com ' });
      assert.equal(res.status, 409);
    });

    it('retorna 400 com os campos inválidos', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: '   ', email: 'nao-e-email', password: 'curta' });
      assert.equal(res.status, 400);
      assert.ok(res.body.details.name);
      assert.ok(res.body.details.email);
      assert.ok(res.body.details.password);
    });

    it('exige senha de no mínimo 8 caracteres', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...VALID_USER, password: '1234567' });
      assert.equal(res.status, 400);
      assert.deepEqual(Object.keys(res.body.details), ['password']);
    });

    it('retorna 400 para corpo vazio ou JSON malformado', async () => {
      const empty = await request(app).post('/api/auth/register').send({});
      assert.equal(empty.status, 400);

      const malformed = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('{"name":');
      assert.equal(malformed.status, 400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(VALID_USER);
    });

    it('retorna um token JWT com credenciais válidas', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: VALID_USER.email, password: VALID_USER.password });
      assert.equal(res.status, 200);
      assert.equal(res.body.tokenType, 'Bearer');
      assert.match(res.body.token, /^[\w-]+\.[\w-]+\.[\w-]+$/);
      assert.equal(res.body.user.email, VALID_USER.email);
    });

    it('retorna 401 com senha errada', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: VALID_USER.email, password: 'senhaErrada999' });
      assert.equal(res.status, 401);
      assert.equal(res.body.token, undefined);
    });

    it('retorna 401 com a mesma mensagem para e-mail inexistente', async () => {
      const wrongPassword = await request(app)
        .post('/api/auth/login')
        .send({ email: VALID_USER.email, password: 'senhaErrada999' });
      const unknownEmail = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ninguem@example.com', password: 'qualquer123' });
      assert.equal(unknownEmail.status, 401);
      assert.equal(unknownEmail.body.error, wrongPassword.body.error);
    });

    it('retorna 400 sem e-mail ou senha', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      assert.equal(res.status, 400);
    });
  });

  describe('GET /api/me (rota protegida)', () => {
    it('retorna 401 sem token', async () => {
      const res = await request(app).get('/api/me');
      assert.equal(res.status, 401);
    });

    it('retorna 401 com token inválido', async () => {
      const res = await request(app).get('/api/me').set('Authorization', 'Bearer token.invalido.aqui');
      assert.equal(res.status, 401);
    });

    it('retorna o usuário autenticado com token válido', async () => {
      await request(app).post('/api/auth/register').send(VALID_USER);
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: VALID_USER.email, password: VALID_USER.password });

      const res = await request(app).get('/api/me').set('Authorization', `Bearer ${login.body.token}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.user.email, VALID_USER.email);
      assert.equal(res.body.user.passwordHash, undefined);
    });
  });

  it('retorna 404 para rota desconhecida', async () => {
    const res = await request(app).get('/api/nao-existe');
    assert.equal(res.status, 404);
  });
});
