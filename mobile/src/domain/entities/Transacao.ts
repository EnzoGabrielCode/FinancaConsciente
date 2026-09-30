export type TipoTransacao = 'receita' | 'despesa';

export interface Transacao {
  id: number;
  tipo: TipoTransacao;
  descricao: string;
  valorCentavos: number;
  data: string;
  sincronizado: boolean;
}
