import React from 'react';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {PaperProvider} from 'react-native-paper';
import renderer, {act, type ReactTestRenderer} from 'react-test-renderer';

import {hojeISO} from '../src/domain/datas';
import type {Transacao} from '../src/domain/entities/Transacao';
import type {TransacaoRepository} from '../src/domain/repositories/TransacaoRepository';
import type {UseTransacoes} from '../src/presentation/hooks/useTransacoes';
import TransacoesScreen from '../src/presentation/screens/TransacoesScreen';
import {darkTheme} from '../src/presentation/theme';

const transacao = (id: number, data: string): Transacao => ({
  id,
  tipo: 'despesa',
  descricao: `Lançamento ${id}`,
  valorCentavos: 1000,
  data,
  categoria: 'outros',
  recorrencia: 'variavel',
  comprovanteUri: null,
  sincronizado: false,
});

function criarLancamentos(): UseTransacoes {
  return {
    transacoes: [],
    resumo: null,
    carregando: false,
    erro: null,
    recarregar: jest.fn(async () => {}),
    criar: jest.fn(async () => {}),
    atualizar: jest.fn(async () => {}),
    excluir: jest.fn(async () => {}),
    verificarDuplicatas: jest.fn(async () => []),
  } as UseTransacoes;
}

describe('TransacoesScreen', () => {
  let tree: ReactTestRenderer;
  let lista: Transacao[];
  let lancamentos: UseTransacoes;
  let onAlterado: jest.Mock<() => void>;
  let listarPagina: jest.Mock<TransacaoRepository['listarPagina']>;

  beforeEach(() => {
    jest.useFakeTimers();
    lista = [transacao(2, hojeISO()), transacao(1, hojeISO())];
    lancamentos = criarLancamentos();
    onAlterado = jest.fn();
    listarPagina = jest.fn<TransacaoRepository['listarPagina']>(
      async (limite, deslocamento) =>
        lista.slice(deslocamento, deslocamento + limite),
    );
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
      tree.unmount();
    });
    jest.useRealTimers();
  });

  async function renderizar() {
    await act(async () => {
      tree = renderer.create(
        <PaperProvider theme={darkTheme}>
          <TransacoesScreen
            visivel
            lancamentos={lancamentos}
            repositorio={{listarPagina} as unknown as TransacaoRepository}
            onAlterado={onAlterado}
            onFechar={() => {}}
          />
        </PaperProvider>,
      );
    });
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
  }

  const porId = (testID: string) =>
    tree.root.findAll(
      no => typeof no.type === 'string' && no.props.testID === testID,
    );
  const textoDe = (testID: string) => porId(testID)[0].props.children;
  const temTexto = (texto: string) =>
    tree.root.findAll(no => no.props.children === texto).length > 0;

  it('renderiza os itens sob o cabeçalho do dia', async () => {
    await renderizar();

    expect(porId('transacao-1')).toHaveLength(1);
    expect(porId('transacao-2')).toHaveLength(1);
    expect(porId(`dia-${hojeISO()}`)).toHaveLength(1);
    expect(textoDe(`dia-${hojeISO()}`)).toBe('Hoje');
    expect(listarPagina).toHaveBeenCalledWith(30, 0);
  });

  it('não consulta o banco enquanto a tela está fechada', async () => {
    await act(async () => {
      tree = renderer.create(
        <PaperProvider theme={darkTheme}>
          <TransacoesScreen
            visivel={false}
            lancamentos={lancamentos}
            repositorio={{listarPagina} as unknown as TransacaoRepository}
            onFechar={() => {}}
          />
        </PaperProvider>,
      );
    });
    expect(listarPagina).not.toHaveBeenCalled();
  });

  it('mostra o estado vazio', async () => {
    lista = [];
    await renderizar();
    expect(textoDe('transacoes-vazio')).toBe('Nenhum lançamento ainda.');
  });

  it('mostra o erro e tenta de novo', async () => {
    listarPagina.mockImplementationOnce(async () => {
      throw new Error('banco indisponível');
    });
    await renderizar();
    expect(porId('transacoes-erro')).toHaveLength(1);

    const botao = tree.root.findAll(
      no =>
        no.props.accessibilityRole === 'button' &&
        typeof no.props.onPress === 'function',
    );
    const tentar = botao.find(
      no =>
        no.findAll(filho => filho.props.children === 'Tentar novamente').length,
    );
    await act(async () => {
      tentar?.props.onPress();
    });
    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(porId('transacoes-erro')).toHaveLength(0);
    expect(porId('transacao-1')).toHaveLength(1);
  });

  it('exclui pelo diálogo, recarrega a lista e avisa', async () => {
    await renderizar();
    (lancamentos.excluir as jest.Mock).mockImplementation(async () => {
      lista = lista.filter(t => t.id !== 2);
    });
    listarPagina.mockClear();

    await act(async () => {
      tree.root
        .find(
          no =>
            no.props.testID === 'excluir-2' &&
            no.props.accessibilityRole === 'button' &&
            typeof no.props.onPress === 'function',
        )
        .props.onPress();
    });
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    await act(async () => {
      tree.root
        .find(
          no =>
            no.props.testID === 'confirmar-exclusao' &&
            typeof no.props.onPress === 'function' &&
            no.props.accessibilityRole === 'button',
        )
        .props.onPress();
    });
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(lancamentos.excluir).toHaveBeenCalledWith(2);
    expect(onAlterado).toHaveBeenCalledTimes(1);
    expect(listarPagina).toHaveBeenCalledWith(30, 0);
    expect(porId('transacao-2')).toHaveLength(0);
    expect(porId('transacao-1')).toHaveLength(1);
    expect(temTexto('Lançamento excluído')).toBe(true);
  });

  it('abre o lançamento para edição, salva e recarrega a lista', async () => {
    await renderizar();
    listarPagina.mockClear();

    await act(async () => {
      tree.root
        .find(
          no =>
            no.props.testID === 'abrir-1' &&
            no.props.accessibilityRole === 'button' &&
            typeof no.props.onPress === 'function',
        )
        .props.onPress();
    });

    const sheet = tree.root.findAll(
      no => no.props.onSalvar !== undefined && no.props.visivel === true,
    )[0];
    expect(sheet.props.transacao).toEqual(lista[1]);

    const dados = {...lista[1], descricao: 'Editado'};
    await act(async () => {
      await sheet.props.onSalvar(dados);
    });

    expect(lancamentos.atualizar).toHaveBeenCalledWith(1, dados);
    expect(onAlterado).toHaveBeenCalledTimes(1);
    expect(listarPagina).toHaveBeenCalledWith(30, 0);
    expect(temTexto('Lançamento atualizado')).toBe(true);
  });
});
