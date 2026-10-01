const jwt = require('jsonwebtoken');

const ALGORITHM = 'HS256';

class JwtTokenService {
  constructor({ secret, expiresIn }) {
    this.secret = secret;
    this.expiresIn = expiresIn;
  }

  sign(payload) {
    const token = jwt.sign(payload, this.secret, {
      algorithm: ALGORITHM,
      expiresIn: this.expiresIn,
    });
    return { token, expiresIn: this.expiresIn };
  }

  /** Lança erro do jsonwebtoken se o token for inválido ou expirado. */
  verify(token) {
    return jwt.verify(token, this.secret, { algorithms: [ALGORITHM] });
  }
}

module.exports = { JwtTokenService };
