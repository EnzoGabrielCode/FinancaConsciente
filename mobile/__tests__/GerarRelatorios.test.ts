import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import type {SQLiteDatabase} from 'react-native-sqlite-storage';

import {runMigrations} from '../src/data/database/migrations';
import {SqliteTransacaoRepository} from '../src/data/repositories/SqliteTransacaoRepository';
import {
  PASTA_RELATORIOS,
  RnfsExportador,
} from '../src/data/servicos/RnfsExportador';
import {GerarRelatorios} from '../src/domain/casosDeUso/GerarRelatorios';
import type {FiltroRelatorio} from '../src/domain/entities/Relatorio';
import type {DadosTransacao, Transacao} from '../src/domain/entities/Transacao';
import {
  cancelamentoDeCompartilhar,
  type ExportadorArquivos,
} from '../src/domain/repositories/ExportadorArquivos';
import type {GeradorPdf} from '../src/domain/repositories/GeradorPdf';
import type {TransacaoRepository} from '../src/domain/repositories/TransacaoRepository';
import {criarBancoReal} from '../test-utils/bancoReal';

const filtro = (dados: Partial<FiltroRelatorio> = {}): FiltroRelatorio => ({
  de: '2026-11-01',
  ate: '2026-11-30',
  tipo: 'todos',
  categoria: null,
  ...dados,
});

const despesa = (dados: Partial<DadosTransacao> = {}): DadosTransacao => ({
  tipo: 'despesa',
  descricao: 'Mercado',
  valorCentavos: 1000,
  data: '2026-11-03',
  categoria: 'alimentacao',
  recorrencia: 'variavel',
  comprovanteUri: null,
  contaRecorrenteId: null,
  idExterno: null,
  ...dados,
});

describe('SqliteTransacaoRepository.listarPorPeriodo', () => {
  let db: SQLiteDatabase;
  let repositorio: SqliteTransacaoRepository;

  beforeEach(async () => {
    db = criarBancoReal();
    await runMigrations(db);
    repositorio = new SqliteTransacaoRepository(async () => db);
    await repositorio.criar(
      despesa({descricao: 'Fora antes', data: '2026-10-31'}),
    );
    await repositorio.criar(despesa({descricao: 'Dia 30', data: '2026-11-30'}));
    await repositorio.criar(despesa({descricao: 'Dia 1', data: '2026-11-01'}));
    await repositorio.criar(
      despesa({descricao: 'Uber', categoria: 'transporte', data: '2026-11-10'}),
    );
    await repositorio.criar(
      despesa({
        tipo: 'receita',
        descricao: 'Salário',
        categoria: 'salario',
        data: '2026-11-05',
      }),
    );
    await repositorio.criar(
      despesa({descricao: 'Fora depois', data: '2026-12-01'}),
    );
  });

  const descricoes = async (dados: Partial<FiltroRelatorio> = {}) =>
    (await repositorio.listarPorPeriodo(filtro(dados))).map(
      (t: Transacao) => t.descricao,
    );

  it('inclui o primeiro e o último dia, em ordem de data', async () => {
    await expect(descricoes()).resolves.toEqual([
      'Dia 1',
      'Salário',
      'Uber',
      'Dia 30',
    ]);
  });

  it('filtra por tipo', async () => {
    await expect(descricoes({tipo: 'receita'})).resolves.toEqual(['Salário']);
    await expect(descricoes({tipo: 'despesa'})).resolves.toEqual([
      'Dia 1',
      'Uber',
      'Dia 30',
    ]);
  });

  it('filtra por categoria, junto ou não com o tipo', async () => {
    await expect(descricoes({categoria: 'transporte'})).resolves.toEqual([
      'Uber',
    ]);
    await expect(
      descricoes({tipo: 'receita', categoria: 'transporte'}),
    ).resolves.toEqual([]);
  });

  it('desempata pela ordem de inclusão no mesmo dia', async () => {
    await repositorio.criar(
      despesa({descricao: 'Dia 1 de novo', data: '2026-11-01'}),
    );
    await expect(
      descricoes({de: '2026-11-01', ate: '2026-11-01'}),
    ).resolves.toEqual(['Dia 1', 'Dia 1 de novo']);
  });

  it('valores dos filtros vão só nos parâmetros', async () => {
    const executeSql = jest.fn(async () => [
      {rows: {length: 0, item: () => undefined}},
    ]);
    const espiao = new SqliteTransacaoRepository(
      async () => ({executeSql} as unknown as SQLiteDatabase),
    );

    await espiao.listarPorPeriodo(
      filtro({tipo: 'despesa', categoria: "x' OR '1'='1"}),
    );

    const [sql, parametros] = executeSql.mock.calls[0] as unknown as [
      string,
      string[],
    ];
    expect(sql).not.toContain('2026');
    expect(sql).not.toContain("OR '1'");
    expect(sql).toMatch(
      /data BETWEEN \? AND \? AND tipo = \? AND categoria = \?/,
    );
    expect(parametros).toEqual([
      '2026-11-01',
      '2026-11-30',
      'despesa',
      "x' OR '1'='1",
    ]);
  });
});

