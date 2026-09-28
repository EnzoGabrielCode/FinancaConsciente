// Composition root: único lugar que conhece todas as implementações concretas.
const { openDatabase } = require('../infrastructure/database/sqlite');
const SqliteUserRepository = require('../infrastructure/repositories/SqliteUserRepository');
const BcryptPasswordHasher = require('../infrastructure/security/BcryptPasswordHasher');
const JwtTokenService = require('../infrastructure/security/JwtTokenService');
const RegisterUser = require('../application/usecases/RegisterUser');
const AuthenticateUser = require('../application/usecases/AuthenticateUser');
const AuthController = require('../interfaces/http/controllers/AuthController');
const ensureAuthenticated = require('../interfaces/http/middlewares/ensureAuthenticated');
const createApp = require('../interfaces/http/app');

function buildApp({ databasePath, jwtSecret, jwtExpiresIn, bcryptRounds }) {
  const db = openDatabase(databasePath);
  const userRepository = new SqliteUserRepository(db);
  const passwordHasher = new BcryptPasswordHasher(bcryptRounds);
  const tokenService = new JwtTokenService({ secret: jwtSecret, expiresIn: jwtExpiresIn });

  const authController = new AuthController({
    registerUser: new RegisterUser({ userRepository, passwordHasher }),
    authenticateUser: new AuthenticateUser({ userRepository, passwordHasher, tokenService }),
  });

  const app = createApp({
    authController,
    userRepository,
    authMiddleware: ensureAuthenticated(tokenService),
  });

  return { app, db };
}

module.exports = { buildApp };
