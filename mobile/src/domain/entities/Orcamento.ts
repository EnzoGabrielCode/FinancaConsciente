import type {Categoria} from '../categorias';

export interface Orcamento {
  id: number;
  categoria: string;
  limiteCentavos: number;
}

export type DadosOrcamento = Pick<Orcamento, 'categoria' | 'limiteCentavos'>;

export type SituacaoOrcamento = 'ok' | 'perto' | 'estourado';

export type NivelAlerta = 80 | 100;

export interface ProgressoOrcamento {
  orcamento: Orcamento;
  gastoCentavos: number;
  percentual: number;
  restanteCentavos: number;
  situacao: SituacaoOrcamento;
}

export interface ResumoOrcamentos {
  totalLimite: number;
  totalGasto: number;
  disponivel: number;
  percentual: number;
  diasRestantes: number;
}

export interface PainelOrcamentos {
  progressos: ProgressoOrcamento[];
  resumo: ResumoOrcamentos;
  categoriasLivres: Categoria[];
}
