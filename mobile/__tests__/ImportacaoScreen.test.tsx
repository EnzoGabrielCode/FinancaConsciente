import React from 'react';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {PaperProvider} from 'react-native-paper';
import renderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import type {SQLiteDatabase} from 'react-native-sqlite-storage';

import {runMigrations} from '../src/data/database/migrations';
import {SqliteTransacaoRepository} from '../src/data/repositories/SqliteTransacaoRepository';
import {ImportarExtrato} from '../src/domain/casosDeUso/ImportarExtrato';
import {SugerirCategoria} from '../src/domain/casosDeUso/SugerirCategoria';
import {ERRO_EXTENSAO} from '../src/domain/importacao/limites';
import type {SeletorArquivo} from '../src/domain/repositories/SeletorArquivo';
import ImportacaoScreen from '../src/presentation/screens/ImportacaoScreen';
import {darkTheme} from '../src/presentation/theme';
import {criarBancoReal} from '../test-utils/bancoReal';
import {
  COLUNAS_DESCONHECIDAS,
  COM_LINHA_INVALIDA,
  NUBANK_CARTAO,
} from './fixtures/extratos/csv';

const utf8 = (texto: string) => new Uint8Array(Buffer.from(texto, 'utf8'));

describe('ImportacaoScreen', () => {
  let tree: ReactTestRenderer;
  let db: SQLiteDatabase;
  let repositorio: SqliteTransacaoRepository;
  let importador: ImportarExtrato;
  let escolher: jest.Mock<SeletorArquivo['escolher']>;
  let onImportado: jest.Mock<(quantidade: number) => void>;

  beforeEach(async () => {
    jest.useFakeTimers({now: new Date(2026, 10, 9, 12)});
    db = criarBancoReal();
    await runMigrations(db);
    repositorio = new SqliteTransacaoRepository(async () => db);
    importador = new ImportarExtrato(
      repositorio,
      new SugerirCategoria(repositorio),
    );
    escolher = jest.fn<SeletorArquivo['escolher']>(async () => ({
      nome: 'Nubank_2026-11.csv',
      bytes: utf8(NUBANK_CARTAO),
    }));
    onImportado = jest.fn();
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
      tree.unmount();
    });
    jest.useRealTimers();
  });

  async function renderizar(importadorDaTela = importador) {
    await act(async () => {
      tree = renderer.create(
        <PaperProvider theme={darkTheme}>
          <ImportacaoScreen
            visivel
            importador={importadorDaTela}
            seletorArquivo={{escolher}}
            onFechar={() => {}}
            onImportado={onImportado}
          />
        </PaperProvider>,
      );
    });
  }

  const hospedeiros = (id: string) =>
    tree.root.findAll(
      no => typeof no.type === 'string' && no.props.testID === id,
    );
  function textoDe(no: ReactTestInstance): string {
    return no.children
      .map(filho => (typeof filho === 'string' ? filho : textoDe(filho)))
      .join('');
  }
  const texto = (id: string) => textoDe(hospedeiros(id)[0]);
  const existe = (id: string) => hospedeiros(id).length > 0;
  const tocavel = (id: string) => {
    const [alvo] = tree.root.findAll(
      no => no.props.testID === id && typeof no.props.onPress === 'function',
    );
    if (!alvo) {
      throw new Error(`Nada tocável com testID "${id}"`);
    }
    return alvo;
  };
  const tocar = (id: string) =>
    act(async () => {
      await tocavel(id).props.onPress();
    });
  const marcado = (indice: number) =>
    tocavel(`importacao-marcar-${indice}`).props.accessibilityState.checked;
  const desabilitado = (id: string) =>
    tocavel(id).props.accessibilityState.disabled;

  it('mostra a explicação e o botão de escolher', async () => {
    await renderizar();
    expect(existe('importacao-inicio')).toBe(true);
    expect(
      tree.root.findAll(
        no =>
          no.props.children ===
          'No app do seu banco, exporte o extrato em OFX ou CSV e escolha o arquivo aqui.',
      ),
    ).not.toHaveLength(0);
  });

  it('escolher → prévia → importar', async () => {
    await renderizar();
    await tocar('importacao-escolher');

    expect(existe('importacao-previa')).toBe(true);
    expect(
      tree.root.findAll(no =>
        String(textoDe(no)).includes('Nubank_2026-11.csv · Nubank cartão'),
      ),
    ).not.toHaveLength(0);
    expect(texto('importacao-resumo')).toBe('3 lançamentos · 3 novos');
    expect(texto('importacao-valor-0')).toBe('-R$ 45,90');
    expect(texto('importacao-valor-2')).toBe('+R$ 500,00');
    expect(existe('importacao-sugerida-0')).toBe(true);
    expect(texto('importacao-importar')).toBe('Importar 3 lançamentos');

    await tocar('importacao-importar');

    expect(onImportado).toHaveBeenCalledWith(3);
    await expect(repositorio.listarRecentes(10)).resolves.toHaveLength(3);
  });

  it('desmarcar uma linha muda o total do botão', async () => {
    await renderizar();
    await tocar('importacao-escolher');

    await tocar('importacao-marcar-1');

    expect(marcado(1)).toBe(false);
    expect(texto('importacao-importar')).toBe('Importar 2 lançamentos');
    await tocar('importacao-importar');
    expect(onImportado).toHaveBeenCalledWith(2);
  });

  it('desmarcar todos desabilita o botão e marcar todos volta', async () => {
    await renderizar();
    await tocar('importacao-escolher');

    await tocar('importacao-desmarcar-todos');
    expect(texto('importacao-importar')).toBe('Importar 0 lançamentos');
    expect(desabilitado('importacao-importar')).toBe(true);

    await tocar('importacao-marcar-todos');
    expect(texto('importacao-importar')).toBe('Importar 3 lançamentos');
  });

  it('o que já foi importado vem desmarcado e com a etiqueta', async () => {
    await renderizar();
    await tocar('importacao-escolher');
    await tocar('importacao-importar');
    await act(async () => {
      tree.update(
        <PaperProvider theme={darkTheme}>
          <ImportacaoScreen
            visivel={false}
            importador={importador}
            seletorArquivo={{escolher}}
            onFechar={() => {}}
            onImportado={onImportado}
          />
        </PaperProvider>,
      );
    });
    await renderizar();
    await tocar('importacao-escolher');

    expect(texto('importacao-resumo')).toBe(
      '3 lançamentos · 0 novos · 3 já importados',
    );
    expect(texto('importacao-etiqueta-0')).toBe('Já importada');
    expect(marcado(0)).toBe(false);
  });

  it('trocar a categoria tira o selo de sugerida', async () => {
    await renderizar();
    await tocar('importacao-escolher');
    expect(existe('importacao-sugerida-0')).toBe(true);

    await tocar('importacao-categoria-0');
    await tocar('importacao-opcao-lazer');

    expect(existe('importacao-sugerida-0')).toBe(false);
    expect(tocavel('importacao-categoria-0').props.accessibilityLabel).toBe(
      'Categoria: Lazer',
    );
    await tocar('importacao-importar');
    const [salvo] = (await repositorio.listarRecentes(10)).filter(
      t => t.descricao === 'Ifood *Restaurante',
    );
    expect(salvo.categoria).toBe('lazer');
  });

  it('pede o mapeamento quando não reconhece as colunas', async () => {
    escolher.mockResolvedValueOnce({
      nome: 'banco.csv',
      bytes: utf8(COLUNAS_DESCONHECIDAS),
    });
    await renderizar();
    await tocar('importacao-escolher');

    expect(existe('importacao-mapeamento')).toBe(true);
    expect(desabilitado('mapear-continuar')).toBe(true);

    await tocar('mapear-data-0');
    await tocar('mapear-descricao-1');
    expect(desabilitado('mapear-continuar')).toBe(true);
    await tocar('mapear-valor-2');
    expect(desabilitado('mapear-continuar')).toBe(false);

    await act(async () => {
      tree.root
        .findAll(
          no =>
            no.props.testID === 'mapear-cartao' &&
            typeof no.props.onValueChange === 'function',
        )[0]
        .props.onValueChange(true);
    });
    await tocar('mapear-continuar');

    expect(existe('importacao-previa')).toBe(true);
    // Como fatura de cartão, os valores negativos do arquivo viram entradas.
    expect(texto('importacao-valor-0')).toBe('+R$ 10,00');
  });

  it('a mesma coluna para dois campos não deixa continuar', async () => {
    escolher.mockResolvedValueOnce({
      nome: 'banco.csv',
      bytes: utf8(COLUNAS_DESCONHECIDAS),
    });
    await renderizar();
    await tocar('importacao-escolher');
    await tocar('mapear-data-0');
    await tocar('mapear-descricao-0');
    await tocar('mapear-valor-2');

    expect(desabilitado('mapear-continuar')).toBe(true);
  });

  it('mostra as linhas ignoradas num aviso recolhível', async () => {
    escolher.mockResolvedValueOnce({
      nome: 'extrato.csv',
      bytes: utf8(COM_LINHA_INVALIDA),
    });
    await renderizar();
    await tocar('importacao-escolher');

    expect(texto('importacao-erros')).toBe('2 linhas ignoradas ▼');
    await tocar('importacao-erros');
    expect(texto('importacao-erros')).toContain('Linha 3: data inválida');
  });

  it('mostra "Lendo arquivo..." enquanto processa', async () => {
    let terminar!: () => void;
    const lento = {
      ...importador,
      ler: (nome: string, bytes: Uint8Array) =>
        new Promise<Awaited<ReturnType<ImportarExtrato['ler']>>>(resolve => {
          terminar = () => resolve(importador.ler(nome, bytes));
        }),
      aplicarMapeamento: importador.aplicarMapeamento.bind(importador),
      importar: importador.importar.bind(importador),
    };
    await renderizar(lento as unknown as ImportarExtrato);
    await act(async () => {
      tocavel('importacao-escolher').props.onPress();
    });

    expect(existe('importacao-lendo')).toBe(true);
    await act(async () => terminar());
    expect(existe('importacao-previa')).toBe(true);
  });

  it('cancelar o seletor não mostra erro', async () => {
    escolher.mockResolvedValueOnce(null);
    await renderizar();
    await tocar('importacao-escolher');

    expect(existe('importacao-inicio')).toBe(true);
    expect(existe('importacao-erro')).toBe(false);
  });

  it.each([
    [
      'extensão errada',
      () => escolher.mockRejectedValueOnce(new Error(ERRO_EXTENSAO)),
      ERRO_EXTENSAO,
    ],
    [
      'arquivo vazio',
      () =>
        escolher.mockResolvedValueOnce({
          nome: 'a.csv',
          bytes: new Uint8Array(),
        }),
      'Este arquivo está vazio.',
    ],
    [
      'não é OFX',
      () => escolher.mockResolvedValueOnce({nome: 'a.ofx', bytes: utf8('oi')}),
      'Este arquivo não parece um extrato OFX.',
    ],
  ])(
    '%s mostra a mensagem e deixa escolher de novo',
    async (_, preparar, mensagem) => {
      preparar();
      await renderizar();
      await tocar('importacao-escolher');

      expect(texto('importacao-erro')).toBe(mensagem);
      expect(existe('importacao-escolher')).toBe(true);
    },
  );
});
