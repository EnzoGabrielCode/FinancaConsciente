export type TipoTransacao = 'receita' | 'despesa';

export interface Transacao {
  id: number;
  tipo: TipoTransacao;
  descricao: string;
  /** Valor em centavos, sempre >= 0 (evita erros de ponto flutuante). */
  valorCentavos: number;
  data: string;
  sincronizado: boolean;
}
