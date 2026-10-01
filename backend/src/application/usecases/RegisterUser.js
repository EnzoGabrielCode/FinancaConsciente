const { User } = require('../../domain/entities/User');
const { ConflictError } = require('../../domain/errors');

/**
 * Cadastra um novo usuário com a senha armazenada como hash.
 * Dependências (portas): userRepository { findByEmail, create }, passwordHasher { hash }.
 */
class RegisterUser {
  constructor({ userRepository, passwordHasher }) {
    this.userRepository = userRepository;
    this.passwordHasher = passwordHasher;
  }

  async execute(input) {
    const { name, email, password } = User.validateRegistration(input ?? {});

    if (this.userRepository.findByEmail(email)) {
      throw new ConflictError('E-mail já cadastrado.');
    }

    const passwordHash = await this.passwordHasher.hash(password);
    const user = this.userRepository.create({ name, email, passwordHash });
    return user.toPublic();
  }
}

module.exports = { RegisterUser };
