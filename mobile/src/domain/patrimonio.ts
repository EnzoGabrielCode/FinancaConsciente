import type {TotaisMes} from './entities/Dashboard';
import type {PontoPatrimonio, ResumoPatrimonio} from './entities/Relatorio';

// Patrimônio líquido = saldo acumulado de todos os lançamentos até o fim de
// cada mês. O dinheiro dos cofres já está dentro desse saldo (guardar não é
// despesa) e o app ainda não registra dívidas, então não há o que descontar.
export function evolucaoPatrimonio(
  saldoAntes: number,
  totaisPorMes: TotaisMes[],
  meses: string[],
): PontoPatrimonio[] {
  const porMes = new Map(totaisPorMes.map(t => [t.anoMes, t]));
  let acumulado = saldoAntes;
  return meses.map(anoMes => {
    const totais = porMes.get(anoMes);
    if (totais) {
      acumulado += totais.receitasCentavos - totais.despesasCentavos;
    }
    return {anoMes, patrimonioCentavos: acumulado};
  });
}

export function resumoPatrimonio(serie: PontoPatrimonio[]): ResumoPatrimonio {
  const primeiro = serie[0]?.patrimonioCentavos ?? 0;
  const atual = serie[serie.length - 1]?.patrimonioCentavos ?? 0;
  const variacaoCentavos = atual - primeiro;
  return {
    atual,
    variacaoCentavos,
    // Sobre o valor absoluto: partindo de -1000, chegar a -500 é melhora (+50%).
    variacaoPercentual:
      primeiro === 0 ? null : variacaoCentavos / Math.abs(primeiro),
  };
}
