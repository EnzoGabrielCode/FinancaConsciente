import React, {useMemo} from 'react';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {PaperProvider} from 'react-native-paper';
import renderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import {GerenciarContasRecorrentes} from '../src/domain/casosDeUso/GerenciarContasRecorrentes';
import {GerenciarOrcamentos} from '../src/domain/casosDeUso/GerenciarOrcamentos';
import {CATEGORIAS_DESPESA} from '../src/domain/categorias';
import {anoMesDe, hojeISO, nomeMesAno} from '../src/domain/datas';
import type {DadosOrcamento, Orcamento} from '../src/domain/entities/Orcamento';
import type {ContaRecorrenteRepository} from '../src/domain/repositories/ContaRecorrenteRepository';
import type {Notificador} from '../src/domain/repositories/Notificador';
import type {OrcamentoRepository} from '../src/domain/repositories/OrcamentoRepository';
import type {TransacaoRepository} from '../src/domain/repositories/TransacaoRepository';
import {useContasRecorrentes} from '../src/presentation/hooks/useContasRecorrentes';
import {useOrcamentos} from '../src/presentation/hooks/useOrcamentos';
import OrcamentosScreen, {
  AVISO_PERMISSAO,
} from '../src/presentation/screens/OrcamentosScreen';
import {darkTheme} from '../src/presentation/theme';

class OrcamentosEmMemoria implements OrcamentoRepository {
  orcamentos: Orcamento[] = [];

  listar = async () => [...this.orcamentos];

  salvar = jest.fn(async ({categoria, limiteCentavos}: DadosOrcamento) => {
    const existente = this.orcamentos.find(o => o.categoria === categoria);
    if (existente) {
      existente.limiteCentavos = limiteCentavos;
    } else {
      const id = this.orcamentos.length + 1;
      this.orcamentos.push({id, categoria, limiteCentavos});
    }
  });

  excluir = jest.fn(async (id: number) => {
    this.orcamentos = this.orcamentos.filter(o => o.id !== id);
  });

  registrarAlerta = async () => true;
}

