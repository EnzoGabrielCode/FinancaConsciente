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
  comprovanteUri: string | null;
  contaRecorrenteId: number | null;
  // Identificador do lançamento no extrato importado (OFX/CSV); evita duplicar.
  idExterno: string | null;
  sincronizado: boolean;
}

export type DadosTransacao = Omit<Transacao, 'id' | 'sincronizado'>;
