const AppError = require('../../../domain/errors/AppError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido.' });
  }
  console.error(err);
  return res.status(500).json({ error: 'Erro interno do servidor.' });
}

module.exports = errorHandler;
