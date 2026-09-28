const bcrypt = require('bcrypt');

class BcryptPasswordHasher {
  constructor({ rounds }) {
    this.rounds = rounds;
    // Hash fixo usado para equalizar o tempo de login quando o e-mail não existe.
    this.dummyHash = bcrypt.hashSync('financaconsciente-dummy-password', rounds);
  }

  hash(plainPassword) {
    return bcrypt.hash(plainPassword, this.rounds);
  }

  compare(plainPassword, passwordHash) {
    return bcrypt.compare(plainPassword, passwordHash);
  }

  async dummyCompare(plainPassword) {
    await bcrypt.compare(plainPassword, this.dummyHash);
    return false;
  }
}

module.exports = { BcryptPasswordHasher };
