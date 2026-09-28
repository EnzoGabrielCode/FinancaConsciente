const User = require('../../domain/entities/User');
const AppError = require('../../domain/errors/AppError');

class RegisterUser {
  constructor({ userRepository, passwordHasher }) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
  }

  async execute({ name, email, password }) {
    User.validateRegistration({ name, email, password });
    const normalizedEmail = email.trim().toLowerCase();

    if (this.userRepository.findByEmail(normalizedEmail)) {
      throw new AppError('E-mail já cadastrado.', 409);
    }

    const passwordHash = await this.passwordHasher.hash(password);
    return this.userRepository.create({ name: name.trim(), email: normalizedEmail, passwordHash });
  }
}

module.exports = RegisterUser;
