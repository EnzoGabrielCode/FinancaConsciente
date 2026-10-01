const { User } = require('../../domain/entities/User');
const { ConflictError } = require('../../domain/errors');

function toEntity(row) {
  if (!row) return null;
  return new User({
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  });
}

class SqliteUserRepository {
  constructor(db) {
    this.statements = {
      findByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
      findById: db.prepare('SELECT * FROM users WHERE id = ?'),
      insert: db.prepare(
        'INSERT INTO users (name, email, password_hash) VALUES (@name, @email, @passwordHash) RETURNING *',
      ),
    };
  }

  findByEmail(email) {
    return toEntity(this.statements.findByEmail.get(email));
  }

  findById(id) {
    return toEntity(this.statements.findById.get(id));
  }

  create({ name, email, passwordHash }) {
    try {
      return toEntity(this.statements.insert.get({ name, email, passwordHash }));
    } catch (err) {
      // Cobre a corrida entre a checagem de duplicidade e o INSERT.
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new ConflictError('E-mail já cadastrado.');
      }
      throw err;
    }
  }
}

module.exports = { SqliteUserRepository };
