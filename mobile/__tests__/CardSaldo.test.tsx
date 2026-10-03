import 'react-native';
import React from 'react';
import {describe, expect, it} from '@jest/globals';
import {StyleSheet} from 'react-native';
import renderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import {montarDashboard} from '../src/domain/dashboard';
import type {
  ResumoDashboard,
  TotaisMes,
} from '../src/domain/entities/Dashboard';
import CardSaldo from '../src/presentation/components/CardSaldo';
import {CORES} from '../src/presentation/theme/cores';

const TOTAIS: TotaisMes[] = [
  {anoMes: '2026-09', receitasCentavos: 800000, despesasCentavos: 450000},
  {anoMes: '2026-10', receitasCentavos: 850000, despesasCentavos: 324000},
];

function resumoCom(
  parcial: Partial<ResumoDashboard> = {},
  totaisPorMes: TotaisMes[] = TOTAIS,
): ResumoDashboard {
  return {
    ...montarDashboard({
      saldoAtualCentavos: 2462000,
      saldoFimMesAnteriorCentavos: 2307400,
      totaisPorMes,
      anoMesAtual: '2026-10',
    }),
    ...parcial,
  };
}

function renderizar(resumo: ResumoDashboard): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(<CardSaldo resumo={resumo} />);
  });
  return tree;
}

const textoDe = (no: ReactTestInstance): string =>
  no.children
    .map(filho => (typeof filho === 'string' ? filho : textoDe(filho)))
    .join('');

const porId = (tree: ReactTestRenderer, testID: string) =>
  tree.root.find(
    no => no.props.testID === testID && typeof no.type !== 'string',
  );

const existe = (tree: ReactTestRenderer, testID: string) =>
  tree.root.findAll(no => no.props.testID === testID).length > 0;

const corDe = (no: ReactTestInstance) =>
  StyleSheet.flatten(no.props.style).color;

