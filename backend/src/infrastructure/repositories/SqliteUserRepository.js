const User = require('../../domain/entities/User');

function toEntity(row) {
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
    this.db = db;
  }

  findByEmail(email) {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    return row ? toEntity(row) : null;
  }

  findById(id) {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return row ? toEntity(row) : null;
  }

  create({ name, email, passwordHash }) {
    const { lastInsertRowid } = this.db
      .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
      .run(name, email, passwordHash);
    return this.findById(lastInsertRowid);
  }
}

module.exports = SqliteUserRepository;