describe('GerarRelatorios', () => {
  let exportador: {
    [K in keyof ExportadorArquivos]: jest.Mock<ExportadorArquivos[K]>;
  };
  let gerar: jest.Mock<GeradorPdf['gerar']>;
  let repositorio: TransacaoRepository;
  let gerador: GerarRelatorios;

  beforeEach(() => {
    exportador = {
      salvarTexto: jest.fn<ExportadorArquivos['salvarTexto']>(
        async nome => `/cache/relatorios/${nome}`,
      ),
      salvarBase64: jest.fn<ExportadorArquivos['salvarBase64']>(
        async nome => `/cache/relatorios/${nome}`,
      ),
      compartilhar: jest.fn<ExportadorArquivos['compartilhar']>(async () => {}),
    };
    gerar = jest.fn<GeradorPdf['gerar']>(async () => 'JVBERi0xLjc=');
    repositorio = {
      listarPorPeriodo: jest.fn(async () => [
        {...despesa(), id: 1, sincronizado: false},
      ]),
      saldoAte: jest.fn(async () => 10000),
      totaisPorMes: jest.fn(async () => [
        {anoMes: '2026-11', receitasCentavos: 5000, despesasCentavos: 0},
      ]),
    } as unknown as TransacaoRepository;
    gerador = new GerarRelatorios(repositorio, exportador, {gerar});
  });

  it('carregar busca o período e monta o relatório', async () => {
    const relatorio = await gerador.carregar(filtro());
    expect(repositorio.listarPorPeriodo).toHaveBeenCalledWith(filtro());
    expect(relatorio).toMatchObject({quantidade: 1, totalDespesas: 1000});
  });

  it('carregar recusa filtro inválido sem consultar', async () => {
    await expect(gerador.carregar(filtro({de: '2026-12-01'}))).rejects.toThrow(
      'A data inicial precisa ser antes da final.',
    );
    expect(repositorio.listarPorPeriodo).not.toHaveBeenCalled();
  });

  it('patrimonio parte do saldo antes do primeiro dos 12 meses', async () => {
    const {serie, resumo} = await gerador.patrimonio('2026-11-09');

    expect(repositorio.saldoAte).toHaveBeenCalledWith('2025-11-30');
    expect(repositorio.totaisPorMes).toHaveBeenCalledWith('2025-12', '2026-11');
    expect(serie).toHaveLength(12);
    expect(serie[0]).toEqual({anoMes: '2025-12', patrimonioCentavos: 10000});
    expect(resumo).toEqual({
      atual: 15000,
      variacaoCentavos: 5000,
      variacaoPercentual: 0.5,
    });
  });

  it('exportarCsv grava o CSV e compartilha', async () => {
    const relatorio = await gerador.carregar(filtro());

    await expect(gerador.exportarCsv(relatorio)).resolves.toBe(true);

    const [nome, conteudo] = exportador.salvarTexto.mock.calls[0];
    expect(nome).toBe('financaconsciente-2026-11-01-a-2026-11-30.csv');
    expect(conteudo.startsWith('\uFEFFData;')).toBe(true);
    expect(exportador.compartilhar).toHaveBeenCalledWith(
      '/cache/relatorios/financaconsciente-2026-11-01-a-2026-11-30.csv',
      'text/csv',
      'Extrato em CSV',
    );
  });

  it('exportarPdf gera, grava em base64 e compartilha', async () => {
    const relatorio = await gerador.carregar(filtro());
    const agora = new Date(2026, 10, 9, 14, 30);

    await expect(gerador.exportarPdf(relatorio, agora)).resolves.toBe(true);

    expect(gerar).toHaveBeenCalledWith(relatorio, agora);
    expect(exportador.salvarBase64).toHaveBeenCalledWith(
      'financaconsciente-2026-11-01-a-2026-11-30.pdf',
      'JVBERi0xLjc=',
    );
    expect(exportador.compartilhar).toHaveBeenCalledWith(
      expect.stringMatching(/\.pdf$/),
      'application/pdf',
      'Extrato em PDF',
    );
  });

  it('cancelar o compartilhar não é erro', async () => {
    exportador.compartilhar.mockRejectedValue(cancelamentoDeCompartilhar());
    const relatorio = await gerador.carregar(filtro());

    await expect(gerador.exportarPdf(relatorio)).resolves.toBe(false);
    await expect(gerador.exportarCsv(relatorio)).resolves.toBe(false);
  });

  it('outros erros continuam sendo erro', async () => {
    exportador.salvarBase64.mockRejectedValue(new Error('Sem espaço'));
    const relatorio = await gerador.carregar(filtro());

    await expect(gerador.exportarPdf(relatorio)).rejects.toThrow('Sem espaço');
  });
});

