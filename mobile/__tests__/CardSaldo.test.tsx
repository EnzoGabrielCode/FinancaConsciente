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

function renderizar(
  resumo: ResumoDashboard,
  quantidadeCofres = 0,
): ReactTestRenderer {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <CardSaldo resumo={resumo} quantidadeCofres={quantidadeCofres} />,
    );
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
  it('mostra o título DISPONÍVEL', () => {
    const tree = renderizar(resumoCom());

    expect(tree.root.findAllByProps({children: 'DISPONÍVEL'})).not.toHaveLength(
      0,
    );
    expect(tree.root.findAllByProps({children: 'SALDO ATUAL'})).toHaveLength(0);
  });

  it('mostra o disponível positivo dividido em moeda, inteiros e centavos', () => {
    const tree = renderizar(
      resumoCom({guardadoCofresCentavos: 500000, disponivelCentavos: 1962000}),
      1,
    );
    const disponivel = porId(tree, 'disponivel');

    expect(textoDe(disponivel)).toBe('R$ 19.620,00');
    expect(disponivel.props.accessibilityLabel).toBe(
      'Disponível: R$ 19.620,00',
    );
    expect(corDe(porId(tree, 'disponivel-inteiros'))).toBe('#39FF84');
  });

  it('mostra o disponível negativo em #FF6B6B com "-" antes dos inteiros', () => {
    const tree = renderizar(
      resumoCom({
        saldoAtualCentavos: 30000,
        guardadoCofresCentavos: 50000,
        disponivelCentavos: -20000,
      }),
      1,
    );
    const disponivel = porId(tree, 'disponivel');

    expect(textoDe(disponivel)).toBe('R$ -200,00');
    expect(disponivel.props.accessibilityLabel).toBe('Disponível: -R$ 200,00');
    expect(corDe(porId(tree, 'disponivel-inteiros'))).toBe('#FF6B6B');
  });

  it('mostra o saldo total em 12 #9E9E9E com o selo ao lado', () => {
    const tree = renderizar(
      resumoCom({
        saldoAtualCentavos: 650000,
        disponivelCentavos: 150000,
        guardadoCofresCentavos: 500000,
        variacaoSaldo: 0.067,
      }),
      1,
    );
    const linha = porId(tree, 'saldo-total');
    const estilo = StyleSheet.flatten(linha.props.style);

    expect(textoDe(linha)).toBe('Saldo total R$ 6.500,00');
    expect(linha.props.accessibilityLabel).toBe('Saldo total: R$ 6.500,00');
    expect(estilo.fontSize).toBe(12);
    expect(estilo.color).toBe('#9E9E9E');
    expect(
      linha.parent?.findAll(no => no.props.testID === 'selo-variacao'),
    ).not.toHaveLength(0);
  });

  it('sem variação mostra só o texto do saldo total', () => {
    const tree = renderizar(resumoCom({variacaoSaldo: null}));

    expect(textoDe(porId(tree, 'saldo-total'))).toBe(
      'Saldo total R$ 24.620,00',
    );
    expect(existe(tree, 'selo-variacao')).toBe(false);
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

  it('não mostra mais a linha antiga de disponível e cofres', () => {
    const tree = renderizar(
      resumoCom({guardadoCofresCentavos: 500000, disponivelCentavos: 1962000}),
      2,
    );

    expect(existe(tree, 'saldo-disponivel')).toBe(false);
    expect(existe(tree, 'saldo-atual')).toBe(false);
  });

  it('mostra receitas e despesas do mês', () => {
    const tree = renderizar(resumoCom());

    expect(textoDe(porId(tree, 'receitas-mes'))).toBe('+R$ 8.500,00');
    expect(textoDe(porId(tree, 'despesas-mes'))).toBe('-R$ 3.240,00');
    expect(existe(tree, 'sobra-mes')).toBe(false);
    expect(tree.root.findAllByProps({children: 'Sobra do mês'})).toHaveLength(
      0,
    );
  });

  it.each([
    [0, 0, 'R$ 0,00', 'Nenhum cofre'],
    [1, 30000, 'R$ 300,00', '1 cofre'],
    [2, 500000, 'R$ 5.000,00', '2 cofres'],
  ])(
    'coluna Em cofres com %i cofre(s)',
    (quantidade, guardado, valor, detalhe) => {
      const tree = renderizar(
        resumoCom({guardadoCofresCentavos: guardado}),
        quantidade,
      );
      const coluna = porId(tree, 'em-cofres');

      expect(textoDe(coluna)).toBe(valor);
      expect(corDe(coluna)).toBe('#64B5F6');
      expect(textoDe(porId(tree, 'em-cofres-detalhe'))).toBe(detalhe);
      expect(
        tree.root.findAll(
          no =>
            no.props.accessibilityLabel === `Em cofres: ${valor}, ${detalhe}`,
        ),
      ).not.toHaveLength(0);
    },
  );

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
