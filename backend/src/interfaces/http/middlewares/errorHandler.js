const {
  ValidationError,
  ConflictError,
  UnauthorizedError,
  NotFoundError,
} = require('../../../domain/errors');

const STATUS_BY_ERROR = new Map([
  [ValidationError, 400],
  [UnauthorizedError, 401],
  [NotFoundError, 404],
  [ConflictError, 409],
]);

function statusFor(err) {
  for (const [ErrorType, status] of STATUS_BY_ERROR) {
    if (err instanceof ErrorType) return status;
  }
  return null;
}

function notFound(_req, res) {
  res.status(404).json({ error: 'Rota não encontrada.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  const status = statusFor(err);
  if (status) {
    return res.status(status).json({ error: err.message, details: err.details });
  }

  // JSON malformado no corpo da requisição (erro do express.json()).
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Corpo da requisição muito grande.' });
  }

  console.error(err);
  return res.status(500).json({ error: 'Erro interno do servidor.' });
}

module.exports = { notFound, errorHandler };
