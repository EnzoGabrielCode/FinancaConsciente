const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { createApp } = require('../src/main/app');
const { loadConfig } = require('../src/main/config');
const { createLogger } = require('../src/infrastructure/logging/logger');

const TEST_CONFIG = {
  port: 0,
  jwtSecret: 'segredo-de-teste-com-pelo-menos-32-caracteres',
  jwtExpiresIn: '1h',
  databasePath: ':memory:',
  bcryptRounds: 4,
  logLevel: 'silent',
};

const VALID_USER = {
  name: 'Maria Silva',
  email: 'maria@example.com',
  password: 'senhaSegura123',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function createFakeLogger() {
  const calls = [];
  const log = (nivel, mensagem, meta) => calls.push({ nivel, mensagem, meta });
  const at = (nivel) => (mensagem, meta) => log(nivel, mensagem, meta);
  return {
    calls,
    log,
    error: at('error'),
    warn: at('warn'),
    info: at('info'),
    http: at('http'),
    debug: at('debug'),
  };
}

// O evento 'finish' do servidor pode chegar depois da resposta ao cliente.
async function waitForRequestLog(logger, status) {
  const deadline = Date.now() + 1000;
  for (;;) {
    const found = logger.calls.find(
      (call) => call.mensagem === 'requisição' && call.meta.status === status,
    );
    if (found) return found;
    assert.ok(Date.now() < deadline, `sem log de requisição com status ${status}`);
    await new Promise((resolve) => setImmediate(resolve));
  }
}

// Síncrono de propósito: o runner do node --test também usa o stdout deste
// processo, e seus eventos não podem cair na captura.
function captureStdout(action) {
  const original = process.stdout.write;
  let output = '';
  process.stdout.write = (chunk) => {
    output += chunk;
    return true;
  };
  try {
    action();
  } finally {
    process.stdout.write = original;
  }
  return output;
}

describe('Logs estruturados', () => {
  let app;
  let db;
  let logger;

  beforeEach(() => {
    logger = createFakeLogger();
    ({ app, db } = createApp({ ...TEST_CONFIG, logger }));
  });

  afterEach(() => {
    db.close();
  });

  describe('requestLogger', () => {
    it('devolve X-Request-Id e registra a requisição no nível http', async () => {
      const res = await request(app).get('/api/health');
      assert.equal(res.status, 200);
      assert.match(res.headers['x-request-id'], UUID);

      const { nivel, meta } = await waitForRequestLog(logger, 200);
      assert.equal(nivel, 'http');
      assert.equal(meta.requestId, res.headers['x-request-id']);
      assert.equal(meta.method, 'GET');
      assert.equal(meta.path, '/api/health');
      assert.equal(typeof meta.durationMs, 'number');
      assert.equal(meta.durationMs, Math.round(meta.durationMs * 10) / 10);
    });

    it('devolve igual um X-Request-Id válido enviado pelo cliente', async () => {
      const res = await request(app).get('/api/health').set('X-Request-Id', 'Pedido-123-abc');
      assert.equal(res.headers['x-request-id'], 'Pedido-123-abc');

      const { meta } = await waitForRequestLog(logger, 200);
      assert.equal(meta.requestId, 'Pedido-123-abc');
    });

    it('aceita um X-Request-Id de exatamente 64 caracteres', async () => {
      const id = 'a'.repeat(64);
      const res = await request(app).get('/api/health').set('X-Request-Id', id);
      assert.equal(res.headers['x-request-id'], id);
    });

    for (const [caso, id] of [
      ['com espaços', 'id com espacos'],
      ['com 65 caracteres', 'a'.repeat(65)],
      ['com 200 caracteres', 'a'.repeat(200)],
      ['com caracteres de log', '{"level":"error"}'],
    ]) {
      it(`troca por um UUID um X-Request-Id ${caso}`, async () => {
        const res = await request(app).get('/api/health').set('X-Request-Id', id);
        assert.match(res.headers['x-request-id'], UUID);
      });
    }

    it('registra login recusado como warn, sem senha nem e-mail', async () => {
      await request(app).post('/api/auth/register').send(VALID_USER);
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: VALID_USER.email, password: 'senhaErrada456' });
      assert.equal(res.status, 401);

      const { nivel } = await waitForRequestLog(logger, 401);
      assert.equal(nivel, 'warn');

      const logs = JSON.stringify(logger.calls);
      assert.equal(logs.includes('senhaErrada456'), false);
      assert.equal(logs.includes(VALID_USER.password), false);
      assert.equal(logs.includes(VALID_USER.email), false);
    });

    it('não registra o cabeçalho Authorization', async () => {
      const res = await request(app)
        .get('/api/me')
        .set('Authorization', 'Bearer token-invalido-do-cliente');
      assert.equal(res.status, 401);

      await waitForRequestLog(logger, 401);
      assert.equal(JSON.stringify(logger.calls).includes('token-invalido-do-cliente'), false);
    });

    it('não registra a query string', async () => {
      // Id fixo: um UUID aleatório pode conter "abc" e derrubar o teste ao acaso.
      await request(app).get('/api/health?token=abc').set('X-Request-Id', 'pedido-fixo-1');

      const { meta } = await waitForRequestLog(logger, 200);
      assert.equal(meta.path, '/api/health');
      assert.equal(JSON.stringify(logger.calls).includes('abc'), false);
    });

    it('registra JSON malformado como warn com status 400', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"password":"senhaNoCorpo');
      assert.equal(res.status, 400);

      const { nivel } = await waitForRequestLog(logger, 400);
      assert.equal(nivel, 'warn');
      assert.equal(JSON.stringify(logger.calls).includes('senhaNoCorpo'), false);
    });

    it('registra corpo grande demais como warn com status 413', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'x'.repeat(200 * 1024) });
      assert.equal(res.status, 413);

      const { nivel } = await waitForRequestLog(logger, 413);
      assert.equal(nivel, 'warn');
    });
  });

  describe('errorHandler', () => {
    it('registra o erro inesperado com a stack e responde 500 genérico', async () => {
      db.close(); // o repositório passa a lançar um erro não previsto

      const res = await request(app)
        .post('/api/auth/login?token=valor-da-query')
        .send({ email: VALID_USER.email, password: VALID_USER.password });
      assert.equal(res.status, 500);
      assert.deepEqual(res.body, { error: 'Erro interno do servidor.' });

      const erro = logger.calls.find((call) => call.mensagem === 'erro não tratado');
      assert.equal(erro.nivel, 'error');
      assert.equal(erro.meta.requestId, res.headers['x-request-id']);
      assert.equal(erro.meta.method, 'POST');
      assert.equal(erro.meta.path, '/api/auth/login');
      assert.ok(erro.meta.error instanceof Error);
      assert.match(erro.meta.error.stack, /SqliteUserRepository/);

      const { nivel } = await waitForRequestLog(logger, 500);
      assert.equal(nivel, 'error');
      assert.equal(JSON.stringify(logger.calls).includes('valor-da-query'), false);
    });
  });

  describe('createLogger', () => {
    it('não escreve nada no stdout com o nível silent', () => {
      const silent = createLogger({ level: 'silent', env: 'production' });
      const output = captureStdout(() => {
        silent.error('não deve aparecer');
        silent.info('não deve aparecer');
      });
      assert.equal(output, '');
    });

    it('em produção escreve uma linha de JSON por evento, com a stack do erro', () => {
      const production = createLogger({ level: 'info', env: 'production' });
      const output = captureStdout(() => {
        production.error('erro não tratado', { requestId: 'r1', error: new Error('falhou') });
        production.info('API ouvindo', { port: 3000 });
      });

      const lines = output.trim().split('\n');
      assert.equal(lines.length, 2);
      const evento = JSON.parse(lines[0]);
      assert.equal(evento.level, 'error');
      assert.equal(evento.message, 'erro não tratado');
      assert.equal(evento.service, 'financaconsciente-api');
      assert.equal(evento.requestId, 'r1');
      assert.equal(new Date(evento.timestamp).toISOString(), evento.timestamp);
      assert.equal(evento.error.message, 'falhou');
      assert.match(evento.error.stack, /logging\.test\.js/);
      assert.equal(JSON.parse(lines[1]).port, 3000);
    });

    it('não copia para o log os campos extras do erro', () => {
      const production = createLogger({ level: 'info', env: 'production' });
      const error = Object.assign(new Error('falhou'), { body: 'corpo-da-requisicao' });
      const output = captureStdout(() => production.error('erro não tratado', { error }));
      assert.equal(output.includes('corpo-da-requisicao'), false);
    });

    it('fora de produção escreve texto colorido com os campos extras em JSON', () => {
      const development = createLogger({ level: 'info', env: 'development' });
      const output = captureStdout(() => development.warn('atenção', { port: 3000 }));

      assert.match(output, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z /);
      assert.match(output, /\u001b\[\d+mwarn\u001b\[\d+m: atenção /);
      assert.match(output, /\{.*"port":3000.*\}\n$/);
      assert.match(output, /"service":"financaconsciente-api"/);
    });
  });

  describe('loadConfig', () => {
    const env = { JWT_SECRET: 'x'.repeat(32) };

    it('usa info e development como padrão', () => {
      const config = loadConfig(env);
      assert.equal(config.logLevel, 'info');
      assert.equal(config.env, 'development');
    });

    it('aceita os níveis válidos e lê NODE_ENV', () => {
      for (const level of ['error', 'warn', 'info', 'http', 'debug', 'silent']) {
        assert.equal(loadConfig({ ...env, LOG_LEVEL: level }).logLevel, level);
      }
      assert.equal(loadConfig({ ...env, NODE_ENV: 'production' }).env, 'production');
    });

    it('rejeita LOG_LEVEL inválido', () => {
      assert.throws(() => loadConfig({ ...env, LOG_LEVEL: 'verbose' }), /LOG_LEVEL/);
    });
  });
});