describe('RnfsExportador', () => {
  const agora = Date.UTC(2026, 10, 9, 12);
  const arquivo = (nome: string, horasAtras: number) => ({
    name: nome,
    path: `${PASTA_RELATORIOS}/${nome}`,
    mtime: new Date(agora - horasAtras * 3600 * 1000),
    isFile: () => true,
  });
  const abrir = Share.open as unknown as jest.Mock<
    (o: object) => Promise<object>
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('grava na pasta de relatórios do cache e apaga os de mais de 1 dia', async () => {
    (
      RNFS.readDir as unknown as jest.Mock<() => Promise<unknown[]>>
    ).mockResolvedValueOnce([
      arquivo('antigo.pdf', 30),
      arquivo('recente.csv', 2),
    ]);

    const caminho = await new RnfsExportador(() => agora).salvarTexto(
      'extrato.csv',
      '\uFEFFData;',
    );

    expect(PASTA_RELATORIOS).toBe('/cache/relatorios');
    expect(RNFS.mkdir).toHaveBeenCalledWith('/cache/relatorios');
    expect(RNFS.unlink).toHaveBeenCalledTimes(1);
    expect(RNFS.unlink).toHaveBeenCalledWith('/cache/relatorios/antigo.pdf');
    expect(caminho).toBe('/cache/relatorios/extrato.csv');
    expect(RNFS.writeFile).toHaveBeenCalledWith(caminho, '\uFEFFData;', 'utf8');
  });

  it('grava o PDF em base64', async () => {
    await new RnfsExportador(() => agora).salvarBase64('a.pdf', 'JVBERi0=');
    expect(RNFS.writeFile).toHaveBeenCalledWith(
      '/cache/relatorios/a.pdf',
      'JVBERi0=',
      'base64',
    );
  });

  it('a limpeza que falha não impede gravar', async () => {
    (
      RNFS.readDir as unknown as jest.Mock<() => Promise<unknown[]>>
    ).mockRejectedValueOnce(new Error('sem permissão'));
    await expect(
      new RnfsExportador(() => agora).salvarTexto('a.csv', 'x'),
    ).resolves.toBe('/cache/relatorios/a.csv');
  });

  it('compartilha com file://, o tipo e sem falhar ao cancelar', async () => {
    await new RnfsExportador().compartilhar(
      '/cache/relatorios/a.pdf',
      'application/pdf',
      'Extrato',
    );
    expect(abrir).toHaveBeenCalledWith({
      url: 'file:///cache/relatorios/a.pdf',
      type: 'application/pdf',
      title: 'Extrato',
      failOnCancel: false,
    });
  });

  it('transforma o "User did not share" em cancelamento', async () => {
    abrir.mockRejectedValueOnce(new Error('User did not share'));
    const gerador = new GerarRelatorios(
      {listarPorPeriodo: async () => []} as unknown as TransacaoRepository,
      new RnfsExportador(() => agora),
      {gerar: async () => 'JVBERi0='},
    );
    const relatorio = await gerador.carregar(filtro());

    await expect(gerador.exportarPdf(relatorio)).resolves.toBe(false);
  });
});
