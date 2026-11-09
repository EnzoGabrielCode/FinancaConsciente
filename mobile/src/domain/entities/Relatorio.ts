import type {TipoTransacao, Transacao} from './Transacao';

export type TipoFiltro = 'todos' | TipoTransacao;

export interface FiltroRelatorio {
  de: string;
  ate: string;
  tipo: TipoFiltro;
  categoria: string | null;
}

export interface GastoCategoria {
  categoria: string;
  totalCentavos: number;
  // Fração do total de despesas (0 a 1).
  percentual: number;
}

export interface Relatorio {
  filtro: FiltroRelatorio;
  transacoes: Transacao[];
  totalReceitas: number;
  totalDespesas: number;
  resultado: number;
  quantidade: number;
  porCategoria: GastoCategoria[];
}

export interface PontoPatrimonio {
  anoMes: string;
  patrimonioCentavos: number;
}

export interface ResumoPatrimonio {
  atual: number;
  variacaoCentavos: number;
  variacaoPercentual: number | null;
}
