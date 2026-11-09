import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import type {SQLiteDatabase} from 'react-native-sqlite-storage';

import {runMigrations} from '../src/data/database/migrations';
import {SqliteTransacaoRepository} from '../src/data/repositories/SqliteTransacaoRepository';
import {
  LIMITE_HISTORICO,
  SugerirCategoria,
} from '../src/domain/casosDeUso/SugerirCategoria';
import type {DadosTransacao} from '../src/domain/entities/Transacao';
import type {
  ExemploCategoria,
  TransacaoRepository,
} from '../src/domain/repositories/TransacaoRepository';
import {criarBancoReal} from '../test-utils/bancoReal';

describe('SugerirCategoria', () => {
  let historico: ExemploCategoria[];
  let exemplosDeCategoria: jest.Mock<
    TransacaoRepository['exemplosDeCategoria']
  >;
  let sugeridor: SugerirCategoria;

  beforeEach(() => {
    historico = [];
    exemplosDeCategoria = jest.fn<TransacaoRepository['exemplosDeCategoria']>(
      async () => historico,
    );
    sugeridor = new SugerirCategoria({
      exemplosDeCategoria,
    } as unknown as TransacaoRepository);
  });

  const academia = () => sugeridor.sugerir('academia smart fit')?.categoria;

  it('sem preparar usa só o dicionário', () => {
    expect(sugeridor.sugerir('Netflix')?.categoria).toBe('lazer');
    expect(exemplosDeCategoria).not.toHaveBeenCalled();
  });

  it('preparar treina com o histórico, buscando até 500 exemplos', async () => {
    historico = [
      {descricao: 'Academia Smart Fit', categoria: 'saude'},
      {descricao: 'Academia Smart Fit', categoria: 'saude'},
    ];

    await sugeridor.preparar();

    expect(exemplosDeCategoria).toHaveBeenCalledWith(LIMITE_HISTORICO);
    expect(academia()).toBe('saude');
  });

  it('não consulta o banco de novo enquanto o modelo vale', async () => {
    await sugeridor.preparar();
    await sugeridor.preparar();
    expect(exemplosDeCategoria).toHaveBeenCalledTimes(1);
  });

  it('invalidar faz o modelo aprender com as despesas novas', async () => {
    await sugeridor.preparar();
    expect(academia()).toBe('lazer');

    historico = [
      {descricao: 'Academia Smart Fit', categoria: 'saude'},
      {descricao: 'Academia Smart Fit', categoria: 'saude'},
    ];
    sugeridor.invalidar();
    await sugeridor.preparar();

    expect(exemplosDeCategoria).toHaveBeenCalledTimes(2);
    expect(academia()).toBe('saude');
  });

  it('um preparar que termina depois de invalidar não grava o modelo velho', async () => {
    let responder!: (exemplos: ExemploCategoria[]) => void;
    exemplosDeCategoria.mockImplementationOnce(
      () => new Promise(resolve => (responder = resolve)),
    );
    const preparando = sugeridor.preparar();
    sugeridor.invalidar();
    responder([
      {descricao: 'Academia Smart Fit', categoria: 'saude'},
      {descricao: 'Academia Smart Fit', categoria: 'saude'},
    ]);
    await preparando;

    expect(academia()).toBe('lazer');
  });

  it('erro no banco cai no dicionário e não lança', async () => {
    exemplosDeCategoria.mockRejectedValue(new Error('banco fechado'));

    await expect(sugeridor.preparar()).resolves.toBeUndefined();

    expect(sugeridor.sugerir('Drogasil')?.categoria).toBe('saude');
  });
});

describe('SqliteTransacaoRepository.exemplosDeCategoria', () => {
  let db: SQLiteDatabase;
  let repositorio: SqliteTransacaoRepository;

  const lancamento = (
    descricao: string,
    categoria: string,
    data: string,
    tipo: DadosTransacao['tipo'] = 'despesa',
  ): DadosTransacao => ({
    tipo,
    descricao,
    valorCentavos: 1000,
    data,
    categoria,
    recorrencia: 'variavel',
    comprovanteUri: null,
    contaRecorrenteId: null,
    idExterno: null,
  });

  beforeEach(async () => {
    db = criarBancoReal();
    await runMigrations(db);
    repositorio = new SqliteTransacaoRepository(async () => db);
  });

  it('traz só despesas sem "outros", das mais recentes para as antigas', async () => {
    await repositorio.criar(lancamento('Uber', 'transporte', '2026-11-01'));
    await repositorio.criar(
      lancamento('Salário', 'salario', '2026-11-05', 'receita'),
    );
    await repositorio.criar(lancamento('Boleto', 'outros', '2026-11-06'));
    await repositorio.criar(lancamento('Netflix', 'lazer', '2026-11-03'));
    await repositorio.criar(lancamento('Drogasil', 'saude', '2026-11-03'));

    await expect(repositorio.exemplosDeCategoria()).resolves.toEqual([
      {descricao: 'Drogasil', categoria: 'saude'},
      {descricao: 'Netflix', categoria: 'lazer'},
      {descricao: 'Uber', categoria: 'transporte'},
    ]);
  });

  it('respeita o limite', async () => {
    for (let dia = 1; dia <= 5; dia++) {
      await repositorio.criar(
        lancamento(`Mercado ${dia}`, 'alimentacao', `2026-11-0${dia}`),
      );
    }

    await expect(repositorio.exemplosDeCategoria(2)).resolves.toEqual([
      {descricao: 'Mercado 5', categoria: 'alimentacao'},
      {descricao: 'Mercado 4', categoria: 'alimentacao'},
    ]);
  });

  it('usa parâmetro para o limite e o padrão é 500', async () => {
    const executeSql = jest.fn(async () => [
      {rows: {length: 0, item: () => undefined}},
    ]);
    const espiao = new SqliteTransacaoRepository(
      async () => ({executeSql} as unknown as SQLiteDatabase),
    );

    await espiao.exemplosDeCategoria();

    const [sql, parametros] = executeSql.mock.calls[0] as unknown as [
      string,
      number[],
    ];
    expect(sql).toMatch(/ORDER BY data DESC, id DESC\s+LIMIT \?/);
    expect(parametros).toEqual([500]);
  });
});
