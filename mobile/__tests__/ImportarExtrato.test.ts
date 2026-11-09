import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import type {SQLiteDatabase} from 'react-native-sqlite-storage';

import {runMigrations} from '../src/data/database/migrations';
import {SqliteTransacaoRepository} from '../src/data/repositories/SqliteTransacaoRepository';
import {base64ParaBytes} from '../src/data/servicos/base64';
import {
  caminhoDoArquivo,
  SeletorArquivoDocumentPicker,
} from '../src/data/servicos/SeletorArquivo';
import {ImportarExtrato} from '../src/domain/casosDeUso/ImportarExtrato';
import type {DadosTransacao} from '../src/domain/entities/Transacao';
import {
  ERRO_ARQUIVO_GRANDE,
  ERRO_ARQUIVO_VAZIO,
  ERRO_EXTENSAO,
  ERRO_SEM_LANCAMENTOS,
} from '../src/domain/importacao/limites';
import {ERRO_NAO_OFX} from '../src/domain/importacao/ofx';
import type {TransacaoRepository} from '../src/domain/repositories/TransacaoRepository';
import {criarBancoReal} from '../test-utils/bancoReal';
import {
  COLUNAS_DESCONHECIDAS,
  NUBANK_CARTAO,
  NUBANK_CONTA,
} from './fixtures/extratos/csv';
import {OFX_SGML_1252} from './fixtures/extratos/ofx';

const bytes = (texto: string, codificacao: 'utf8' | 'latin1' = 'utf8') =>
  Uint8Array.from(Buffer.from(texto, codificacao));

const despesa = (dados: Partial<DadosTransacao> = {}): DadosTransacao => ({
  tipo: 'despesa',
  descricao: 'Mercado',
  valorCentavos: 8990,
  data: '2026-11-03',
  categoria: 'alimentacao',
  recorrencia: 'variavel',
  comprovanteUri: null,
  contaRecorrenteId: null,
  idExterno: 'ofx:1:A',
  ...dados,
});

describe('SqliteTransacaoRepository: importação', () => {
  let db: SQLiteDatabase;
  let repositorio: SqliteTransacaoRepository;

  beforeEach(async () => {
    db = criarBancoReal();
    await runMigrations(db);
    repositorio = new SqliteTransacaoRepository(async () => db);
  });

  it('importa o lote e conta só o que entrou', async () => {
    await expect(
      repositorio.importarLote([
        despesa(),
        despesa({idExterno: 'ofx:1:B', valorCentavos: 100}),
      ]),
    ).resolves.toBe(2);
    await expect(repositorio.listarRecentes(10)).resolves.toHaveLength(2);
  });

  it('importar duas vezes não duplica (INSERT OR IGNORE pelo id externo)', async () => {
    await repositorio.importarLote([despesa()]);
    await expect(
      repositorio.importarLote([despesa(), despesa({idExterno: 'ofx:1:C'})]),
    ).resolves.toBe(1);
    await expect(repositorio.listarRecentes(10)).resolves.toHaveLength(2);
  });

  it('é uma transação só: um erro desfaz o lote inteiro', async () => {
    // O OR IGNORE pula UNIQUE e CHECK, mas não chave estrangeira: serve para
    // provocar a falha no meio do lote.
    await expect(
      repositorio.importarLote([
        despesa(),
        despesa({idExterno: 'x', contaRecorrenteId: 999}),
      ]),
    ).rejects.toThrow(/FOREIGN KEY/);
    await expect(repositorio.listarRecentes(10)).resolves.toEqual([]);
  });

  it('grava e lê idExterno, e editar mantém', async () => {
    await repositorio.importarLote([despesa()]);
    const [salva] = await repositorio.listarRecentes(1);
    expect(salva.idExterno).toBe('ofx:1:A');

    await repositorio.atualizar(salva.id, {
      ...despesa(),
      descricao: 'Mercado do mês',
    });
    await expect(repositorio.buscarPorId(salva.id)).resolves.toMatchObject({
      descricao: 'Mercado do mês',
      idExterno: 'ofx:1:A',
    });
  });

  it('lote vazio não abre transação', async () => {
    await expect(repositorio.importarLote([])).resolves.toBe(0);
  });

  it('idsExternosExistentes divide em blocos de 500 parâmetros', async () => {
    await repositorio.importarLote([despesa({idExterno: 'id-700'})]);
    const ids = Array.from({length: 1200}, (_, i) => `id-${i}`);
    const executeSql = jest.spyOn(db, 'executeSql');

    await expect(repositorio.idsExternosExistentes(ids)).resolves.toEqual(
      new Set(['id-700']),
    );
    expect(executeSql).toHaveBeenCalledTimes(3);
    const [sql, parametros] = executeSql.mock.calls[0] as unknown as [
      string,
      string[],
    ];
    expect(parametros).toHaveLength(500);
    expect(sql).not.toContain('id-0');
  });
});

