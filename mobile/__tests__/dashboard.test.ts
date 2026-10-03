import {describe, expect, it} from '@jest/globals';

import {montarDashboard} from '../src/domain/dashboard';
import type {
  ResumoDashboard,
  TotaisMes,
} from '../src/domain/entities/Dashboard';

const mes = (
  anoMes: string,
  receitasCentavos: number,
  despesasCentavos: number,
): TotaisMes => ({anoMes, receitasCentavos, despesasCentavos});

const montar = (
  totaisPorMes: TotaisMes[],
  saldoAtualCentavos = 0,
  saldoFimMesAnteriorCentavos = 0,
) =>
  montarDashboard({
    saldoAtualCentavos,
    saldoFimMesAnteriorCentavos,
    totaisPorMes,
    anoMesAtual: '2026-10',
  });

function numerosDe(resumo: ResumoDashboard): number[] {
  return [
    resumo.saldoAtualCentavos,
    resumo.receitasMesCentavos,
    resumo.despesasMesCentavos,
    resumo.poupadoMesCentavos,
    ...resumo.serie.flatMap(m => [
      m.receitasCentavos,
      m.despesasCentavos,
      m.alturaReceita,
      m.alturaDespesa,
    ]),
  ];
}

describe('montarDashboard', () => {
  it('sem nenhum lançamento zera tudo sem NaN nem divisão por zero', () => {
    const resumo = montar([]);

    expect(resumo).toMatchObject({
      saldoAtualCentavos: 0,
      receitasMesCentavos: 0,
      despesasMesCentavos: 0,
      poupadoMesCentavos: 0,
      taxaPoupanca: null,
      variacaoSaldo: null,
    });
    expect(resumo.serie).toHaveLength(6);
    for (const item of resumo.serie) {
      expect(item.alturaReceita).toBe(0);
      expect(item.alturaDespesa).toBe(0);
    }
    for (const numero of numerosDe(resumo)) {
      expect(Number.isFinite(numero)).toBe(true);
    }
  });

  it('só com receitas poupa 100% da renda', () => {
    const resumo = montar([mes('2026-10', 850000, 0)], 850000, 0);

    expect(resumo.receitasMesCentavos).toBe(850000);
    expect(resumo.despesasMesCentavos).toBe(0);
    expect(resumo.poupadoMesCentavos).toBe(850000);
    expect(resumo.taxaPoupanca).toBe(1);
    expect(resumo.variacaoSaldo).toBeNull();
    expect(resumo.serie.at(-1)).toMatchObject({
      rotulo: 'out',
      alturaReceita: 1,
      alturaDespesa: 0,
    });
  });

  it('com despesas maiores que receitas o poupado fica negativo', () => {
    const resumo = montar([mes('2026-10', 100000, 150000)]);

    expect(resumo.poupadoMesCentavos).toBe(-50000);
    expect(resumo.taxaPoupanca).toBe(-0.5);
  });

  it('só com despesas no mês não calcula a taxa de poupança', () => {
    const resumo = montar([mes('2026-10', 0, 30000)]);

    expect(resumo.poupadoMesCentavos).toBe(-30000);
    expect(resumo.taxaPoupanca).toBeNull();
  });

  it('calcula a variação do saldo sobre o fim do mês anterior', () => {
    expect(montar([], 106700, 100000).variacaoSaldo).toBeCloseTo(0.067);
    expect(montar([], 96800, 100000).variacaoSaldo).toBeCloseTo(-0.032);
  });

  it('usa o valor absoluto quando o saldo anterior é negativo', () => {
    expect(montar([], -50000, -100000).variacaoSaldo).toBeCloseTo(0.5);
    expect(montar([], -150000, -100000).variacaoSaldo).toBeCloseTo(-0.5);
  });

  it('preenche com 0 os meses vazios e sempre tem 6 itens em ordem', () => {
    const resumo = montar([
      mes('2026-06', 500000, 200000),
      mes('2026-09', 800000, 300000),
    ]);

    expect(resumo.serie.map(m => m.anoMes)).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
    expect(resumo.serie.map(m => m.rotulo)).toEqual([
      'mai',
      'jun',
      'jul',
      'ago',
      'set',
      'out',
    ]);
    expect(resumo.serie.map(m => m.receitasCentavos)).toEqual([
      0, 500000, 0, 0, 800000, 0,
    ]);
    expect(resumo.receitasMesCentavos).toBe(0);
  });

  it('ignora meses fora da janela do gráfico', () => {
    const resumo = montar([
      mes('2026-01', 9999999, 0),
      mes('2026-10', 100, 50),
    ]);

    expect(resumo.serie).toHaveLength(6);
    expect(resumo.serie.at(-1)?.alturaReceita).toBe(1);
  });

  it('a barra mais alta tem altura 1 e as outras são proporcionais', () => {
    const resumo = montar([
      mes('2026-09', 400000, 1000000),
      mes('2026-10', 500000, 250000),
    ]);
    const alturas = resumo.serie.flatMap(m => [
      m.alturaReceita,
      m.alturaDespesa,
    ]);

    expect(Math.max(...alturas)).toBe(1);
    expect(resumo.serie[4].alturaDespesa).toBe(1);
    expect(resumo.serie[4].alturaReceita).toBeCloseTo(0.4);
    expect(resumo.serie[5].alturaReceita).toBeCloseTo(0.5);
    expect(resumo.serie[5].alturaDespesa).toBeCloseTo(0.25);
    for (const altura of alturas) {
      expect(altura).toBeGreaterThanOrEqual(0);
      expect(altura).toBeLessThanOrEqual(1);
    }
  });

  it('aceita outra quantidade de meses', () => {
    const resumo = montarDashboard({
      saldoAtualCentavos: 0,
      saldoFimMesAnteriorCentavos: 0,
      totaisPorMes: [],
      anoMesAtual: '2026-02',
      meses: 3,
    });
    expect(resumo.serie.map(m => m.anoMes)).toEqual([
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });
});
