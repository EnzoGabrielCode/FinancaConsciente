import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import type {SQLiteDatabase} from 'react-native-sqlite-storage';

import {runMigrations} from '../src/data/database/migrations';
import {SqliteOrcamentoRepository} from '../src/data/repositories/SqliteOrcamentoRepository';
import {SqliteTransacaoRepository} from '../src/data/repositories/SqliteTransacaoRepository';
import type {DadosTransacao} from '../src/domain/entities/Transacao';
import {criarBancoReal} from '../test-utils/bancoReal';

let db: SQLiteDatabase;

beforeEach(async () => {
  db = criarBancoReal();
  await runMigrations(db);
});

describe('SqliteOrcamentoRepository', () => {
  let repositorio: SqliteOrcamentoRepository;

  beforeEach(() => {
    repositorio = new SqliteOrcamentoRepository(async () => db);
  });

  it('salva e lista', async () => {
    await repositorio.salvar({categoria: 'lazer', limiteCentavos: 10000});
    await expect(repositorio.listar()).resolves.toEqual([
      {id: 1, categoria: 'lazer', limiteCentavos: 10000},
    ]);
  });

  it('salvar faz upsert por categoria, mantendo o id', async () => {
    await repositorio.salvar({categoria: 'lazer', limiteCentavos: 10000});
    await repositorio.salvar({categoria: 'compras', limiteCentavos: 5000});
    await repositorio.salvar({categoria: 'lazer', limiteCentavos: 25000});

    await expect(repositorio.listar()).resolves.toEqual([
      {id: 1, categoria: 'lazer', limiteCentavos: 25000},
      {id: 2, categoria: 'compras', limiteCentavos: 5000},
    ]);
  });

  it('não usa ON CONFLICT DO UPDATE, ausente no SQLite do Android antigo', async () => {
    const sqls: string[] = [];
    const espiao = {
      transaction: async (escopo: (tx: object) => void) =>
        escopo({executeSql: (sql: string) => sqls.push(sql)}),
    } as unknown as SQLiteDatabase;

    await new SqliteOrcamentoRepository(async () => espiao).salvar({
      categoria: 'lazer',
      limiteCentavos: 10000,
    });

    expect(sqls).toHaveLength(2);
    expect(sqls.join(' ')).not.toMatch(/ON CONFLICT/i);
  });

  it('atualiza atualizado_em ao mudar o limite', async () => {
    await repositorio.salvar({categoria: 'lazer', limiteCentavos: 10000});
    await db.executeSql("UPDATE orcamentos SET atualizado_em = 'antigo'");
    await repositorio.salvar({categoria: 'lazer', limiteCentavos: 20000});

    const [resultado] = await db.executeSql(
      'SELECT atualizado_em FROM orcamentos',
    );
    expect(resultado.rows.item(0).atualizado_em).not.toBe('antigo');
  });

  it('exclui pelo id', async () => {
    await repositorio.salvar({categoria: 'lazer', limiteCentavos: 10000});
    await repositorio.excluir(1);
    await expect(repositorio.listar()).resolves.toEqual([]);
  });

  it('registrarAlerta devolve true na 1ª vez e false na 2ª', async () => {
    const registrar = () => repositorio.registrarAlerta('lazer', '2026-11', 80);
    await expect(registrar()).resolves.toBe(true);
    await expect(registrar()).resolves.toBe(false);
  });

  it('registrarAlerta separa nível, mês e categoria', async () => {
    await repositorio.registrarAlerta('lazer', '2026-11', 80);
    await expect(
      repositorio.registrarAlerta('lazer', '2026-11', 100),
    ).resolves.toBe(true);
    await expect(
      repositorio.registrarAlerta('lazer', '2026-12', 80),
    ).resolves.toBe(true);
    await expect(
      repositorio.registrarAlerta('compras', '2026-11', 80),
    ).resolves.toBe(true);
  });
});

describe('SqliteTransacaoRepository.gastosPorCategoria', () => {
  const despesa = (
    categoria: string,
    data: string,
    valorCentavos: number,
  ): DadosTransacao => ({
    tipo: 'despesa',
    categoria,
    data,
    valorCentavos,
    descricao: 'Teste',
    recorrencia: 'variavel',
    comprovanteUri: null,
  });

  let repositorio: SqliteTransacaoRepository;

  beforeEach(() => {
    repositorio = new SqliteTransacaoRepository(async () => db);
  });

  it('soma só as despesas do mês, com o dia 1 e o último dia incluídos', async () => {
    await repositorio.criar(despesa('lazer', '2026-10-31', 1));
    await repositorio.criar(despesa('lazer', '2026-11-01', 100));
    await repositorio.criar(despesa('lazer', '2026-11-30', 200));
    await repositorio.criar(despesa('lazer', '2026-12-01', 2));
    await repositorio.criar(despesa('compras', '2026-11-15', 500));
    await repositorio.criar({
      ...despesa('outros', '2026-11-15', 9999),
      tipo: 'receita',
    });

    await expect(repositorio.gastosPorCategoria('2026-11')).resolves.toEqual({
      lazer: 300,
      compras: 500,
    });
  });

  it('inclui o dia 29 de fevereiro em ano bissexto', async () => {
    await repositorio.criar(despesa('lazer', '2028-02-29', 100));
    await expect(repositorio.gastosPorCategoria('2028-02')).resolves.toEqual({
      lazer: 100,
    });
  });

  it('devolve um objeto vazio sem despesas', async () => {
    await expect(repositorio.gastosPorCategoria('2026-11')).resolves.toEqual(
      {},
    );
  });

  it('usa parâmetros no SQL e rejeita mês inválido', async () => {
    const executeSql = jest.fn(async () => [
      {rows: {length: 0, item: () => undefined}},
    ]);
    const espiao = new SqliteTransacaoRepository(
      async () => ({executeSql} as unknown as SQLiteDatabase),
    );

    await espiao.gastosPorCategoria('2026-11');

    const [sql, parametros] = executeSql.mock.calls[0] as unknown as [
      string,
      string[],
    ];
    expect(sql).toMatch(/data BETWEEN \? AND \?/);
    expect(sql).not.toContain('2026');
    expect(parametros).toEqual(['2026-11-01', '2026-11-30']);
    await expect(espiao.gastosPorCategoria("2026' OR 1")).rejects.toThrow(
      'Mês inválido',
    );
  });
});
