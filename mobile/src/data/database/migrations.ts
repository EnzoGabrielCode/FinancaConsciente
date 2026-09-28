/**
 * Cada item é uma versão do schema local. Nunca altere uma migração já
 * publicada: adicione uma nova ao final da lista.
 */
export const migrations: string[][] = [
  // v1: base offline-first para receitas e despesas (Sprint 1)
  [
    `CREATE TABLE IF NOT EXISTS transacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
      descricao TEXT NOT NULL,
      valor_centavos INTEGER NOT NULL CHECK (valor_centavos >= 0),
      data TEXT NOT NULL,
      sincronizado INTEGER NOT NULL DEFAULT 0,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  ],
];
