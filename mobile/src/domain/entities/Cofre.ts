export interface Cofre {
  id: number;
  nome: string;
  icone: string;
  cor: string;
  metaCentavos: number | null;
  saldoCentavos: number;
}

export type DadosCofre = Pick<Cofre, 'nome' | 'icone' | 'cor' | 'metaCentavos'>;

export type TipoMovimento = 'deposito' | 'retirada';

export interface MovimentoCofre {
  id: number;
  cofreId: number;
  tipo: TipoMovimento;
  valorCentavos: number;
  data: string;
}

export type DadosMovimento = Omit<MovimentoCofre, 'id'>;