describe('ImportarExtrato', () => {
  let lote: DadosTransacao[];
  let repositorio: TransacaoRepository;
  let sugeridor: {
    preparar: jest.Mock<() => Promise<void>>;
    sugerir: (texto: string) => {categoria: string; confianca: number} | null;
    invalidar: jest.Mock<() => void>;
  };
  let aoImportarDespesa: jest.Mock<(c: string, d: string) => Promise<void>>;
  let importador: ImportarExtrato;

  beforeEach(() => {
    lote = [];
    repositorio = {
      idsExternosExistentes: jest.fn(async () => new Set<string>()),
      listarPorPeriodo: jest.fn(async () => []),
      importarLote: jest.fn(async (dados: DadosTransacao[]) => {
        lote = dados;
        return dados.length;
      }),
    } as unknown as TransacaoRepository;
    sugeridor = {
      preparar: jest.fn(async () => {}),
      sugerir: texto =>
        /supermercado|ifood/i.test(texto)
          ? {categoria: 'alimentacao', confianca: 0.9}
          : /uber/i.test(texto)
          ? {categoria: 'transporte', confianca: 0.9}
          : null,
      invalidar: jest.fn(),
    };
    aoImportarDespesa = jest.fn(async () => {});
    importador = new ImportarExtrato(repositorio, sugeridor, aoImportarDespesa);
  });

  it('lê OFX em Windows-1252 com a categoria sugerida', async () => {
    const leitura = await importador.ler(
      'extrato.ofx',
      bytes(OFX_SGML_1252, 'latin1'),
    );
    expect(leitura.formato).toBe('ofx');
    expect(leitura.itens.map(i => [i.linha.descricao, i.categoria])).toEqual([
      ['COMPRA CARTAO SUPERMERCADO BOM PREÇO', 'alimentacao'],
      ['FARMÁCIA SAÚDE', 'outros'],
      ['SALARIO EMPRESA X', 'outros'],
    ]);
  });

  it('reconhece o CSV do Nubank pelo conteúdo, qualquer que seja a extensão', async () => {
    const conta = await importador.ler('NU_2026.csv', bytes(NUBANK_CONTA));
    const cartao = await importador.ler('fatura.txt', bytes(NUBANK_CARTAO));
    expect(conta.formato).toBe('nubank-conta');
    expect(cartao.formato).toBe('nubank-cartao');
    expect(cartao.itens.map(i => i.tipo)).toEqual([
      'despesa',
      'despesa',
      'receita',
    ]);
  });

  it('colunas desconhecidas pedem o mapeamento', async () => {
    const leitura = await importador.ler(
      'banco.csv',
      bytes(COLUNAS_DESCONHECIDAS),
    );
    expect(leitura).toMatchObject({
      precisaMapeamento: true,
      cabecalho: ['quando', 'o que', 'quanto'],
      exemplo: ['01/11/2026', 'Mercado', '-10,00'],
      itens: [],
    });

    const mapeada = await importador.aplicarMapeamento(
      leitura,
      {data: 0, descricao: 1, valor: 2, identificador: null},
      false,
    );
    expect(mapeada.precisaMapeamento).toBe(false);
    expect(mapeada.itens.map(i => i.valorCentavos)).toEqual([1000, 2500]);
  });

  it.each([
    ['vazio', new Uint8Array(), ERRO_ARQUIVO_VAZIO],
    ['só espaços', bytes('  \n  '), ERRO_ARQUIVO_VAZIO],
    ['grande demais', new Uint8Array(2 * 1024 * 1024 + 1), ERRO_ARQUIVO_GRANDE],
    ['só cabeçalho', bytes('Data;Valor;Descrição\n'), ERRO_SEM_LANCAMENTOS],
  ])('arquivo %s dá erro claro', async (_, conteudo, mensagem) => {
    await expect(importador.ler('a.csv', conteudo)).rejects.toThrow(mensagem);
  });

  it('.ofx que não é OFX dá erro claro', async () => {
    await expect(importador.ler('a.ofx', bytes('oi'))).rejects.toThrow(
      ERRO_NAO_OFX,
    );
  });

  it('importa só os marcados, invalida o sugeridor e avisa uma vez por categoria do mês', async () => {
    const leitura = await importador.ler('fatura.csv', bytes(NUBANK_CARTAO));
    const itens = leitura.itens.map((item, i) =>
      i === 2 ? {...item, selecionado: false} : item,
    );
    const extra = {
      ...itens[0],
      linha: {...itens[0].linha, idExterno: 'outro', data: '2026-10-30'},
    };

    await expect(
      importador.importar(
        [
          ...itens,
          extra,
          {...itens[0], linha: {...itens[0].linha, idExterno: 'mais'}},
        ],
        '2026-11-09',
      ),
    ).resolves.toBe(4);

    expect(lote).toHaveLength(4);
    expect(lote[0]).toEqual({
      tipo: 'despesa',
      descricao: 'Ifood *Restaurante',
      valorCentavos: 4590,
      data: '2026-11-02',
      categoria: 'alimentacao',
      recorrencia: 'variavel',
      comprovanteUri: null,
      contaRecorrenteId: null,
      idExterno: itens[0].linha.idExterno,
    });
    expect(sugeridor.invalidar).toHaveBeenCalledTimes(1);
    // alimentacao duas vezes em novembro + transporte; outubro não avisa.
    expect(aoImportarDespesa).toHaveBeenCalledTimes(2);
    expect(aoImportarDespesa).toHaveBeenCalledWith('alimentacao', '2026-11-02');
    expect(aoImportarDespesa).toHaveBeenCalledWith('transporte', '2026-11-03');
  });

  it('nada importado não invalida nem avisa', async () => {
    (
      repositorio.importarLote as jest.Mock<() => Promise<number>>
    ).mockResolvedValueOnce(0);
    const leitura = await importador.ler('fatura.csv', bytes(NUBANK_CARTAO));

    await expect(
      importador.importar(leitura.itens, '2026-11-09'),
    ).resolves.toBe(0);

    expect(sugeridor.invalidar).not.toHaveBeenCalled();
    expect(aoImportarDespesa).not.toHaveBeenCalled();
  });

  it('erro no aviso de orçamento não desfaz a importação', async () => {
    aoImportarDespesa.mockRejectedValue(new Error('falhou'));
    const leitura = await importador.ler('fatura.csv', bytes(NUBANK_CARTAO));
    await expect(
      importador.importar(leitura.itens, '2026-11-09'),
    ).resolves.toBe(3);
  });
});

