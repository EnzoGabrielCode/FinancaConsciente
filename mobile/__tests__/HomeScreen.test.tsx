import 'react-native';
import React from 'react';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {PaperProvider} from 'react-native-paper';
import renderer, {act, type ReactTestRenderer} from 'react-test-renderer';

import type {Transacao} from '../src/domain/entities/Transacao';
import type {ArmazenamentoComprovantes} from '../src/domain/repositories/ArmazenamentoComprovantes';
import type {CofreRepository} from '../src/domain/repositories/CofreRepository';
import type {Notificador} from '../src/domain/repositories/Notificador';
import type {OrcamentoRepository} from '../src/domain/repositories/OrcamentoRepository';
import type {TransacaoRepository} from '../src/domain/repositories/TransacaoRepository';
import HomeScreen from '../src/presentation/screens/HomeScreen';
import {darkTheme} from '../src/presentation/theme';

// Repositórios vazios em memória: a barra não depende dos dados.
const repositorio: TransacaoRepository = {
  listarRecentes: async () => [],
  listarPagina: async () => [],
  gastosPorCategoria: async () => ({}),
  buscarPorId: async () => null,
  criar: async () => 1,
  atualizar: async () => {},
  excluir: async () => {},
  saldoAte: async () => 0,
  totaisPorMes: async () => [],
  buscarCandidatasDuplicata: async () => [],
};

const repositorioCofres: CofreRepository = {
  listar: async () => [],
  buscarPorId: async () => null,
  criar: async () => 1,
  atualizar: async () => {},
  excluir: async () => {},
  registrarMovimento: async () => 1,
  listarMovimentos: async () => [],
  totalGuardado: async () => 0,
};

const repositorioOrcamentos: OrcamentoRepository = {
  listar: async () => [],
  salvar: async () => {},
  excluir: async () => {},
  registrarAlerta: async () => true,
};

const notificador: Notificador = {
  pedirPermissao: async () => true,
  notificar: async () => {},
};

const armazenamento: ArmazenamentoComprovantes = {
  guardar: async uri => uri,
  apagar: async () => {},
  ehDefinitivo: () => true,
};

let tree: ReactTestRenderer;

async function renderizar(repositorioTela = repositorio) {
  await act(async () => {
    tree = renderer.create(
      <PaperProvider theme={darkTheme}>
        <HomeScreen
          repositorio={repositorioTela}
          armazenamento={armazenamento}
          repositorioCofres={repositorioCofres}
          repositorioOrcamentos={repositorioOrcamentos}
          notificador={notificador}
        />
      </PaperProvider>,
    );
  });
}

const aba = (id: string) =>
  tree.root.find(
    no => no.props.testID === id && no.props.accessibilityRole === 'tab',
  );

const temTexto = (texto: string) =>
  tree.root.findAll(no => no.props.children === texto).length > 0;

describe('HomeScreen: barra de navegação', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
      tree.unmount();
    });
    jest.useRealTimers();
  });

  it('mostra as quatro abas com Início selecionada', async () => {
    await renderizar();

    expect(aba('aba-inicio').props.accessibilityState).toEqual({
      selected: true,
    });
    for (const id of ['aba-planejamento', 'aba-desafios', 'aba-assistente']) {
      expect(aba(id).props.accessibilityState).toEqual({selected: false});
    }
  });

  it('avisa "Disponível em breve" ao tocar numa aba inativa', async () => {
    await renderizar();
    expect(temTexto('Disponível em breve')).toBe(false);

    await act(async () => {
      aba('aba-desafios').props.onPress();
    });

    expect(temTexto('Disponível em breve')).toBe(true);
  });

  it('a aba Planejamento abre a tela Orçamentos', async () => {
    await renderizar();
    const telaOrcamentos = () =>
      tree.root.findAll(no => no.props.testID === 'orcamentos-screen');
    expect(telaOrcamentos()).toHaveLength(0);

    await act(async () => {
      aba('aba-planejamento').props.onPress();
    });

    expect(telaOrcamentos().length).toBeGreaterThan(0);
    expect(temTexto('Disponível em breve')).toBe(false);
  });
});

describe('HomeScreen: últimas transações', () => {
  const transacoes: Transacao[] = Array.from({length: 8}, (_, i) => ({
    id: i + 1,
    tipo: 'despesa',
    descricao: `Lançamento ${i + 1}`,
    valorCentavos: 1000,
    data: '2026-10-01',
    categoria: 'outros',
    recorrencia: 'variavel',
    comprovanteUri: null,
    sincronizado: false,
  }));
  const repositorioCheio: TransacaoRepository = {
    ...repositorio,
    listarRecentes: async limite => transacoes.slice(0, limite),
    listarPagina: async (limite, deslocamento) =>
      transacoes.slice(deslocamento, deslocamento + limite),
  };

  const itensNaTela = () =>
    tree.root.findAll(
      no =>
        typeof no.type === 'string' &&
        /^transacao-\d+$/.test(String(no.props.testID)),
    );
  const verTodas = () =>
    tree.root.findAll(
      no =>
        no.props.testID === 'botao-ver-todas' &&
        no.props.accessibilityRole === 'button',
    );
  const telaTransacoes = () =>
    tree.root.findAll(no => no.props.testID === 'transacoes-screen');

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
      tree.unmount();
    });
    jest.useRealTimers();
  });

  it('mostra no máximo 5 transações', async () => {
    await renderizar(repositorioCheio);
    expect(itensNaTela()).toHaveLength(5);
  });

  it('esconde "Ver todas" quando não há transações', async () => {
    await renderizar();
    expect(verTodas()).toHaveLength(0);
  });

  it('"Ver todas" abre a tela de transações', async () => {
    await renderizar(repositorioCheio);
    expect(telaTransacoes()).toHaveLength(0);

    await act(async () => {
      verTodas()[0].props.onPress();
    });

    expect(telaTransacoes().length).toBeGreaterThan(0);
  });
});
