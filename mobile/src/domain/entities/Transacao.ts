export type TipoTransacao = 'receita' | 'despesa';

export type Recorrencia = 'fixa' | 'variavel';

export interface Transacao {
  id: number;
  tipo: TipoTransacao;
  descricao: string;
  valorCentavos: number;
  data: string;
  categoria: string;
  recorrencia: Recorrencia;
  sincronizado: boolean;
}

export type DadosTransacao = Omit<Transacao, 'id' | 'sincronizado'>;
