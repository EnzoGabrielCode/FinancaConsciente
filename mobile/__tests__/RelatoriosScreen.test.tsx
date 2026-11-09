import React from 'react';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {PaperProvider} from 'react-native-paper';
import renderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import {GerarRelatorios} from '../src/domain/casosDeUso/GerarRelatorios';
import type {FiltroRelatorio} from '../src/domain/entities/Relatorio';
import type {Transacao} from '../src/domain/entities/Transacao';
import {
  cancelamentoDeCompartilhar,
  type ExportadorArquivos,
} from '../src/domain/repositories/ExportadorArquivos';
import type {GeradorPdf} from '../src/domain/repositories/GeradorPdf';
import type {TransacaoRepository} from '../src/domain/repositories/TransacaoRepository';
import {atendeAoFiltro} from '../src/domain/relatorios';
import GraficoPatrimonio from '../src/presentation/components/GraficoPatrimonio';
import RelatoriosScreen from '../src/presentation/screens/RelatoriosScreen';
import type {SeletorData} from '../src/presentation/servicos/seletorData';
import {darkTheme} from '../src/presentation/theme';
import {CORES} from '../src/presentation/theme/cores';

let proximoId = 1;
const lancamento = (dados: Partial<Transacao>): Transacao => ({
  id: proximoId++,
  tipo: 'despesa',
  descricao: 'Mercado',
  valorCentavos: 1000,
  data: '2026-11-03',
  categoria: 'alimentacao',
  recorrencia: 'variavel',
  comprovanteUri: null,
  contaRecorrenteId: null,
  idExterno: null,
  sincronizado: false,
  ...dados,
});

const LANCAMENTOS = [
  lancamento({
    tipo: 'receita',
    descricao: 'Salário',
    categoria: 'salario',
    valorCentavos: 500000,
    data: '2026-11-05',
  }),
  lancamento({descricao: 'Mercado', valorCentavos: 8990}),
  lancamento({descricao: 'Show', categoria: 'lazer', valorCentavos: 125000}),
  lancamento({
    descricao: 'Uber',
    categoria: 'transporte',
    valorCentavos: 2000,
    data: '2026-10-15',
  }),
];

