const { NotFoundError } = require('../../domain/errors');

/** Retorna os dados públicos do usuário autenticado. */
class GetCurrentUser {
  constructor({ userRepository }) {
    this.userRepository = userRepository;
  }

  async execute({ userId }) {
    const user = this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('Usuário não encontrado.');
    }
    return user.toPublic();
  }
}

module.exports = { GetCurrentUser };
