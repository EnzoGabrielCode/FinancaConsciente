const AppError = require('../errors/AppError');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class User {
  constructor({ id, name, email, passwordHash, createdAt }) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.passwordHash = passwordHash;
    this.createdAt = createdAt;
  }

  static validateRegistration({ name, email, password }) {
    if (!name || !name.trim()) throw new AppError('Nome é obrigatório.');
    if (!email || !EMAIL_REGEX.test(email)) throw new AppError('E-mail inválido.');
    if (!password || password.length < 8) {
      throw new AppError('A senha deve ter pelo menos 8 caracteres.');
    }
  }

  toJSON() {
    return { id: this.id, name: this.name, email: this.email, createdAt: this.createdAt };
  }
}

module.exports = User;
