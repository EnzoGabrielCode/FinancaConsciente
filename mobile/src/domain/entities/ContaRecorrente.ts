export type FrequenciaConta = 'mensal' | 'anual';

export interface ContaRecorrente {
  id: number;
  descricao: string;
  valorCentavos: number;
  categoria: string;
  frequencia: FrequenciaConta;
  dia: number;
  mes: number | null;
  lembrarDiasAntes: number;
  ativa: boolean;
  proxima: string;
}

export type DadosContaRecorrente = Omit<ContaRecorrente, 'id' | 'proxima'>;

export interface PainelContasRecorrentes {
  contas: ContaRecorrente[];
  totalMensal: number;
}
