const { User } = require('../../domain/entities/User');
const { ValidationError, UnauthorizedError } = require('../../domain/errors');

const INVALID_CREDENTIALS = 'E-mail ou senha inválidos.';

/**
 * Autentica por e-mail e senha e emite um token de acesso.
 * Dependências (portas): userRepository { findByEmail },
 * passwordHasher { compare, dummyCompare }, tokenService { sign }.
 */
class AuthenticateUser {
  constructor({ userRepository, passwordHasher, tokenService }) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
    this.tokenService = tokenService;
  }

  async execute({ email, password } = {}) {
    const normalizedEmail = User.normalizeEmail(email);
    const errors = {};
    if (!normalizedEmail) errors.email = 'E-mail é obrigatório.';
    if (typeof password !== 'string' || password.length === 0) {
      errors.password = 'Senha é obrigatória.';
    }
    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Dados de login inválidos.', errors);
    }

    const user = this.userRepository.findByEmail(normalizedEmail);
    if (!user) {
      // Mantém o tempo de resposta parecido com o de um usuário existente,
      // dificultando descobrir quais e-mails estão cadastrados.
      await this.passwordHasher.dummyCompare(password);
      throw new UnauthorizedError(INVALID_CREDENTIALS);
    }

    const passwordMatches = await this.passwordHasher.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedError(INVALID_CREDENTIALS);
    }

    const { token, expiresIn } = this.tokenService.sign({ sub: String(user.id), email: user.email });
    return { token, tokenType: 'Bearer', expiresIn, user: user.toPublic() };
  }
}

module.exports = { AuthenticateUser };
