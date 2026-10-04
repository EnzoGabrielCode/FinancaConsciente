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
  it('mostra o título SALDO ATUAL', () => {
    const tree = renderizar(resumoCom());

    expect(
      tree.root.findAllByProps({children: 'SALDO ATUAL'}),
    ).not.toHaveLength(0);
    expect(tree.root.findAllByProps({children: 'DISPONÍVEL'})).toHaveLength(0);
  });

  it('o número grande é o saldo sem o valor dos cofres, em verde', () => {
    const tree = renderizar(
      resumoCom({guardadoCofresCentavos: 500000, disponivelCentavos: 1962000}),
      1,
    );
    const saldo = porId(tree, 'saldo-atual');

    expect(textoDe(saldo)).toBe('R$ 19.620,00');
    expect(saldo.props.accessibilityLabel).toBe('Saldo atual: R$ 19.620,00');
    expect(corDe(porId(tree, 'saldo-inteiros'))).toBe(CORES.verde);
  });

  it('sem cofres o número grande é o próprio saldo', () => {
    const tree = renderizar(resumoCom());

    expect(textoDe(porId(tree, 'saldo-atual'))).toBe('R$ 24.620,00');
  });

  it('mostra o saldo negativo em vermelho com "-" antes dos inteiros', () => {
    const tree = renderizar(
      resumoCom({
        saldoAtualCentavos: 30000,
        guardadoCofresCentavos: 50000,
        disponivelCentavos: -20000,
      }),
      1,
    );
    const saldo = porId(tree, 'saldo-atual');

    expect(textoDe(saldo)).toBe('R$ -200,00');
    expect(saldo.props.accessibilityLabel).toBe('Saldo atual: -R$ 200,00');
    expect(corDe(porId(tree, 'saldo-inteiros'))).toBe(CORES.vermelho);
  });

  it('não mostra o saldo total nem o selo de variação', () => {
    const tree = renderizar(
      resumoCom({
        saldoAtualCentavos: 650000,
        disponivelCentavos: 150000,
        guardadoCofresCentavos: 500000,
        variacaoSaldo: 0.067,
      }),
      2,
    );

    expect(existe(tree, 'saldo-total')).toBe(false);
    expect(existe(tree, 'selo-variacao')).toBe(false);
    expect(existe(tree, 'saldo-disponivel')).toBe(false);
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
