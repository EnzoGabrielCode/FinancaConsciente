import {mesesAte, rotuloMes} from './datas';
import type {ResumoDashboard, TotaisMes} from './entities/Dashboard';

export const MESES_GRAFICO = 6;

export interface DadosDashboard {
  saldoAtualCentavos: number;
  saldoFimMesAnteriorCentavos: number;
  totaisPorMes: TotaisMes[];
  anoMesAtual: string;
  meses?: number;
}

function proporcao(valor: number, maior: number): number {
  return maior > 0 ? Math.min(Math.max(valor / maior, 0), 1) : 0;
}

export function montarDashboard({
  saldoAtualCentavos,
  saldoFimMesAnteriorCentavos,
  totaisPorMes,
  anoMesAtual,
  meses = MESES_GRAFICO,
}: DadosDashboard): ResumoDashboard {
  const porMes = new Map(totaisPorMes.map(totais => [totais.anoMes, totais]));
  const totaisDoMes = (anoMes: string): TotaisMes =>
    porMes.get(anoMes) ?? {anoMes, receitasCentavos: 0, despesasCentavos: 0};

  const atual = totaisDoMes(anoMesAtual);
  const poupadoMesCentavos = atual.receitasCentavos - atual.despesasCentavos;

  const totaisSerie = mesesAte(anoMesAtual, meses).map(totaisDoMes);
  const maior = Math.max(
    0,
    ...totaisSerie.flatMap(t => [t.receitasCentavos, t.despesasCentavos]),
  );

  return {
    saldoAtualCentavos,
    receitasMesCentavos: atual.receitasCentavos,
    despesasMesCentavos: atual.despesasCentavos,
    poupadoMesCentavos,
    taxaPoupanca:
      atual.receitasCentavos > 0
        ? poupadoMesCentavos / atual.receitasCentavos
        : null,
    variacaoSaldo:
      saldoFimMesAnteriorCentavos !== 0
        ? (saldoAtualCentavos - saldoFimMesAnteriorCentavos) /
          Math.abs(saldoFimMesAnteriorCentavos)
        : null,
    serie: totaisSerie.map(totais => ({
      ...totais,
      rotulo: rotuloMes(totais.anoMes),
      alturaReceita: proporcao(totais.receitasCentavos, maior),
      alturaDespesa: proporcao(totais.despesasCentavos, maior),
    })),
  };
}
