import {describe, expect, it} from '@jest/globals';
import SQLite, {type SQLiteDatabase} from 'react-native-sqlite-storage';

import {
  LATEST_VERSION,
  MIGRATIONS,
  runMigrations,
  type Migration,
} from '../src/data/database/migrations';
import {criarBancoReal} from '../test-utils/bancoReal';

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
    await expect(runMigrations(db, MIGRATIONS.slice(0, 3))).resolves.toBe(3);
    expect(db.userVersion).toBe(3);
    expect(db.executed).toEqual([
      'PRAGMA user_version',
      ...v3.statements,
      'PRAGMA user_version = 3',
    ]);
  });

  it('a migração v4 cria cofres e movimentos sem alterar as anteriores e um banco na v3 roda só a v4', async () => {
    const v4 = MIGRATIONS[3];
    expect(v4.version).toBe(4);
    const [cofres, movimentos, indice] = v4.statements;
    expect(cofres).toMatch(/CREATE TABLE IF NOT EXISTS cofres/);
    expect(cofres).toMatch(/length\(trim\(nome\)\) BETWEEN 1 AND 30/);
    expect(cofres).toMatch(/meta_centavos IS NULL OR/);
    expect(movimentos).toMatch(/CREATE TABLE IF NOT EXISTS movimentos_cofre/);
    expect(movimentos).toMatch(/REFERENCES cofres\(id\) ON DELETE CASCADE/);
    expect(movimentos).toMatch(/tipo IN \('deposito', 'retirada'\)/);
    expect(movimentos).toMatch(/valor_centavos > 0/);
    expect(indice).toBe(
      'CREATE INDEX IF NOT EXISTS idx_movimentos_cofre ON movimentos_cofre (cofre_id)',
    );
    expect(
      MIGRATIONS.slice(0, 3)
        .flatMap(m => m.statements)
        .join('\n'),
    ).not.toMatch(/cofre/);

    const db = createDb(3);
    await expect(runMigrations(db, MIGRATIONS.slice(0, 4))).resolves.toBe(4);
    expect(db.userVersion).toBe(4);
    expect(db.executed).toEqual([
      'PRAGMA user_version',
      ...v4.statements,
      'PRAGMA user_version = 4',
    ]);
  });

  it('a migração v5 só cria o índice de duplicatas e um banco na v4 roda só a v5', async () => {
    const v5 = MIGRATIONS[4];
    expect(v5.version).toBe(5);
    expect(v5.statements).toEqual([
      'CREATE INDEX IF NOT EXISTS idx_transacoes_duplicatas ON transacoes (tipo, valor_centavos, data)',
    ]);
    expect(
      MIGRATIONS.slice(0, 4)
        .flatMap(m => m.statements)
        .join('\n'),
    ).not.toMatch(/idx_transacoes_duplicatas/);

    const db = createDb(4);
    await expect(runMigrations(db, MIGRATIONS.slice(0, 5))).resolves.toBe(5);
    expect(db.userVersion).toBe(5);
    expect(db.executed).toEqual([
      'PRAGMA user_version',
      ...v5.statements,
      'PRAGMA user_version = 5',
    ]);
  });
});