describe('base64ParaBytes', () => {
  it.each([['Café'], ['a'], ['ab'], ['abc'], ['PREÇO 🍕'], ['']])(
    'decodifica "%s" igual ao Buffer',
    texto => {
      const base64 = Buffer.from(texto, 'utf8').toString('base64');
      expect(Array.from(base64ParaBytes(base64))).toEqual(
        Array.from(Buffer.from(texto, 'utf8')),
      );
    },
  );
});

describe('SeletorArquivoDocumentPicker', () => {
  const escolher = DocumentPicker.pickSingle as unknown as jest.Mock<
    () => Promise<object>
  >;
  const lerArquivo = RNFS.readFile as unknown as jest.Mock<
    () => Promise<string>
  >;
  const resposta = (dados: object = {}) => ({
    name: 'Extrato Nubank.csv',
    size: 100,
    fileCopyUri: 'file:///data/cache/Extrato%20Nubank.csv',
    ...dados,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pede todos os tipos com cópia no cache, lê os bytes e apaga a cópia', async () => {
    escolher.mockResolvedValueOnce(resposta());
    lerArquivo.mockResolvedValueOnce(
      Buffer.from('Data;Valor').toString('base64'),
    );

    const arquivo = await new SeletorArquivoDocumentPicker().escolher();

    expect(escolher).toHaveBeenCalledWith({
      type: ['*/*'],
      copyTo: 'cachesDirectory',
    });
    expect(lerArquivo).toHaveBeenCalledWith(
      '/data/cache/Extrato Nubank.csv',
      'base64',
    );
    expect(arquivo?.nome).toBe('Extrato Nubank.csv');
    expect(Buffer.from(arquivo!.bytes).toString()).toBe('Data;Valor');
    expect(RNFS.unlink).toHaveBeenCalledWith('/data/cache/Extrato Nubank.csv');
  });

  it('cancelar devolve null sem erro', async () => {
    escolher.mockRejectedValueOnce(
      Object.assign(new Error('cancelado'), {code: 'DOCUMENT_PICKER_CANCELED'}),
    );
    await expect(
      new SeletorArquivoDocumentPicker().escolher(),
    ).resolves.toBeNull();
  });

  it('recusa extensão errada e apaga a cópia', async () => {
    escolher.mockResolvedValueOnce(resposta({name: 'foto.jpg'}));
    await expect(new SeletorArquivoDocumentPicker().escolher()).rejects.toThrow(
      ERRO_EXTENSAO,
    );
    expect(lerArquivo).not.toHaveBeenCalled();
    expect(RNFS.unlink).toHaveBeenCalled();
  });

  it('recusa arquivo grande antes de ler', async () => {
    escolher.mockResolvedValueOnce(resposta({size: 3 * 1024 * 1024}));
    await expect(new SeletorArquivoDocumentPicker().escolher()).rejects.toThrow(
      ERRO_ARQUIVO_GRANDE,
    );
    expect(lerArquivo).not.toHaveBeenCalled();
  });

  it('caminhoDoArquivo tira o file:// e decodifica', () => {
    expect(caminhoDoArquivo('file:///a/b%20c%C3%A7.ofx')).toBe('/a/b cç.ofx');
  });
});
