import {AppState} from 'react-native';
import React from 'react';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {PaperProvider} from 'react-native-paper';
import renderer, {act, type ReactTestRenderer} from 'react-test-renderer';

import type {Transacao} from '../src/domain/entities/Transacao';
import type {ArmazenamentoComprovantes} from '../src/domain/repositories/ArmazenamentoComprovantes';
import type {CofreRepository} from '../src/domain/repositories/CofreRepository';
import type {ContaRecorrenteRepository} from '../src/domain/repositories/ContaRecorrenteRepository';
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
  lancarRecorrente: async () => true,
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
  agendar: async () => {},
  cancelarComPrefixo: async () => {},
};

const repositorioContas: ContaRecorrenteRepository = {
  listar: async () => [],
  buscarPorId: async () => null,
  criar: async () => 1,
  atualizar: async () => {},
  excluir: async () => {},
  definirAtiva: async () => {},
  avancarProxima: async () => {},
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
          repositorioContas={repositorioContas}
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
    contaRecorrenteId: null,
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

describe('HomeScreen: contas fixas', () => {
  const contaVencida = (id: number) => ({
    id,
    descricao: `Conta ${id}`,
    valorCentavos: 1000,
    categoria: 'lazer',
    frequencia: 'mensal' as const,
    dia: 1,
    mes: null,
    lembrarDiasAntes: 2,
    ativa: true,
    proxima: '2000-01-01',
  });

  let eventos: string[];
  let lancarRecorrente: jest.Mock<TransacaoRepository['lancarRecorrente']>;
  let listar: jest.Mock<ContaRecorrenteRepository['listar']>;
  let contas: ReturnType<typeof contaVencida>[];

  async function renderizarComContas() {
    await act(async () => {
      tree = renderer.create(
        <PaperProvider theme={darkTheme}>
          <HomeScreen
            repositorio={{
              ...repositorio,
              lancarRecorrente,
              listarRecentes: async () => {
                eventos.push('recarregou');
                return [];
              },
            }}
            armazenamento={armazenamento}
            repositorioCofres={repositorioCofres}
            repositorioOrcamentos={repositorioOrcamentos}
            repositorioContas={{
              ...repositorioContas,
              listar,
              avancarProxima: async (id, proxima) => {
                contas = contas.map(c => (c.id === id ? {...c, proxima} : c));
              },
              buscarPorId: async id => contas.find(c => c.id === id) ?? null,
            }}
            notificador={notificador}
          />
        </PaperProvider>,
      );
    });
  }

  beforeEach(() => {
    jest.useFakeTimers();
    eventos = [];
    lancarRecorrente = jest.fn<TransacaoRepository['lancarRecorrente']>(
      async () => {
        eventos.push('lançou');
        return true;
      },
    );
    contas = [contaVencida(1), contaVencida(2)];
    listar = jest.fn<ContaRecorrenteRepository['listar']>(async () => contas);
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
      tree.unmount();
    });
    jest.useRealTimers();
  });

  it('avisa quantas contas lançou ao abrir o app', async () => {
    jest.setSystemTime(new Date(2000, 0, 15, 12));
    await renderizarComContas();

    expect(lancarRecorrente).toHaveBeenCalledTimes(2);
    expect(temTexto('2 contas fixas lançadas')).toBe(true);
  });

  it('recarrega as transações depois de lançar', async () => {
    jest.setSystemTime(new Date(2000, 0, 15, 12));
    await renderizarComContas();

    expect(eventos.lastIndexOf('recarregou')).toBeGreaterThan(
      eventos.lastIndexOf('lançou'),
    );
  });

  it('usa o singular com uma conta', async () => {
    jest.setSystemTime(new Date(2000, 0, 15, 12));
    contas = [contaVencida(1)];
    await renderizarComContas();

    expect(temTexto('1 conta fixa lançada')).toBe(true);
  });

  it('sem nada vencido não mostra o aviso', async () => {
    listar.mockImplementation(async () => []);
    await renderizarComContas();

    expect(lancarRecorrente).not.toHaveBeenCalled();
    expect(temTexto('1 conta fixa lançada')).toBe(false);
  });

  it('sincroniza de novo quando o app volta ao primeiro plano', async () => {
    listar.mockImplementation(async () => []);
    const ouvir = AppState.addEventListener as unknown as jest.Mock<
      (evento: string, ouvinte: (estado: string) => void) => void
    >;
    ouvir.mockClear();
    await renderizarComContas();
    listar.mockClear();

    await act(async () => {
      for (const [evento, ouvinte] of ouvir.mock.calls) {
        if (evento === 'change') {
          ouvinte('active');
        }
      }
    });

    expect(listar).toHaveBeenCalled();
  });

  it('um erro no banco não derruba a tela', async () => {
    listar.mockRejectedValue(new Error('banco fechado'));
    await renderizarComContas();

    expect(aba('aba-inicio')).toBeDefined();
  });
});
