const AppError = require('../../domain/errors/AppError');

class AuthenticateUser {
  constructor({ userRepository, passwordHasher, tokenService }) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
    this.tokenService = tokenService;
  }

  async execute({ email, password }) {
    if (!email || !password) throw new AppError('Informe e-mail e senha.');

    const user = this.userRepository.findByEmail(email.trim().toLowerCase());
    const valid = user && (await this.passwordHasher.compare(password, user.passwordHash));
    if (!valid) throw new AppError('E-mail ou senha incorretos.', 401);

    const token = this.tokenService.sign({ sub: user.id });
    return { user, token };
  }
}

module.exports = AuthenticateUser;
