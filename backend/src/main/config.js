require('dotenv').config();

const config = {
  port: Number(process.env.PORT) || 3333,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  databasePath: process.env.DATABASE_PATH || './data/financaconsciente.db',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 10,
};

if (!config.jwtSecret) {
  throw new Error('JWT_SECRET não definido. Copie .env.example para .env e preencha.');
}

module.exports = config;