describe('RelatoriosScreen', () => {
  let tree: ReactTestRenderer;
  let exportador: {
    [K in keyof ExportadorArquivos]: jest.Mock<ExportadorArquivos[K]>;
  };
  let gerarPdf: jest.Mock<GeradorPdf['gerar']>;
  let escolher: jest.Mock<SeletorData['escolher']>;
  let gerador: GerarRelatorios;

  beforeEach(() => {
    jest.useFakeTimers({now: new Date(2026, 10, 9, 12)});
    exportador = {
      salvarTexto: jest.fn<ExportadorArquivos['salvarTexto']>(
        async n => `/c/${n}`,
      ),
      salvarBase64: jest.fn<ExportadorArquivos['salvarBase64']>(
        async n => `/c/${n}`,
      ),
      compartilhar: jest.fn<ExportadorArquivos['compartilhar']>(async () => {}),
    };
    gerarPdf = jest.fn<GeradorPdf['gerar']>(async () => 'JVBERi0=');
    escolher = jest.fn<SeletorData['escolher']>(async () => null);
    gerador = new GerarRelatorios(
      {
        listarPorPeriodo: async (filtro: FiltroRelatorio) =>
          LANCAMENTOS.filter(t => atendeAoFiltro(filtro, t)),
        saldoAte: async () => 100000,
        totaisPorMes: async () => [
          {anoMes: '2026-10', receitasCentavos: 0, despesasCentavos: 2000},
          {
            anoMes: '2026-11',
            receitasCentavos: 500000,
            despesasCentavos: 133990,
          },
        ],
      } as unknown as TransacaoRepository,
      exportador,
      {gerar: gerarPdf},
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
          <RelatoriosScreen
            visivel
            gerar={gerador}
            seletorData={{escolher}}
            onFechar={() => {}}
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
  const tocar = async (id: string) =>
    act(async () => {
      await tocavel(id).props.onPress();
    });
  const desabilitado = (id: string) =>
    tocavel(id).props.accessibilityState.disabled;

  it('abre no extrato deste mês com o resumo', async () => {
    await renderizar();

    expect(texto('relatorios-receitas')).toBe('R$ 5.000,00');
    expect(texto('relatorios-despesas')).toBe('R$ 1.339,90');
    expect(texto('relatorios-resultado')).toBe('R$ 3.660,10');
    expect(texto('relatorios-quantidade')).toBe('3 lançamentos');
    expect(existe('gasto-lazer')).toBe(true);
    expect(existe('gasto-transporte')).toBe(false);
    expect(desabilitado('exportar-pdf')).toBe(false);
  });

  it('mudar o período muda o resumo', async () => {
    await renderizar();
    await tocar('periodo-mes-passado');

    expect(texto('relatorios-quantidade')).toBe('1 lançamento');
    expect(texto('relatorios-despesas')).toBe('R$ 20,00');
    expect(existe('gasto-transporte')).toBe(true);
  });

  it('filtra por tipo e por categoria', async () => {
    await renderizar();
    await tocar('tipo-receita');
    expect(texto('relatorios-quantidade')).toBe('1 lançamento');

    await tocar('tipo-todos');
    await tocar('filtro-categoria');
    await tocar('categoria-lazer');
    expect(texto('relatorios-quantidade')).toBe('1 lançamento');
    expect(texto('relatorios-despesas')).toBe('R$ 1.250,00');

    await tocar('tipo-receita');
    expect(texto('relatorios-quantidade')).toBe('1 lançamento');
    expect(texto('relatorios-receitas')).toBe('R$ 5.000,00');
  });

  it('período personalizado usa o seletor de data', async () => {
    escolher
      .mockResolvedValueOnce('2026-06-01')
      .mockResolvedValueOnce('2026-06-30');
    await renderizar();
    await tocar('periodo-personalizado');
    await tocar('periodo-de');
    await tocar('periodo-ate');

    expect(escolher).toHaveBeenNthCalledWith(1, '2026-11-01', '2026-11-09');
    expect(texto('relatorios-vazio')).toBe('Nenhum lançamento neste período');
    expect(desabilitado('exportar-pdf')).toBe(true);
    expect(desabilitado('exportar-csv')).toBe(true);
  });

  it('data inicial depois da final mostra o erro e bloqueia exportar', async () => {
    escolher
      .mockResolvedValueOnce('2026-11-09')
      .mockResolvedValueOnce('2026-11-02');
    await renderizar();
    await tocar('periodo-personalizado');
    await tocar('periodo-de');
    await tocar('periodo-ate');

    expect(texto('relatorios-erro-filtro')).toBe(
      'A data inicial precisa ser antes da final.',
    );
    expect(desabilitado('exportar-pdf')).toBe(true);
  });

  it('exportar PDF chama o caso de uso e mostra "Gerando..."', async () => {
    let terminar!: () => void;
    exportador.compartilhar.mockImplementationOnce(
      () => new Promise(resolve => (terminar = () => resolve())),
    );
    await renderizar();

    await act(async () => {
      tocavel('exportar-pdf').props.onPress();
    });
    expect(texto('exportar-pdf')).toContain('Gerando...');
    expect(desabilitado('exportar-csv')).toBe(true);

    await act(async () => terminar());

    expect(gerarPdf).toHaveBeenCalledWith(
      expect.objectContaining({quantidade: 3}),
      expect.any(Date),
    );
    expect(exportador.compartilhar).toHaveBeenCalledWith(
      '/c/financaconsciente-2026-11-01-a-2026-11-09.pdf',
      'application/pdf',
      'Extrato em PDF',
    );
    expect(texto('exportar-pdf')).toContain('Exportar PDF');
  });

  it('exportar CSV compartilha o arquivo', async () => {
    await renderizar();
    await tocar('exportar-csv');
    expect(exportador.compartilhar).toHaveBeenCalledWith(
      '/c/financaconsciente-2026-11-01-a-2026-11-09.csv',
      'text/csv',
      'Extrato em CSV',
    );
  });

  it('erro ao exportar vira Snackbar; cancelar não', async () => {
    await renderizar();
    exportador.compartilhar.mockRejectedValueOnce(cancelamentoDeCompartilhar());
    await tocar('exportar-pdf');
    expect(
      tree.root.findAll(
        no => no.props.children === 'Compartilhamento cancelado.',
      ),
    ).toHaveLength(0);

    exportador.salvarBase64.mockRejectedValueOnce(
      new Error('Sem espaço no aparelho'),
    );
    await tocar('exportar-pdf');
    expect(
      tree.root.findAll(no => no.props.children === 'Sem espaço no aparelho'),
    ).not.toHaveLength(0);
  });

  it('a aba Patrimônio mostra o valor atual e a variação', async () => {
    await renderizar();
    await tocar('relatorios-aba-patrimonio');

    expect(existe('relatorios-extrato')).toBe(false);
    expect(texto('patrimonio-atual')).toBe('R$ 4.640,10');
    expect(texto('patrimonio-variacao')).toBe(
      '▲ +R$ 3.640,10 (+364,0%) desde dez. 2025',
    );
    expect(existe('grafico-patrimonio')).toBe(true);

    await tocar('relatorios-aba-extrato');
    expect(existe('relatorios-extrato')).toBe(true);
  });
});

describe('GraficoPatrimonio', () => {
  let tree: ReactTestRenderer;

  const serie = [
    {anoMes: '2026-09', patrimonioCentavos: 10000},
    {anoMes: '2026-10', patrimonioCentavos: -5000},
    {anoMes: '2026-11', patrimonioCentavos: 5000},
  ];

  beforeEach(() => {
    act(() => {
      tree = renderer.create(<GraficoPatrimonio serie={serie} />);
    });
  });

  const barra = (anoMes: string) =>
    tree.root.findAll(
      no =>
        typeof no.type === 'string' &&
        no.props.testID === `patrimonio-barra-${anoMes}`,
    )[0];
  const estilo = (anoMes: string) =>
    Object.assign({}, ...[barra(anoMes).props.style].flat(Infinity));
  const coluna = (anoMes: string) =>
    tree.root.findAll(
      no =>
        no.props.testID === `patrimonio-mes-${anoMes}` &&
        typeof no.props.onPress === 'function',
    )[0];
  function textoDe(no: ReactTestInstance): string {
    return no.children
      .map(filho => (typeof filho === 'string' ? filho : textoDe(filho)))
      .join('');
  }
  const valorMostrado = () =>
    textoDe(
      tree.root.findAll(
        no =>
          typeof no.type === 'string' &&
          no.props.testID === 'grafico-patrimonio-valor',
      )[0],
    );

  it('mês negativo fica em vermelho abaixo da linha do zero', () => {
    expect(estilo('2026-10').backgroundColor.startsWith(CORES.vermelho)).toBe(
      true,
    );
    expect(estilo('2026-10').borderBottomLeftRadius).toBe(4);
    expect(estilo('2026-09').borderTopLeftRadius).toBe(4);
  });

  it('a escala divide a altura pelos maiores valores', () => {
    // 10000 acima e 5000 abaixo: dois terços da altura para cima.
    expect(estilo('2026-09').height).toBeCloseTo(80);
    expect(estilo('2026-10').height).toBeCloseTo(40);
    expect(estilo('2026-11').height).toBeCloseTo(40);
  });

  it('começa no mês atual e tocar mostra outro mês', () => {
    expect(valorMostrado()).toBe('Novembro 2026: R$ 50,00');
    act(() => coluna('2026-10').props.onPress());
    expect(valorMostrado()).toBe('Outubro 2026: -R$ 50,00');
    expect(coluna('2026-10').props.accessibilityState).toEqual({
      selected: true,
    });
  });

  it('cada coluna tem o valor no accessibilityLabel e o rótulo do mês', () => {
    expect(coluna('2026-10').props.accessibilityLabel).toBe(
      'Outubro 2026: -R$ 50,00',
    );
    expect(
      tree.root.findAll(no => no.props.children?.join?.('') === 'out.'),
    ).not.toHaveLength(0);
  });
});
