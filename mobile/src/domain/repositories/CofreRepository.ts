import type {
  Cofre,
  DadosCofre,
  DadosMovimento,
  MovimentoCofre,
} from '../entities/Cofre';

export interface CofreRepository {
  listar(): Promise<Cofre[]>;
  buscarPorId(id: number): Promise<Cofre | null>;
  criar(dados: DadosCofre): Promise<number>;
  atualizar(id: number, dados: DadosCofre): Promise<void>;
  excluir(id: number): Promise<void>;
  registrarMovimento(movimento: DadosMovimento): Promise<number>;
  listarMovimentos(cofreId: number, limite: number): Promise<MovimentoCofre[]>;
  totalGuardado(): Promise<number>;
}
