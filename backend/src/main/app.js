const express = require('express');
const helmet = require('helmet');

const { createDatabase } = require('../infrastructure/database/sqlite');
const { SqliteUserRepository } = require('../infrastructure/repositories/SqliteUserRepository');
const { BcryptPasswordHasher } = require('../infrastructure/security/BcryptPasswordHasher');
const { JwtTokenService } = require('../infrastructure/security/JwtTokenService');
const { RegisterUser } = require('../application/usecases/RegisterUser');
const { AuthenticateUser } = require('../application/usecases/AuthenticateUser');
const { GetCurrentUser } = require('../application/usecases/GetCurrentUser');
const { AuthController } = require('../interfaces/http/controllers/AuthController');
const { UserController } = require('../interfaces/http/controllers/UserController');
const { authenticate } = require('../interfaces/http/middlewares/authenticate');
const { notFound, errorHandler } = require('../interfaces/http/middlewares/errorHandler');
const { createRoutes } = require('../interfaces/http/routes');

/**
 * Composition root: instancia as dependências de cada camada e monta o app.
 * Retorna também o banco para que o chamador (server ou testes) possa fechá-lo.
 */
function createApp(config) {
  const db = createDatabase(config.databasePath);

  const userRepository = new SqliteUserRepository(db);
  const passwordHasher = new BcryptPasswordHasher({ rounds: config.bcryptRounds });
  const tokenService = new JwtTokenService({
    secret: config.jwtSecret,
    expiresIn: config.jwtExpiresIn,
  });

  const authController = new AuthController({
    registerUser: new RegisterUser({ userRepository, passwordHasher }),
    authenticateUser: new AuthenticateUser({ userRepository, passwordHasher, tokenService }),
  });
  const userController = new UserController({
    getCurrentUser: new GetCurrentUser({ userRepository }),
  });

  const app = express();
  app.disable('x-powered-by');

  // RNF03: HTTPS estrito. O HSTS instrui o cliente a só usar HTTPS por 1 ano.
  // Em produção a API deve ficar atrás de TLS (proxy reverso ou https.createServer).
  app.use(
    helmet({
      strictTransportSecurity: {
        maxAge: 31536000,
        includeSubDomains: true,
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.use(
    '/api',
    createRoutes({
      authController,
      userController,
      requireAuth: authenticate({ tokenService }),
    }),
  );

  app.use(notFound);
  app.use(errorHandler);

  return { app, db };
}

module.exports = { createApp };
