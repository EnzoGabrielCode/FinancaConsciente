import React, {useMemo} from 'react';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {PaperProvider} from 'react-native-paper';
import renderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import {GerenciarContasRecorrentes} from '../src/domain/casosDeUso/GerenciarContasRecorrentes';
import {SugerirCategoria} from '../src/domain/casosDeUso/SugerirCategoria';
import {GerenciarOrcamentos} from '../src/domain/casosDeUso/GerenciarOrcamentos';
import type {
  ContaRecorrente,
  DadosContaRecorrente,
} from '../src/domain/entities/ContaRecorrente';
import type {ContaRecorrenteRepository} from '../src/domain/repositories/ContaRecorrenteRepository';
import type {Notificador} from '../src/domain/repositories/Notificador';
import type {OrcamentoRepository} from '../src/domain/repositories/OrcamentoRepository';
import type {TransacaoRepository} from '../src/domain/repositories/TransacaoRepository';
import ContaRecorrenteFormSheet from '../src/presentation/components/ContaRecorrenteFormSheet';
import {useContasRecorrentes} from '../src/presentation/hooks/useContasRecorrentes';
import {useOrcamentos} from '../src/presentation/hooks/useOrcamentos';
import OrcamentosScreen, {
  AVISO_PERMISSAO,
} from '../src/presentation/screens/OrcamentosScreen';
import {darkTheme} from '../src/presentation/theme';

class ContasEmMemoria implements ContaRecorrenteRepository {
  contas: ContaRecorrente[] = [];

  listar = async () => this.contas.map(c => ({...c}));

  buscarPorId = async (id: number) =>
    this.contas.find(c => c.id === id) ?? null;

  criar = jest.fn(async (dados: DadosContaRecorrente, proxima: string) => {
    const id = this.contas.length + 1;
    this.contas.push({...dados, id, proxima});
    return id;
  });

  atualizar = jest.fn(
    async (id: number, dados: DadosContaRecorrente, proxima: string) => {
      this.contas = this.contas.map(c =>
        c.id === id ? {...dados, id, proxima} : c,
      );
    },
  );

  excluir = jest.fn(async (id: number) => {
    this.contas = this.contas.filter(c => c.id !== id);
  });

  definirAtiva = jest.fn(async (id: number, ativa: boolean) => {
    this.contas = this.contas.map(c => (c.id === id ? {...c, ativa} : c));
  });

  avancarProxima = async (id: number, proxima: string) => {
    this.contas = this.contas.map(c => (c.id === id ? {...c, proxima} : c));
  };
}

const conta = (dados: Partial<ContaRecorrente> = {}): ContaRecorrente => ({
  id: 1,
  descricao: 'Internet',
  valorCentavos: 9990,
  categoria: 'outros',
  frequencia: 'mensal',
  dia: 10,
  mes: null,
  lembrarDiasAntes: 2,
  ativa: true,
  proxima: '2026-11-10',
  ...dados,
});

const orcamentosVazios: OrcamentoRepository = {
  listar: async () => [],
  salvar: async () => {},
  excluir: async () => {},
  registrarAlerta: async () => true,
};

