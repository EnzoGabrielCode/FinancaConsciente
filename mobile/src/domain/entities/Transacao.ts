export type TipoTransacao = 'receita' | 'despesa';

/**
 * Lançamento financeiro local. Valores são guardados em centavos (inteiro)
 * para evitar erros de ponto flutuante e nunca podem ser negativos
 * (Definition of Done, item 1): o tipo indica se é entrada ou saída.
 */
export interface Transacao {
  id: number;
  tipo: TipoTransacao;
  descricao: string;
  valorCentavos: number;
  /** Data do lançamento no formato ISO 8601 (AAAA-MM-DD). */
  data: string;
  /** Indica se o registro já foi enviado ao backend (offline-first). */
  sincronizado: boolean;
}
