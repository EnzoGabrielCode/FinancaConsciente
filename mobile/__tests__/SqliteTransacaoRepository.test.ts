import {beforeEach, describe, expect, it} from '@jest/globals';
import SQLite, {type SQLiteDatabase} from 'react-native-sqlite-storage';

import {SqliteTransacaoRepository} from '../src/data/repositories/SqliteTransacaoRepository';
import type {DadosTransacao} from '../src/domain/entities/Transacao';

type MockDatabase = SQLiteDatabase & {
  executeSql: {mock: {calls: unknown[][]}};
};

const createDb = () =>
  (
    SQLite as unknown as {createMockDatabase: () => MockDatabase}
  ).createMockDatabase();

const dados: DadosTransacao = {
  tipo: 'receita',
  valorCentavos: 120000,
  categoria: 'salario',
  descricao: 'Salário',
  data: '2026-09-30',
  recorrencia: 'fixa',
};

const normalizar = (sql: unknown) => String(sql).replace(/\s+/g, ' ').trim();

describe('SqliteTransacaoRepository', () => {
  let db: MockDatabase;
  let repositorio: SqliteTransacaoRepository;

  const ultimaChamada = () => {
    const [sql, parametros] = db.executeSql.mock.calls.at(-1) as [
      string,
      unknown[],
    ];
    return {sql: normalizar(sql), parametros};
  };

  beforeEach(() => {
    db = createDb();
    repositorio = new SqliteTransacaoRepository(async () => db);
  });

  it('cria com INSERT parametrizado e devolve o id', async () => {
    await expect(repositorio.criar(dados)).resolves.toBe(1);
    expect(ultimaChamada()).toEqual({
      sql: 'INSERT INTO transacoes (tipo, descricao, valor_centavos, data, categoria, recorrencia, sincronizado) VALUES (?, ?, ?, ?, ?, ?, 0)',
      parametros: [
        'receita',
        'Salário',
        120000,
        '2026-09-30',
        'salario',
        'fixa',
      ],
    });
  });

  it('atualiza pelo id e marca como não sincronizado', async () => {
    await repositorio.atualizar(7, {...dados, valorCentavos: 130000});
    expect(ultimaChamada()).toEqual({
      sql: 'UPDATE transacoes SET tipo = ?, descricao = ?, valor_centavos = ?, data = ?, categoria = ?, recorrencia = ?, sincronizado = 0 WHERE id = ?',
      parametros: [
        'receita',
        'Salário',
        130000,
        '2026-09-30',
        'salario',
        'fixa',
        7,
      ],
    });
  });

  it('exclui pelo id', async () => {
    await repositorio.excluir(7);
    expect(ultimaChamada()).toEqual({
      sql: 'DELETE FROM transacoes WHERE id = ?',
      parametros: [7],
    });
  });

  it('nunca concatena os valores no SQL', async () => {
    const malicioso = {...dados, descricao: "x'); DROP TABLE transacoes; --"};
    await repositorio.criar(malicioso);
    await repositorio.atualizar(1, malicioso);
    for (const [sql] of db.executeSql.mock.calls) {
      expect(String(sql)).not.toContain('DROP TABLE');
    }
  });

  it('lista as recentes com limite parametrizado', async () => {
    await expect(repositorio.listarRecentes(20)).resolves.toEqual([]);
    const {sql, parametros} = ultimaChamada();
    expect(sql).toMatch(/ORDER BY data DESC, id DESC LIMIT \?$/);
    expect(parametros).toEqual([20]);
  });

  it('soma as receitas do mês', async () => {
    await expect(repositorio.totalReceitasDoMes('2026-09')).resolves.toBe(0);
    const {sql, parametros} = ultimaChamada();
    expect(sql).toMatch(/SUM\(valor_centavos\)/);
    expect(parametros).toEqual(['receita', '2026-09-01', '2026-09-31']);
    await expect(
      repositorio.totalReceitasDoMes("2026-09' OR 1=1"),
    ).rejects.toThrow(/Mês inválido/);
  });
});
