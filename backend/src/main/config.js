const path = require('node:path');

/**
 * Lê a configuração das variáveis de ambiente (arquivo .env em dev).
 * Falha cedo se algo obrigatório estiver ausente ou inválido.
 */
function loadConfig(env = process.env) {
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET deve estar definido no .env e ter no mínimo 32 caracteres.');
  }

  const bcryptRounds = Number(env.BCRYPT_ROUNDS ?? 12);
  if (!Number.isInteger(bcryptRounds) || bcryptRounds < 10 || bcryptRounds > 15) {
    throw new Error('BCRYPT_ROUNDS deve ser um inteiro entre 10 e 15.');
  }

  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('PORT deve ser um inteiro positivo.');
  }

  return {
    port,
    jwtSecret,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '1h',
    databasePath: env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'financaconsciente.db'),
    bcryptRounds,
  };
}

module.exports = { loadConfig };
