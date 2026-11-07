import type {
  DadosOrcamento,
  NivelAlerta,
  Orcamento,
} from '../entities/Orcamento';

export interface OrcamentoRepository {
  listar(): Promise<Orcamento[]>;
  salvar(dados: DadosOrcamento): Promise<void>;
  excluir(id: number): Promise<void>;
  registrarAlerta(
    categoria: string,
    anoMes: string,
    nivel: NivelAlerta,
  ): Promise<boolean>;
}