describe('OrcamentosScreen', () => {
  let tree: ReactTestRenderer;
  let repositorio: OrcamentosEmMemoria;
  let gastos: Record<string, number>;
  let pedirPermissao: jest.Mock<Notificador['pedirPermissao']>;

  const notificador: Notificador = {
    pedirPermissao: () => pedirPermissao(),
    notificar: async () => {},
    agendar: async () => {},
    cancelarComPrefixo: async () => {},
  };

  function Tela(): React.JSX.Element {
    const gerenciar = useMemo(
      () =>
        new GerenciarOrcamentos(
          repositorio,
          {
            gastosPorCategoria: async () => gastos,
          } as unknown as TransacaoRepository,
          notificador,
        ),
      [],
    );
    const orcamentos = useOrcamentos(gerenciar);
    const gerenciarContas = useMemo(
      () =>
        new GerenciarContasRecorrentes(
          {listar: async () => []} as unknown as ContaRecorrenteRepository,
          {} as TransacaoRepository,
          notificador,
        ),
      [],
    );
    const contas = useContasRecorrentes(gerenciarContas);
    return (
      <OrcamentosScreen
        visivel
        orcamentos={orcamentos}
        contas={contas}
        onFechar={() => {}}
      />
    );
  }

  beforeEach(() => {
    jest.useFakeTimers();
    repositorio = new OrcamentosEmMemoria();
    gastos = {};
    pedirPermissao = jest.fn<Notificador['pedirPermissao']>(async () => true);
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

  const tocavel = (id: string) => {
    const [alvo] = tree.root.findAll(
      no => no.props.testID === id && typeof no.props.onPress === 'function',
    );
    if (!alvo) {
      throw new Error(`Nada tocável com testID "${id}"`);
    }
    return alvo;
  };

  async function tocar(id: string) {
    await act(async () => {
      await tocavel(id).props.onPress();
    });
  }

  async function digitar(...teclas: string[]) {
    for (const tecla of teclas) {
      await tocar(`tecla-${tecla}`);
    }
  }

  const comTresOrcamentos = () => {
    repositorio.orcamentos = [
      {id: 1, categoria: 'saude', limiteCentavos: 10000},
      {id: 2, categoria: 'lazer', limiteCentavos: 10000},
      {id: 3, categoria: 'compras', limiteCentavos: 10000},
    ];
    gastos = {saude: 1000, lazer: 8500, compras: 12000};
  };

  it('mostra o mês por extenso no cabeçalho', async () => {
    await renderizar();
    expect(texto('orcamentos-mes')).toBe(nomeMesAno(anoMesDe(hojeISO())));
  });

  it('mostra o resumo e a quantidade de categorias', async () => {
    comTresOrcamentos();
    await renderizar();

    expect(texto('orcamentos-total-limite')).toBe('R$ 300,00');
    expect(texto('orcamentos-total-gasto')).toBe('R$ 215,00');
    expect(texto('orcamentos-percentual')).toBe('71% utilizado');
    expect(texto('orcamentos-disponivel')).toBe('R$ 85,00');
    expect(texto('orcamentos-dias')).toMatch(/^Rest(a 1 dia|am \d+ dias)$/);
    expect(texto('orcamentos-quantidade')).toBe('3 categorias');
  });

  it('avisa quando o total passou do orçamento', async () => {
    repositorio.orcamentos = [
      {id: 1, categoria: 'lazer', limiteCentavos: 10000},
    ];
    gastos = {lazer: 15000};
    await renderizar();

    expect(texto('orcamentos-disponivel')).toBe('-R$ 50,00');
    expect(texto('orcamentos-dias')).toBe('Acima do orçamento');
    expect(texto('orcamentos-quantidade')).toBe('1 categoria');
  });

  it('mostra os cards com etiquetas, rodapés e acessibilidade', async () => {
    comTresOrcamentos();
    await renderizar();

    expect(comId('orcamento-etiqueta-saude')).toHaveLength(0);
    expect(texto('orcamento-etiqueta-lazer')).toBe('Perto do limite');
    expect(texto('orcamento-etiqueta-compras')).toBe('Estourado');

    expect(texto('orcamento-gasto-lazer')).toBe('Gasto: R$ 85,00 / R$ 100,00');
    expect(texto('orcamento-percentual-compras')).toBe('120%');
    expect(texto('orcamento-rodape-lazer')).toBe('Disponível: R$ 15,00');
    expect(texto('orcamento-rodape-compras')).toBe('Passou R$ 20,00 do limite');

    expect(tocavel('orcamento-lazer').props.accessibilityLabel).toBe(
      'Lazer, 85% do orçamento, perto do limite',
    );
    expect(tocavel('orcamento-saude').props.accessibilityLabel).toBe(
      'Saúde, 10% do orçamento, dentro do limite',
    );
  });

  it('ordena os cards do maior percentual para o menor', async () => {
    comTresOrcamentos();
    await renderizar();

    const cards = tree.root
      .findAll(
        no =>
          typeof no.type === 'string' &&
          /^orcamento-(saude|lazer|compras)$/.test(String(no.props.testID)),
      )
      .map(no => no.props.testID);
    expect(cards).toEqual([
      'orcamento-compras',
      'orcamento-lazer',
      'orcamento-saude',
    ]);
  });

  it('limita a barra a 100%', async () => {
    comTresOrcamentos();
    await renderizar();

    const [barra] = tree.root.findAll(
      no => no.props.testID === 'orcamento-barra-compras',
    );
    expect(barra.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({width: '100%'})]),
    );
  });

  it('não diz "Passou R$ 0,00" com o gasto igual ao limite', async () => {
    repositorio.orcamentos = [
      {id: 1, categoria: 'lazer', limiteCentavos: 10000},
    ];
    gastos = {lazer: 10000};
    await renderizar();

    expect(texto('orcamento-etiqueta-lazer')).toBe('Estourado');
    expect(texto('orcamento-rodape-lazer')).toBe('Disponível: R$ 0,00');
  });

  it('mostra o estado vazio', async () => {
    await renderizar();

    expect(comId('orcamentos-vazio')).toHaveLength(1);
    expect(temTexto('Nenhum orçamento ainda')).toBe(true);
    expect(
      temTexto('Defina um teto por categoria e avisamos quando chegar perto.'),
    ).toBe(true);
    expect(comId('orcamentos-resumo')).toHaveLength(0);
  });

  it('cria o primeiro orçamento e pede a permissão', async () => {
    await renderizar();

    await tocar('orcamentos-criar');
    expect(texto('orcamento-form-titulo')).toBe('Novo Orçamento');
    await tocar('orcamento-categoria-lazer');
    await digitar('1', '5', '0');
    await tocar('orcamento-form-salvar');

    expect(repositorio.salvar).toHaveBeenCalledWith({
      categoria: 'lazer',
      limiteCentavos: 15000,
    });
    expect(pedirPermissao).toHaveBeenCalledTimes(1);
    expect(comId('orcamento-lazer').length).toBeGreaterThan(0);
    expect(comId('orcamento-form-sheet')).toHaveLength(0);
    expect(temTexto(AVISO_PERMISSAO)).toBe(false);
  });

  it('com a permissão negada avisa e mantém o orçamento', async () => {
    pedirPermissao.mockResolvedValue(false);
    await renderizar();

    await tocar('orcamentos-criar');
    await tocar('orcamento-categoria-lazer');
    await digitar('1', '0');
    await tocar('orcamento-form-salvar');

    expect(temTexto(AVISO_PERMISSAO)).toBe(true);
    expect(comId('orcamento-lazer').length).toBeGreaterThan(0);
  });

  it('não pede a permissão a partir do segundo orçamento', async () => {
    comTresOrcamentos();
    await renderizar();

    await tocar('orcamentos-adicionar');
    await tocar('orcamento-categoria-transporte');
    await digitar('1', '0');
    await tocar('orcamento-form-salvar');

    expect(repositorio.salvar).toHaveBeenCalledTimes(1);
    expect(pedirPermissao).not.toHaveBeenCalled();
  });

  it('só oferece as categorias livres ao criar', async () => {
    comTresOrcamentos();
    await renderizar();
    await tocar('orcamentos-adicionar');

    expect(comId('orcamento-categoria-transporte')).toHaveLength(1);
    expect(comId('orcamento-categoria-lazer')).toHaveLength(0);
  });

  it('desabilita "+ Adicionar" sem categorias livres', async () => {
    repositorio.orcamentos = CATEGORIAS_DESPESA.map((categoria, i) => ({
      id: i + 1,
      categoria: categoria.id,
      limiteCentavos: 10000,
    }));
    await renderizar();

    const [botao] = tree.root.findAll(
      no =>
        no.props.testID === 'orcamentos-adicionar' &&
        no.props.accessibilityRole === 'button',
    );
    expect(botao.props.accessibilityState).toMatchObject({disabled: true});
  });

  it('não deixa salvar sem categoria ou sem valor', async () => {
    await renderizar();
    await tocar('orcamentos-criar');
    const desabilitado = () =>
      tocavel('orcamento-form-salvar').props.accessibilityState.disabled;

    expect(desabilitado()).toBe(true);
    await digitar('1', '0');
    expect(desabilitado()).toBe(true);
    await tocar('orcamento-categoria-lazer');
    expect(desabilitado()).toBe(false);
  });

  it('recusa limite acima do máximo', async () => {
    await renderizar();
    await tocar('orcamentos-criar');
    await tocar('orcamento-categoria-lazer');
    await digitar('1', '0', '0', '0', '0', '0', '0', '0', '0');
    await tocar('orcamento-form-salvar');

    expect(comId('orcamento-erro-limite').length).toBeGreaterThan(0);
    expect(repositorio.salvar).not.toHaveBeenCalled();
  });

  it('edita o limite com a categoria fixa', async () => {
    comTresOrcamentos();
    await renderizar();

    await tocar('orcamento-lazer');
    expect(texto('orcamento-form-titulo')).toBe('Editar Orçamento');
    expect(texto('orcamento-valor')).toBe('100');
    expect(comId('orcamento-categoria-fixa')).toHaveLength(1);
    expect(comId('orcamento-categoria-transporte')).toHaveLength(0);

    await digitar('0');
    await tocar('orcamento-form-salvar');

    expect(repositorio.salvar).toHaveBeenCalledWith({
      categoria: 'lazer',
      limiteCentavos: 100000,
    });
    expect(texto('orcamento-gasto-lazer')).toBe(
      'Gasto: R$ 85,00 / R$ 1.000,00',
    );
    expect(pedirPermissao).not.toHaveBeenCalled();
  });

  it('exclui pelo sheet depois de confirmar', async () => {
    comTresOrcamentos();
    await renderizar();

    await tocar('orcamento-lazer');
    await tocar('orcamento-form-excluir');
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(repositorio.excluir).not.toHaveBeenCalled();

    await tocar('confirmar-exclusao');
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(repositorio.excluir).toHaveBeenCalledWith(2);
    expect(comId('orcamento-lazer')).toHaveLength(0);
    expect(comId('orcamento-form-sheet')).toHaveLength(0);
    expect(temTexto('Orçamento excluído')).toBe(true);
  });

  it('mostra o erro de carga sem o estado vazio e tenta de novo', async () => {
    const listar = repositorio.listar;
    repositorio.listar = async () => {
      throw new Error('banco fechado');
    };
    await renderizar();
    expect(comId('orcamentos-erro')).toHaveLength(1);
    expect(comId('orcamentos-vazio')).toHaveLength(0);

    repositorio.listar = listar;
    const tentar = tree.root
      .findAll(
        no =>
          no.props.accessibilityRole === 'button' &&
          typeof no.props.onPress === 'function',
      )
      .find(
        no =>
          no.findAll(filho => filho.props.children === 'Tentar novamente')
            .length,
      );
    await act(async () => {
      await tentar?.props.onPress();
    });

    expect(comId('orcamentos-erro')).toHaveLength(0);
    expect(comId('orcamentos-vazio')).toHaveLength(1);
  });
});
