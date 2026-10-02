import {describe, expect, it} from '@jest/globals';
import SQLite, {type SQLiteDatabase} from 'react-native-sqlite-storage';

import {
  LATEST_VERSION,
  MIGRATIONS,
  runMigrations,
  type Migration,
} from '../src/data/database/migrations';

type MockDatabase = SQLiteDatabase & {userVersion: number; executed: string[]};

const createDb = (userVersion = 0) =>
  (
    SQLite as unknown as {createMockDatabase: (o: object) => MockDatabase}
  ).createMockDatabase({
    userVersion,
  });

describe('runMigrations', () => {
  it('aplica todas as migrações em um banco novo e atualiza o user_version', async () => {
    const db = createDb();
    await expect(runMigrations(db)).resolves.toBe(LATEST_VERSION);
    expect(db.userVersion).toBe(LATEST_VERSION);
    expect(
      db.executed.some(sql =>
        sql.includes('CREATE TABLE IF NOT EXISTS transacoes'),
      ),
    ).toBe(true);
  });

  it('não reaplica migrações já executadas', async () => {
    const db = createDb(LATEST_VERSION);
    await runMigrations(db);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('aplica somente as migrações pendentes, em ordem', async () => {
    const migrations: Migration[] = [
      {version: 1, description: 'um', statements: ['SQL 1']},
      {version: 2, description: 'dois', statements: ['SQL 2']},
      {version: 3, description: 'três', statements: ['SQL 3']},
    ];
    const db = createDb(1);
    await expect(runMigrations(db, migrations)).resolves.toBe(3);
    expect(db.executed.filter(sql => sql.startsWith('SQL'))).toEqual([
      'SQL 2',
      'SQL 3',
    ]);
  });

  it('recusa um banco mais novo que o app', async () => {
    const db = createDb(LATEST_VERSION + 1);
    await expect(runMigrations(db)).rejects.toThrow(/mais nova/);
  });

  it('exige migrações sequenciais', async () => {
    const db = createDb();
    await expect(
      runMigrations(db, [
        {version: 2, description: 'fora de ordem', statements: []},
      ]),
    ).rejects.toThrow(/sequenciais/);
  });

  it('a tabela transacoes impede valores negativos e tipos inválidos', () => {
    const [createTable] = MIGRATIONS[0].statements;
    expect(createTable).toMatch(/valor_centavos >= 0/);
    expect(createTable).toMatch(/tipo IN \('receita', 'despesa'\)/);
  });

  it('a migração v2 adiciona categoria e recorrência sem alterar a v1', async () => {
    const v2 = MIGRATIONS[1];
    expect(v2.version).toBe(2);
    expect(v2.statements).toEqual([
      "ALTER TABLE transacoes ADD COLUMN categoria TEXT NOT NULL DEFAULT 'outros'",
      "ALTER TABLE transacoes ADD COLUMN recorrencia TEXT NOT NULL DEFAULT 'variavel' CHECK (recorrencia IN ('fixa', 'variavel'))",
    ]);
    expect(MIGRATIONS[0].statements.join('\n')).not.toMatch(
      /categoria|recorrencia/,
    );

    const db = createDb(1);
    await expect(runMigrations(db, MIGRATIONS.slice(0, 2))).resolves.toBe(2);
    expect(db.userVersion).toBe(2);
    expect(db.executed).toEqual([
      'PRAGMA user_version',
      ...v2.statements,
      'PRAGMA user_version = 2',
    ]);
  });

  it('a migração v3 adiciona comprovante_uri (pode ser NULL) e um banco na v2 roda só a v3', async () => {
    const v3 = MIGRATIONS[2];
    expect(v3.version).toBe(3);
    expect(v3.statements).toEqual([
      'ALTER TABLE transacoes ADD COLUMN comprovante_uri TEXT',
    ]);
    expect(
      MIGRATIONS.slice(0, 2)
        .flatMap(m => m.statements)
        .join('\n'),
    ).not.toMatch(/comprovante/);

    const db = createDb(2);
    await expect(runMigrations(db)).resolves.toBe(3);
    expect(db.userVersion).toBe(3);
    expect(db.executed).toEqual([
      'PRAGMA user_version',
      ...v3.statements,
      'PRAGMA user_version = 3',
    ]);
  });
});