describe('migração v6: orçamentos', () => {
  const inserirOrcamento = (
    db: SQLiteDatabase,
    categoria: string,
    limite: number,
  ) =>
    db.executeSql(
      'INSERT INTO orcamentos (categoria, limite_centavos) VALUES (?, ?)',
      [categoria, limite],
    );

  async function bancoMigrado() {
    const db = criarBancoReal();
    await runMigrations(db);
    return db;
  }

  it('cria as tabelas e o índice da soma do mês', async () => {
    const db = await bancoMigrado();
    const [resultado] = await db.executeSql(
      "SELECT name FROM sqlite_master WHERE name IN ('orcamentos', 'alertas_orcamento', 'idx_transacoes_orcamento')",
    );
    expect(resultado.rows.length).toBe(3);
  });

  it('atualiza um banco que já estava na v5', async () => {
    const db = criarBancoReal();
    await runMigrations(db, MIGRATIONS.slice(0, 5));
    await expect(runMigrations(db, MIGRATIONS.slice(0, 6))).resolves.toBe(6);
    await expect(inserirOrcamento(db, 'lazer', 1000)).resolves.toBeDefined();
  });

  it('preenche criado_em e atualizado_em no formato das outras tabelas', async () => {
    const db = await bancoMigrado();
    await inserirOrcamento(db, 'lazer', 1000);
    const [resultado] = await db.executeSql(
      'SELECT criado_em, atualizado_em FROM orcamentos',
    );
    const linha = resultado.rows.item(0);
    expect(linha.criado_em).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
    expect(linha.atualizado_em).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
  });

  it('rejeita limite zero, negativo e quebrado', async () => {
    const db = await bancoMigrado();
    await expect(inserirOrcamento(db, 'lazer', 0)).rejects.toThrow(/CHECK/);
    await expect(inserirOrcamento(db, 'lazer', -1)).rejects.toThrow(/CHECK/);
    await expect(inserirOrcamento(db, 'lazer', 10.5)).rejects.toThrow(/CHECK/);
  });

  it('rejeita categoria repetida', async () => {
    const db = await bancoMigrado();
    await inserirOrcamento(db, 'lazer', 1000);
    await expect(inserirOrcamento(db, 'lazer', 2000)).rejects.toThrow(/UNIQUE/);
  });

  it('só aceita alertas de nível 80 e 100', async () => {
    const db = await bancoMigrado();
    await expect(
      db.executeSql(
        'INSERT INTO alertas_orcamento (categoria, ano_mes, nivel) VALUES (?, ?, ?)',
        ['lazer', '2026-11', 50],
      ),
    ).rejects.toThrow(/CHECK/);
  });
});

describe('migração v7: prazo das metas', () => {
  const inserirCofre = (db: SQLiteDatabase, prazo: string | null) =>
    db.executeSql(
      'INSERT INTO cofres (nome, icone, cor, meta_centavos, prazo) VALUES (?, ?, ?, ?, ?)',
      ['Viagem', '✈️', '#64B5F6', 800000, prazo],
    );

  it('um cofre antigo continua com prazo NULL', async () => {
    const db = criarBancoReal();
    await runMigrations(db, MIGRATIONS.slice(0, 6));
    await db.executeSql(
      'INSERT INTO cofres (nome, icone, cor, meta_centavos) VALUES (?, ?, ?, ?)',
      ['Antigo', '💰', '#39FF84', 1000],
    );

    await expect(runMigrations(db, MIGRATIONS.slice(0, 7))).resolves.toBe(7);

    const [resultado] = await db.executeSql(
      'SELECT nome, meta_centavos, prazo FROM cofres',
    );
    expect(resultado.rows.item(0)).toMatchObject({
      nome: 'Antigo',
      meta_centavos: 1000,
      prazo: null,
    });
  });

  it('aceita prazo válido e NULL', async () => {
    const db = criarBancoReal();
    await runMigrations(db);
    await expect(inserirCofre(db, '2026-12')).resolves.toBeDefined();
    await expect(inserirCofre(db, null)).resolves.toBeDefined();
  });

  it.each([['2026-1'], ['26-12'], ['dez-2026']])(
    'rejeita o prazo "%s"',
    async prazo => {
      const db = criarBancoReal();
      await runMigrations(db);
      await expect(inserirCofre(db, prazo)).rejects.toThrow(/CHECK/);
    },
  );
});

