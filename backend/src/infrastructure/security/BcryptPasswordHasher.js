const bcrypt = require('bcrypt');

class BcryptPasswordHasher {
  constructor(rounds = 10) {
    this.rounds = rounds;
  }

  hash(password) {
    return bcrypt.hash(password, this.rounds);
  }

  compare(password, hash) {
    return bcrypt.compare(password, hash);
  }
}

module.exports = BcryptPasswordHasher;
