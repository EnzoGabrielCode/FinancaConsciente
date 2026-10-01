/**
 * Erros de domínio. Não conhecem HTTP: a camada de interface é quem
 * traduz cada tipo para o status adequado (ver errorHandler).
 */
class DomainError extends Error {
  constructor(message, details) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}

class ValidationError extends DomainError {}
class ConflictError extends DomainError {}
class UnauthorizedError extends DomainError {}
class NotFoundError extends DomainError {}

module.exports = {
  DomainError,
  ValidationError,
  ConflictError,
  UnauthorizedError,
  NotFoundError,
};