describe('migração v8: contas recorrentes', () => {
  const inserirConta = (
    db: SQLiteDatabase,
    frequencia = 'mensal',
    mes: number | null = null,
  ) =>
    db.executeSql(
      `INSERT INTO contas_recorrentes
        (descricao, valor_centavos, categoria, frequencia, dia, mes, proxima)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['Internet', 9990, 'outros', frequencia, 10, mes, '2026-12-10'],
    );

  const inserirTransacao = (
    db: SQLiteDatabase,
    contaId: number | null,
    data = '2026-12-10',
  ) =>
    db.executeSql(
      `INSERT INTO transacoes
        (tipo, descricao, valor_centavos, data, categoria, conta_recorrente_id)
        VALUES ('despesa', 'Internet', 9990, ?, 'outros', ?)`,
      [data, contaId],
    );

  async function bancoMigrado() {
    const db = criarBancoReal();
    await runMigrations(db);
    return db;
  }

  it('é a versão mais recente', () => {
    expect(LATEST_VERSION).toBe(8);
  });

  it('cria a tabela com os padrões e a coluna nova nas transações', async () => {
    const db = await bancoMigrado();
    await inserirConta(db);
    await inserirTransacao(db, 1);

    const [conta] = await db.executeSql(
      'SELECT lembrar_dias_antes, ativa, criado_em FROM contas_recorrentes',
    );
    expect(conta.rows.item(0)).toMatchObject({
      lembrar_dias_antes: 2,
      ativa: 1,
    });
    expect(conta.rows.item(0).criado_em).toMatch(
      /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/,
    );

    const [transacao] = await db.executeSql(
      'SELECT conta_recorrente_id FROM transacoes',
    );
    expect(transacao.rows.item(0).conta_recorrente_id).toBe(1);
  });

  it('migra um banco com transações, que ficam sem vínculo', async () => {
    const db = criarBancoReal();
    await runMigrations(db, MIGRATIONS.slice(0, 7));
    await db.executeSql(
      `INSERT INTO transacoes (tipo, descricao, valor_centavos, data)
        VALUES ('despesa', 'Antiga', 100, '2026-01-01')`,
    );

    await runMigrations(db);

    const [resultado] = await db.executeSql(
      'SELECT conta_recorrente_id FROM transacoes',
    );
    expect(resultado.rows.item(0).conta_recorrente_id).toBeNull();
  });

  it('o índice único impede a mesma conta na mesma data', async () => {
    const db = await bancoMigrado();
    await inserirConta(db);
    await inserirTransacao(db, 1);

    await expect(inserirTransacao(db, 1)).rejects.toThrow(/UNIQUE/);
    await expect(inserirTransacao(db, 1, '2027-01-10')).resolves.toBeDefined();
  });

  it('o índice não afeta lançamentos sem conta', async () => {
    const db = await bancoMigrado();
    await inserirTransacao(db, null);
    await expect(inserirTransacao(db, null)).resolves.toBeDefined();
  });

  it('excluir a conta mantém as transações com vínculo NULL', async () => {
    const db = await bancoMigrado();
    await inserirConta(db);
    await inserirTransacao(db, 1);

    await db.executeSql('DELETE FROM contas_recorrentes WHERE id = ?', [1]);

    const [resultado] = await db.executeSql(
      'SELECT descricao, conta_recorrente_id FROM transacoes',
    );
    expect(resultado.rows.item(0)).toMatchObject({
      descricao: 'Internet',
      conta_recorrente_id: null,
    });
  });

  it('exige o mês só na conta anual', async () => {
    const db = await bancoMigrado();
    await expect(inserirConta(db, 'anual', null)).rejects.toThrow(/CHECK/);
    await expect(inserirConta(db, 'mensal', 3)).rejects.toThrow(/CHECK/);
    await expect(inserirConta(db, 'anual', 13)).rejects.toThrow(/CHECK/);
    await expect(inserirConta(db, 'anual', 3)).resolves.toBeDefined();
  });

  it('rejeita lembrete fora da lista e dia inválido', async () => {
    const db = await bancoMigrado();
    const inserir = (dia: number, lembrete: number) =>
      db.executeSql(
        `INSERT INTO contas_recorrentes
          (descricao, valor_centavos, categoria, frequencia, dia,
           lembrar_dias_antes, proxima)
          VALUES ('Conta', 100, 'outros', 'mensal', ?, ?, '2026-12-10')`,
        [dia, lembrete],
      );
    await expect(inserir(10, 4)).rejects.toThrow(/CHECK/);
    await expect(inserir(32, 2)).rejects.toThrow(/CHECK/);
  });
});
