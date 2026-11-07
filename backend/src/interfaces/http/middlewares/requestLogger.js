const { randomUUID } = require('node:crypto');

const SAFE_REQUEST_ID = /^[A-Za-z0-9-]{1,64}$/;

function resolveRequestId(req) {
  const received = req.get('x-request-id');
  return received && SAFE_REQUEST_ID.test(received) ? received : randomUUID();
}

// A query string pode carregar dados sensíveis e nunca vai para o log.
function pathOf(req) {
  return req.originalUrl.split('?')[0];
}

function levelFor(status) {
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';
  return 'http';
}

/**
 * Identifica cada requisição (req.id e cabeçalho X-Request-Id) e registra um
 * evento ao fim da resposta. Corpo e cabeçalhos da requisição não são
 * registrados.
 */
function requestLogger({ logger }) {
  return (req, res, next) => {
    const startedAt = process.hrtime.bigint();

    req.id = resolveRequestId(req);
    res.setHeader('X-Request-Id', req.id);

    res.on('finish', () => {
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      logger.log(levelFor(res.statusCode), 'requisição', {
        requestId: req.id,
        method: req.method,
        path: pathOf(req),
        status: res.statusCode,
        durationMs: Math.round(elapsedMs * 10) / 10,
      });
    });

    next();
  };
}

module.exports = { requestLogger, pathOf };
