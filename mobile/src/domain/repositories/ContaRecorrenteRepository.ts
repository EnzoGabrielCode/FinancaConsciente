import type {
  ContaRecorrente,
  DadosContaRecorrente,
} from '../entities/ContaRecorrente';

export interface ContaRecorrenteRepository {
  listar(): Promise<ContaRecorrente[]>;
  buscarPorId(id: number): Promise<ContaRecorrente | null>;
  criar(dados: DadosContaRecorrente, proxima: string): Promise<number>;
  atualizar(
    id: number,
    dados: DadosContaRecorrente,
    proxima: string,
  ): Promise<void>;
  excluir(id: number): Promise<void>;
  definirAtiva(id: number, ativa: boolean): Promise<void>;
  avancarProxima(id: number, proxima: string): Promise<void>;
}
