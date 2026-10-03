export interface TotaisMes {
  anoMes: string;
  receitasCentavos: number;
  despesasCentavos: number;
}

export interface MesSerie extends TotaisMes {
  rotulo: string;
  alturaReceita: number;
  alturaDespesa: number;
}

export interface ResumoDashboard {
  saldoAtualCentavos: number;
  receitasMesCentavos: number;
  despesasMesCentavos: number;
  poupadoMesCentavos: number;
  taxaPoupanca: number | null;
  variacaoSaldo: number | null;
  serie: MesSerie[];
}
