const AppError = require('../../../domain/errors/AppError');

function ensureAuthenticated(tokenService) {
  return (req, _res, next) => {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      return next(new AppError('Token não informado.', 401));
    }
    try {
      const { sub } = tokenService.verify(token);
      req.userId = sub;
      return next();
    } catch {
      return next(new AppError('Token inválido ou expirado.', 401));
    }
  };
}

module.exports = ensureAuthenticated;
