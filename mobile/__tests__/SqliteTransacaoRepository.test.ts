import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import SQLite, {type SQLiteDatabase} from 'react-native-sqlite-storage';

import {SqliteTransacaoRepository} from '../src/data/repositories/SqliteTransacaoRepository';
import type {DadosTransacao} from '../src/domain/entities/Transacao';

type MockDatabase = SQLiteDatabase & {
  executeSql: jest.Mock & {mock: {calls: unknown[][]}};
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
  comprovanteUri: null,
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
      sql: 'INSERT INTO transacoes (tipo, descricao, valor_centavos, data, categoria, recorrencia, comprovante_uri, sincronizado) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
      parametros: [
        'receita',
        'Salário',
        120000,
        '2026-09-30',
        'salario',
        'fixa',
        null,
      ],
    });
  });

  it('grava o comprovante_uri da despesa como parâmetro no INSERT', async () => {
    const uri = "file:///docs/comprovantes/it's.jpg";
    await repositorio.criar({
      ...dados,
      tipo: 'despesa',
      categoria: 'alimentacao',
      recorrencia: 'variavel',
      comprovanteUri: uri,
    });
    const {sql, parametros} = ultimaChamada();
    expect(sql).not.toContain(uri);
    expect(parametros.at(-1)).toBe(uri);
  });

  it('atualiza pelo id e marca como não sincronizado', async () => {
    await repositorio.atualizar(7, {...dados, valorCentavos: 130000});
    expect(ultimaChamada()).toEqual({
      sql: 'UPDATE transacoes SET tipo = ?, descricao = ?, valor_centavos = ?, data = ?, categoria = ?, recorrencia = ?, comprovante_uri = ?, sincronizado = 0 WHERE id = ?',
      parametros: [
        'receita',
        'Salário',
        130000,
        '2026-09-30',
        'salario',
        'fixa',
        null,
        7,
      ],
    });
  });

  it('atualiza o comprovante_uri com parâmetro', async () => {
    await repositorio.atualizar(7, {
      ...dados,
      tipo: 'despesa',
      comprovanteUri: 'file:///docs/comprovantes/novo.png',
    });
    expect(ultimaChamada().parametros.slice(-2)).toEqual([
      'file:///docs/comprovantes/novo.png',
      7,
    ]);
  });

  it('busca por id e mapeia comprovante_uri para comprovanteUri', async () => {
    const linha = {
      id: 3,
      tipo: 'despesa',
      descricao: 'Mercado',
      valor_centavos: 8990,
      data: '2026-09-28',
      categoria: 'alimentacao',
      recorrencia: 'variavel',
      comprovante_uri: 'file:///docs/comprovantes/a.jpg',
      sincronizado: 1,
    };
    db.executeSql.mockImplementationOnce(async () => [
      {rows: {length: 1, item: () => linha, raw: () => [linha]}},
    ]);

    await expect(repositorio.buscarPorId(3)).resolves.toEqual({
      id: 3,
      tipo: 'despesa',
      descricao: 'Mercado',
      valorCentavos: 8990,
      data: '2026-09-28',
      categoria: 'alimentacao',
      recorrencia: 'variavel',
      comprovanteUri: 'file:///docs/comprovantes/a.jpg',
      sincronizado: true,
    });
    const {sql, parametros} = ultimaChamada();
    expect(sql).toMatch(/comprovante_uri/);
    expect(sql).toMatch(/WHERE id = \?$/);
    expect(parametros).toEqual([3]);
  });

  it('buscarPorId devolve null quando não encontra', async () => {
    await expect(repositorio.buscarPorId(99)).resolves.toBeNull();
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

  const responderLinhas = (linhasRetornadas: object[]) =>
    db.executeSql.mockImplementationOnce(async () => [
      {
        rows: {
          length: linhasRetornadas.length,
          item: (i: number) => linhasRetornadas[i],
          raw: () => linhasRetornadas,
        },
      },
    ]);

  it('calcula o saldo até uma data com SQL parametrizado', async () => {
    responderLinhas([{saldo: '2462000'}]);

    await expect(repositorio.saldoAte('2026-10-02')).resolves.toBe(2462000);
    expect(ultimaChamada()).toEqual({
      sql: "SELECT COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor_centavos ELSE -valor_centavos END), 0) AS saldo FROM transacoes WHERE data <= ?",
      parametros: ['2026-10-02'],
    });
  });

  it('saldoAte devolve número negativo e 0 sem linhas', async () => {
    responderLinhas([{saldo: -15000}]);
    await expect(repositorio.saldoAte('2026-09-30')).resolves.toBe(-15000);
    await expect(repositorio.saldoAte('2026-09-30')).resolves.toBe(0);
  });

  it('saldoAte recusa data inválida sem ir ao banco', async () => {
    const chamadas = db.executeSql.mock.calls.length;
    await expect(repositorio.saldoAte("2026-10-02' OR 1=1")).rejects.toThrow(
      /Data inválida/,
    );
    expect(db.executeSql.mock.calls.length).toBe(chamadas);
  });

  it('agrupa os totais por mês com SQL parametrizado e converte para número', async () => {
    responderLinhas([
      {ano_mes: '2026-09', receitas: '850000', despesas: '324000'},
      {ano_mes: '2026-10', receitas: 0, despesas: 8990},
    ]);

    await expect(
      repositorio.totaisPorMes('2026-05', '2026-10'),
    ).resolves.toEqual([
      {anoMes: '2026-09', receitasCentavos: 850000, despesasCentavos: 324000},
      {anoMes: '2026-10', receitasCentavos: 0, despesasCentavos: 8990},
    ]);
    expect(ultimaChamada()).toEqual({
      sql: "SELECT substr(data, 1, 7) AS ano_mes, SUM(CASE WHEN tipo = 'receita' THEN valor_centavos ELSE 0 END) AS receitas, SUM(CASE WHEN tipo = 'despesa' THEN valor_centavos ELSE 0 END) AS despesas FROM transacoes WHERE substr(data, 1, 7) BETWEEN ? AND ? GROUP BY ano_mes ORDER BY ano_mes",
      parametros: ['2026-05', '2026-10'],
    });
  });

  it('totaisPorMes devolve lista vazia sem lançamentos e recusa mês inválido', async () => {
    await expect(
      repositorio.totaisPorMes('2026-05', '2026-10'),
    ).resolves.toEqual([]);
    await expect(
      repositorio.totaisPorMes("2026-05' OR 1=1", '2026-10'),
    ).rejects.toThrow(/Mês inválido/);
  });
});
