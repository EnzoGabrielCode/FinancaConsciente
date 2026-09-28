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
});
