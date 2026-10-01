const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`;

/**
 * Abre (ou cria) o banco SQLite e garante que o schema exista.
 * Use ':memory:' para um banco descartável (testes).
 */
function createDatabase(databasePath) {
  const inMemory = databasePath === ':memory:';
  if (!inMemory) {
    fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });
  }

  const db = new Database(databasePath);
  db.pragma('foreign_keys = ON');
  if (!inMemory) {
    db.pragma('journal_mode = WAL');
  }
  db.exec(SCHEMA);
  return db;
}

module.exports = { createDatabase };