describe('CardSaldo', () => {
  it('mostra o saldo dividido em moeda, inteiros e centavos', () => {
    const tree = renderizar(resumoCom());
    const saldo = porId(tree, 'saldo-atual');

    expect(textoDe(saldo)).toBe('R$ 24.620,00');
    expect(saldo.props.accessibilityLabel).toBe('Saldo atual: R$ 24.620,00');
    expect(corDe(porId(tree, 'saldo-inteiros'))).toBe(CORES.verde);
  });

  it('mostra receitas, despesas, poupado e a taxa de poupança do mês', () => {
    const tree = renderizar(resumoCom());

    expect(textoDe(porId(tree, 'receitas-mes'))).toBe('+R$ 8.500,00');
    expect(textoDe(porId(tree, 'despesas-mes'))).toBe('-R$ 3.240,00');
    expect(textoDe(porId(tree, 'poupado-mes'))).toBe('R$ 5.260,00');
    expect(corDe(porId(tree, 'poupado-mes'))).toBe(CORES.azul);
    expect(textoDe(porId(tree, 'poupado-mes-detalhe'))).toBe('62% da renda');
  });

  it('mostra o selo positivo em verde com seta para cima', () => {
    const tree = renderizar(resumoCom({variacaoSaldo: 0.067}));
    const selo = porId(tree, 'selo-variacao');

    expect(textoDe(selo)).toBe('+6,7% ↑');
    expect(corDe(selo)).toBe(CORES.verde);
  });

  it('mostra o selo negativo em vermelho com seta para baixo', () => {
    const tree = renderizar(resumoCom({variacaoSaldo: -0.032}));
    const selo = porId(tree, 'selo-variacao');

    expect(textoDe(selo)).toBe('-3,2% ↓');
    expect(corDe(selo)).toBe(CORES.vermelho);
  });

  it('não mostra o selo quando a variação é null', () => {
    const tree = renderizar(resumoCom({variacaoSaldo: null}));

    expect(existe(tree, 'selo-variacao')).toBe(false);
  });

  it('mostra saldo negativo em vermelho com "-" antes dos inteiros', () => {
    const tree = renderizar(resumoCom({saldoAtualCentavos: -152050}));
    const saldo = porId(tree, 'saldo-atual');

    expect(textoDe(saldo)).toBe('R$ -1.520,50');
    expect(saldo.props.accessibilityLabel).toBe('Saldo atual: -R$ 1.520,50');
    expect(corDe(porId(tree, 'saldo-inteiros'))).toBe(CORES.vermelho);
  });

  it('mostra poupado negativo em vermelho', () => {
    const tree = renderizar(
      resumoCom({}, [
        {anoMes: '2026-10', receitasCentavos: 100000, despesasCentavos: 150000},
      ]),
    );

    expect(textoDe(porId(tree, 'poupado-mes'))).toBe('-R$ 500,00');
    expect(corDe(porId(tree, 'poupado-mes'))).toBe(CORES.vermelho);
    expect(textoDe(porId(tree, 'poupado-mes-detalhe'))).toBe('-50% da renda');
  });

  it('não mostra a linha de cofres quando não há nada guardado', () => {
    const tree = renderizar(resumoCom());

    expect(existe(tree, 'saldo-disponivel')).toBe(false);
  });

  it('mostra o disponível e o total em cofres quando há algo guardado', () => {
    const tree = renderizar(
      resumoCom({guardadoCofresCentavos: 500000, disponivelCentavos: 1962000}),
    );
    const linha = porId(tree, 'saldo-disponivel');

    expect(textoDe(linha)).toBe(
      'R$ 19.620,00 disponível · R$ 5.000,00 em cofres',
    );
    expect(porId(tree, 'saldo-disponivel-valor').props.style).toBeNull();
  });

  it('mostra o disponível negativo em vermelho', () => {
    const tree = renderizar(
      resumoCom({
        saldoAtualCentavos: 30000,
        guardadoCofresCentavos: 50000,
        disponivelCentavos: -20000,
      }),
    );
    const linha = porId(tree, 'saldo-disponivel');

    expect(textoDe(linha)).toBe('-R$ 200,00 disponível · R$ 500,00 em cofres');
    expect(corDe(porId(tree, 'saldo-disponivel-valor'))).toBe(CORES.vermelho);
  });

  it('não mostra a taxa de poupança sem receitas no mês', () => {
    const tree = renderizar(resumoCom({}, []));

    expect(existe(tree, 'poupado-mes-detalhe')).toBe(false);
  });

  it('desenha as barras proporcionais com rótulo acessível por mês', () => {
    const tree = renderizar(resumoCom());
    const altura = (id: string) =>
      StyleSheet.flatten(porId(tree, id).props.style).height;

    expect(altura('barra-receita-2026-10')).toBe(64);
    expect(altura('barra-despesa-2026-10')).toBeCloseTo((324000 / 850000) * 64);
    expect(altura('barra-receita-2026-05')).toBe(0);
    expect(porId(tree, 'grafico-mes-2026-10').props.accessibilityLabel).toBe(
      'out: receitas R$ 8.500,00, despesas R$ 3.240,00',
    );
    expect(existe(tree, 'grafico-vazio')).toBe(false);
  });

  it('usa a altura mínima de 2 para valores pequenos', () => {
    const tree = renderizar(
      resumoCom({}, [
        {anoMes: '2026-10', receitasCentavos: 10000000, despesasCentavos: 1},
      ]),
    );

    expect(
      StyleSheet.flatten(porId(tree, 'barra-despesa-2026-10').props.style)
        .height,
    ).toBe(2);
  });

  it('sem lançamentos mostra o aviso no lugar das barras', () => {
    const tree = renderizar(resumoCom({}, []));

    expect(textoDe(porId(tree, 'grafico-vazio'))).toBe(
      'Sem lançamentos nos últimos meses',
    );
    expect(existe(tree, 'barra-receita-2026-10')).toBe(false);
  });
});