describe('Planejamento: contas fixas', () => {
  let tree: ReactTestRenderer;
  let repositorio: ContasEmMemoria;
  let notificador: {[K in keyof Notificador]: jest.Mock<Notificador[K]>};
  let aoAlterar: jest.Mock<() => void>;

  function Tela(): React.JSX.Element {
    const transacoes = useMemo(
      () =>
        ({
          gastosPorCategoria: async () => ({}),
          lancarRecorrente: async () => true,
        } as unknown as TransacaoRepository),
      [],
    );
    const gerenciarOrcamentos = useMemo(
      () => new GerenciarOrcamentos(orcamentosVazios, transacoes, notificador),
      [transacoes],
    );
    const gerenciarContas = useMemo(
      () =>
        new GerenciarContasRecorrentes(repositorio, transacoes, notificador),
      [transacoes],
    );
    return (
      <OrcamentosScreen
        visivel
        orcamentos={useOrcamentos(gerenciarOrcamentos)}
        contas={useContasRecorrentes(gerenciarContas, undefined, aoAlterar)}
        onFechar={() => {}}
      />
    );
  }

  beforeEach(() => {
    jest.useFakeTimers({now: new Date(2026, 10, 7, 12)});
    repositorio = new ContasEmMemoria();
    aoAlterar = jest.fn();
    notificador = {
      pedirPermissao: jest.fn<Notificador['pedirPermissao']>(async () => true),
      notificar: jest.fn<Notificador['notificar']>(async () => {}),
      agendar: jest.fn<Notificador['agendar']>(async () => {}),
      cancelarComPrefixo: jest.fn<Notificador['cancelarComPrefixo']>(
        async () => {},
      ),
    };
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
          <Tela />
        </PaperProvider>,
      );
    });
  }

  const comId = (id: string) =>
    tree.root.findAll(
      no => typeof no.type === 'string' && no.props.testID === id,
    );

  function textoDe(no: ReactTestInstance): string {
    return no.children
      .map(filho => (typeof filho === 'string' ? filho : textoDe(filho)))
      .join('');
  }

  const texto = (id: string) => textoDe(comId(id)[0]);

  const temTexto = (valor: string) =>
    tree.root.findAll(no => no.props.children === valor).length > 0;

  const interativo = (id: string, prop = 'onPress') => {
    const [alvo] = tree.root.findAll(
      no => no.props.testID === id && typeof no.props[prop] === 'function',
    );
    if (!alvo) {
      throw new Error(`Nada com ${prop} e testID "${id}"`);
    }
    return alvo;
  };

  async function tocar(id: string, vezes = 1) {
    for (let i = 0; i < vezes; i++) {
      await act(async () => {
        await interativo(id).props.onPress();
      });
    }
  }

  async function abrirContas() {
    await renderizar();
    await tocar('planejamento-aba-contas');
  }

  async function preencher(descricao = 'Internet') {
    await tocar('orcamentos-adicionar');
    await act(async () => {
      interativo('conta-descricao-input', 'onChangeText').props.onChangeText(
        descricao,
      );
    });
    for (const tecla of ['9', '9']) {
      await tocar(`tecla-${tecla}`);
    }
    await tocar('conta-categoria-lazer');
  }

  describe('seletor', () => {
    it('começa em Orçamentos e troca de aba', async () => {
      await renderizar();
      const selecionada = (id: string) =>
        interativo(`planejamento-aba-${id}`).props.accessibilityState.selected;

      expect(selecionada('orcamentos')).toBe(true);
      expect(comId('orcamentos-lista')).not.toHaveLength(0);
      expect(comId('contas-lista')).toHaveLength(0);

      await tocar('planejamento-aba-contas');

      expect(selecionada('contas')).toBe(true);
      expect(selecionada('orcamentos')).toBe(false);
      expect(comId('contas-lista')).not.toHaveLength(0);
      expect(comId('orcamentos-lista')).toHaveLength(0);
    });

    it('"+ Adicionar" abre o formulário da aba ativa', async () => {
      await renderizar();
      await tocar('orcamentos-adicionar');
      expect(comId('orcamento-form-sheet')).toHaveLength(1);
      expect(comId('conta-form-sheet')).toHaveLength(0);
    });

    it('nas contas "+ Adicionar" abre o formulário de conta', async () => {
      await abrirContas();
      await tocar('orcamentos-adicionar');
      expect(comId('conta-form-sheet')).toHaveLength(1);
      expect(comId('orcamento-form-sheet')).toHaveLength(0);
    });
  });

  describe('lista', () => {
    it('mostra o estado vazio', async () => {
      await abrirContas();

      expect(comId('contas-vazio')).toHaveLength(1);
      expect(temTexto('Nenhuma conta fixa')).toBe(true);
      expect(comId('contas-resumo')).toHaveLength(0);
      expect(comId('contas-testar-lembrete')).toHaveLength(0);
    });

    it('mostra o resumo e o card', async () => {
      repositorio.contas = [
        conta(),
        conta({
          id: 2,
          descricao: 'Seguro',
          frequencia: 'anual',
          dia: 15,
          mes: 3,
          valorCentavos: 120000,
          proxima: '2027-03-15',
        }),
        conta({id: 3, descricao: 'Pausada', ativa: false}),
      ];
      await abrirContas();

      expect(texto('contas-total')).toBe('R$ 199,90');
      expect(texto('contas-ativas')).toBe('2 contas ativas');
      expect(texto('conta-valor-1')).toBe('R$ 99,90');
      expect(texto('conta-frequencia-1')).toBe('Todo dia 10');
      expect(texto('conta-proximo-1')).toBe('Próximo: 10 de nov. · em 3 dias');
      expect(texto('conta-frequencia-2')).toBe('Todo ano em 15 de mar.');
      expect(texto('conta-proximo-3')).toBe('Pausada');
    });

    it('diz "hoje" e "amanhã"', async () => {
      repositorio.contas = [
        conta({proxima: '2026-11-07'}),
        conta({id: 2, proxima: '2026-11-08'}),
      ];
      await abrirContas();

      expect(texto('conta-proximo-1')).toBe('Próximo: 7 de nov. · hoje');
      expect(texto('conta-proximo-2')).toBe('Próximo: 8 de nov. · amanhã');
    });

    it('o Switch pausa e retoma', async () => {
      repositorio.contas = [conta()];
      await abrirContas();
      const alternar = async (ativa: boolean) =>
        act(async () => {
          await interativo(
            'conta-ativa-1',
            'onValueChange',
          ).props.onValueChange(ativa);
        });

      await alternar(false);

      expect(repositorio.definirAtiva).toHaveBeenLastCalledWith(1, false);
      expect(notificador.cancelarComPrefixo).toHaveBeenCalledWith('conta-1-');
      expect(texto('conta-proximo-1')).toBe('Pausada');
      expect(texto('contas-ativas')).toBe('0 contas ativas');

      await alternar(true);

      expect(repositorio.definirAtiva).toHaveBeenLastCalledWith(1, true);
      expect(texto('conta-proximo-1')).toBe('Próximo: 10 de nov. · em 3 dias');
      expect(notificador.agendar).toHaveBeenCalled();
    });

    it('avisa quando pausar falha', async () => {
      repositorio.contas = [conta()];
      repositorio.definirAtiva.mockRejectedValueOnce(
        new Error('Falha no banco'),
      );
      await abrirContas();

      await act(async () => {
        await interativo('conta-ativa-1', 'onValueChange').props.onValueChange(
          false,
        );
      });

      expect(temTexto('Falha no banco')).toBe(true);
    });

    it('em __DEV__ o botão agenda o lembrete de teste', async () => {
      repositorio.contas = [conta()];
      await abrirContas();

      await tocar('contas-testar-lembrete');

      expect(notificador.agendar).toHaveBeenCalledWith(
        'teste-conta-1',
        new Date(2026, 10, 7, 12, 0, 10),
        expect.any(String),
        expect.any(String),
      );
    });
  });

  describe('formulário', () => {
    it('cria uma conta mensal com os padrões', async () => {
      await abrirContas();
      await preencher();
      expect(texto('conta-form-titulo')).toBe('Nova Conta');

      await tocar('conta-form-salvar');

      expect(repositorio.criar).toHaveBeenCalledWith(
        {
          descricao: 'Internet',
          valorCentavos: 9900,
          categoria: 'lazer',
          frequencia: 'mensal',
          dia: 7,
          mes: null,
          lembrarDiasAntes: 2,
          ativa: true,
        },
        '2026-11-07',
      );
      expect(comId('conta-form-sheet')).toHaveLength(0);
      expect(comId('conta-card-1')).not.toHaveLength(0);
      expect(aoAlterar).toHaveBeenCalled();
    });

    it('só deixa salvar com descrição, valor e categoria', async () => {
      await abrirContas();
      await tocar('orcamentos-adicionar');
      const desabilitado = () =>
        interativo('conta-form-salvar').props.accessibilityState.disabled;

      expect(desabilitado()).toBe(true);
      await act(async () => {
        interativo('conta-descricao-input', 'onChangeText').props.onChangeText(
          'Luz',
        );
      });
      expect(desabilitado()).toBe(true);
      await tocar('tecla-5');
      expect(desabilitado()).toBe(true);
      await tocar('conta-categoria-lazer');
      expect(desabilitado()).toBe(false);
    });

    it('mostra o mês só no anual e envia dia e mês', async () => {
      await abrirContas();
      await preencher('Seguro');
      expect(comId('conta-mes')).toHaveLength(0);

      await tocar('conta-frequencia-anual');
      expect(texto('conta-mes')).toBe('Novembro');

      await tocar('conta-mes-proximo');
      expect(texto('conta-mes')).toBe('Dezembro');
      expect(
        interativo('conta-mes-proximo').props.accessibilityState.disabled,
      ).toBe(true);
      expect(texto('conta-previa')).toBe('Primeiro lançamento: 7 de dez.');

      await tocar('conta-lembrete-7');
      await tocar('conta-form-salvar');

      expect(repositorio.criar).toHaveBeenCalledWith(
        expect.objectContaining({
          frequencia: 'anual',
          dia: 7,
          mes: 12,
          lembrarDiasAntes: 7,
        }),
        '2026-12-07',
      );
    });

    it('voltar para mensal não envia o mês', async () => {
      await abrirContas();
      await preencher();
      await tocar('conta-frequencia-anual');
      await tocar('conta-frequencia-mensal');
      await tocar('conta-form-salvar');

      expect(repositorio.criar).toHaveBeenCalledWith(
        expect.objectContaining({frequencia: 'mensal', mes: null}),
        expect.any(String),
      );
    });

    it('explica o dia maior que 28 e respeita os limites', async () => {
      await abrirContas();
      await tocar('orcamentos-adicionar');
      expect(texto('conta-dia')).toBe('Dia 7');

      await tocar('conta-dia-proximo', 22);
      expect(texto('conta-dia')).toBe('Dia 29 (ou o último dia do mês)');

      await tocar('conta-dia-proximo', 2);
      expect(texto('conta-dia')).toBe('Dia 31 (ou o último dia do mês)');
      expect(
        interativo('conta-dia-proximo').props.accessibilityState.disabled,
      ).toBe(true);
      expect(texto('conta-previa')).toBe('Primeiro lançamento: 30 de nov.');

      await tocar('conta-dia-anterior', 30);
      expect(texto('conta-dia')).toBe('Dia 1');
      expect(
        interativo('conta-dia-anterior').props.accessibilityState.disabled,
      ).toBe(true);
      expect(texto('conta-previa')).toBe('Primeiro lançamento: 1 de dez.');
    });

    it('pede a permissão na primeira conta e avisa se negada', async () => {
      notificador.pedirPermissao.mockResolvedValue(false);
      await abrirContas();
      await preencher();
      await tocar('conta-form-salvar');

      expect(notificador.pedirPermissao).toHaveBeenCalledTimes(1);
      expect(temTexto(AVISO_PERMISSAO)).toBe(true);
      expect(comId('conta-card-1')).not.toHaveLength(0);
    });

    it('não pede a permissão a partir da segunda conta', async () => {
      repositorio.contas = [conta()];
      await abrirContas();
      await preencher('Luz');
      await tocar('conta-form-salvar');

      expect(notificador.pedirPermissao).not.toHaveBeenCalled();
    });

    it('avisa quando a conta nova já foi lançada', async () => {
      await abrirContas();
      await preencher();
      await tocar('conta-form-salvar');

      expect(temTexto('1 conta fixa lançada')).toBe(true);
    });

    it('edita mantendo a data e a pausa', async () => {
      repositorio.contas = [conta({ativa: false, proxima: '2026-12-10'})];
      await abrirContas();

      await tocar('conta-abrir-1');
      expect(texto('conta-form-titulo')).toBe('Editar Conta');
      expect(texto('conta-valor')).toBe('99,90');
      expect(texto('conta-previa')).toBe('Próximo lançamento: 10 de dez.');

      await tocar('tecla-⌫', 2);
      await tocar('conta-form-salvar');

      expect(repositorio.atualizar).toHaveBeenCalledWith(
        1,
        expect.objectContaining({valorCentavos: 9900, ativa: false}),
        '2026-12-10',
      );
      expect(temTexto('Conta atualizada')).toBe(true);
    });

    it('mostra a data nova na prévia ao mudar o dia', async () => {
      repositorio.contas = [conta({proxima: '2026-12-10'})];
      await abrirContas();
      await tocar('conta-abrir-1');

      await tocar('conta-dia-proximo');

      expect(texto('conta-previa')).toBe('Primeiro lançamento: 11 de nov.');
    });

    it('exclui depois de confirmar, explicando o que continua', async () => {
      repositorio.contas = [conta()];
      await abrirContas();
      await tocar('conta-abrir-1');
      await tocar('conta-form-excluir');
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      expect(texto('dialogo-exclusao-mensagem')).toContain(
        'despesas já lançadas continuam',
      );
      expect(repositorio.excluir).not.toHaveBeenCalled();

      await tocar('confirmar-exclusao');
      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      expect(repositorio.excluir).toHaveBeenCalledWith(1);
      expect(notificador.cancelarComPrefixo).toHaveBeenCalledWith('conta-1-');
      expect(comId('conta-form-sheet')).toHaveLength(0);
      expect(temTexto('Conta excluída')).toBe(true);
    });

    it('mostra o erro de salvar sem fechar', async () => {
      repositorio.criar.mockRejectedValueOnce(new Error('Falha no banco'));
      await abrirContas();
      await preencher();
      await tocar('conta-form-salvar');

      expect(texto('conta-form-erro')).toBe('Falha no banco');
      expect(comId('conta-form-sheet')).toHaveLength(1);
    });
  });

  describe('categoria sugerida', () => {
    async function abrirFormulario(existente?: ContaRecorrente) {
      await act(async () => {
        tree = renderer.create(
          <PaperProvider theme={darkTheme}>
            <ContaRecorrenteFormSheet
              visivel
              conta={existente ?? null}
              onFechar={() => {}}
              onSalvar={async () => {}}
              onExcluir={async () => {}}
              sugeridorCategoria={
                new SugerirCategoria({
                  exemplosDeCategoria: async () => [],
                } as unknown as TransacaoRepository)
              }
            />
          </PaperProvider>,
        );
      });
    }

    const chip = (id: string) =>
      tree.root.findAll(
        no =>
          no.props.testID === `conta-categoria-${id}` &&
          no.props.accessibilityRole === 'radio',
      )[0];

    async function escrever(descricao: string) {
      await act(async () => {
        interativo('conta-descricao-input', 'onChangeText').props.onChangeText(
          descricao,
        );
      });
      await act(async () => {
        jest.advanceTimersByTime(250);
      });
    }

    it('"Netflix" sugere Lazer com o selo', async () => {
      await abrirFormulario();
      await escrever('Netflix');

      expect(chip('lazer').props.accessibilityState.checked).toBe(true);
      expect(chip('lazer').props.accessibilityLabel).toBe(
        'Lazer, sugerida automaticamente',
      );
      expect(texto('conta-selo-sugerida-lazer')).toBe('✨ Sugerida');
    });

    it('depois de escolher, a descrição não muda mais a categoria', async () => {
      await abrirFormulario();
      await escrever('Netflix');
      await act(async () => {
        await interativo('conta-categoria-compras').props.onPress();
      });
      await escrever('Netflix família');

      expect(chip('compras').props.accessibilityState.checked).toBe(true);
      expect(comId('conta-selo-sugerida-compras')).toHaveLength(0);
    });

    it('na edição mantém a categoria da conta', async () => {
      await abrirFormulario(conta({categoria: 'compras'}));
      await escrever('Netflix');

      expect(chip('compras').props.accessibilityState.checked).toBe(true);
      expect(chip('lazer').props.accessibilityState.checked).toBe(false);
    });
  });
});
