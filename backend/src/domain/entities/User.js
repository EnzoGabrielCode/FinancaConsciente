const { ValidationError } = require('../errors');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // limite de bytes processados pelo bcrypt

class User {
  constructor({ id, name, email, passwordHash, createdAt }) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.passwordHash = passwordHash;
    this.createdAt = createdAt;
  }

  static normalizeEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
  }

  /**
   * Valida os dados de cadastro e devolve os valores normalizados.
   * Lança ValidationError com a lista de campos inválidos.
   */
  static validateRegistration({ name, email, password }) {
    const errors = {};
    const normalizedName = typeof name === 'string' ? name.trim() : '';
    const normalizedEmail = User.normalizeEmail(email);

    if (!normalizedName) {
      errors.name = 'Nome é obrigatório.';
    } else if (normalizedName.length > 100) {
      errors.name = 'Nome deve ter no máximo 100 caracteres.';
    }

    if (!normalizedEmail) {
      errors.email = 'E-mail é obrigatório.';
    } else if (!EMAIL_REGEX.test(normalizedEmail) || normalizedEmail.length > 254) {
      errors.email = 'E-mail inválido.';
    }

    if (typeof password !== 'string' || password.length === 0) {
      errors.password = 'Senha é obrigatória.';
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres.`;
    } else if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_LENGTH) {
      errors.password = `Senha deve ter no máximo ${MAX_PASSWORD_LENGTH} bytes.`;
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError('Dados de cadastro inválidos.', errors);
    }

    return { name: normalizedName, email: normalizedEmail, password };
  }

  /** Representação segura para respostas da API (nunca expõe o hash). */
  toPublic() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      createdAt: this.createdAt,
    };
  }
}

module.exports = { User, MIN_PASSWORD_LENGTH };
