const { UnauthorizedError } = require('../../../domain/errors');

/**
 * Middleware de autenticação JWT (Definition of Done, item 3).
 * Exige o cabeçalho "Authorization: Bearer <token>" e popula req.auth.
 */
function authenticate({ tokenService }) {
  return (req, _res, next) => {
    const header = req.get('authorization') ?? '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return next(new UnauthorizedError('Token de autenticação ausente.'));
    }

    try {
      const payload = tokenService.verify(token);
      req.auth = { userId: Number(payload.sub), email: payload.email };
      return next();
    } catch {
      return next(new UnauthorizedError('Token inválido ou expirado.'));
    }
  };
}

module.exports = { authenticate };
