import type {SQLiteDatabase} from 'react-native-sqlite-storage';

export interface Migration {
  version: number;
  description: string;
  statements: string[];
}

/**
 * Migrações versionadas do banco local. A versão aplicada fica em
 * PRAGMA user_version. Nunca altere uma migração já publicada:
 * crie uma nova com a próxima versão.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Cria a tabela de transações',
    statements: [
      `CREATE TABLE IF NOT EXISTS transacoes (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo           TEXT    NOT NULL CHECK (tipo IN ('receita', 'despesa')),
        descricao      TEXT    NOT NULL CHECK (length(trim(descricao)) > 0),
        valor_centavos INTEGER NOT NULL
                               CHECK (typeof(valor_centavos) = 'integer' AND valor_centavos >= 0),
        data           TEXT    NOT NULL,
        sincronizado   INTEGER NOT NULL DEFAULT 0 CHECK (sincronizado IN (0, 1)),
        criado_em      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      )`,
      'CREATE INDEX IF NOT EXISTS idx_transacoes_data ON transacoes (data)',
      'CREATE INDEX IF NOT EXISTS idx_transacoes_sincronizado ON transacoes (sincronizado)',
    ],
  },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export async function getSchemaVersion(db: SQLiteDatabase): Promise<number> {
  const [result] = await db.executeSql('PRAGMA user_version');
  return result.rows.item(0).user_version as number;
}

/**
 * Aplica, em ordem, as migrações com versão maior que a atual.
 * Cada migração roda em sua própria transação junto com a atualização
 * do user_version, então uma falha não deixa o schema pela metade.
 * Retorna a versão final do schema.
 */
export async function runMigrations(
  db: SQLiteDatabase,
  migrations: Migration[] = MIGRATIONS,
): Promise<number> {
  migrations.forEach((migration, index) => {
    if (migration.version !== index + 1) {
      throw new Error(
        `Migrações devem ser sequenciais a partir de 1 (encontrada versão ${migration.version} na posição ${index}).`,
      );
    }
  });

  const latest = migrations.length;
  let current = await getSchemaVersion(db);

  if (current > latest) {
    throw new Error(
      `O banco local está na versão ${current}, mais nova que a suportada pelo app (${latest}).`,
    );
  }

  for (const migration of migrations.slice(current)) {
    await db.transaction(tx => {
      migration.statements.forEach(sql => tx.executeSql(sql));
      tx.executeSql(`PRAGMA user_version = ${migration.version}`);
    });
    current = migration.version;
  }

  return current;
}
