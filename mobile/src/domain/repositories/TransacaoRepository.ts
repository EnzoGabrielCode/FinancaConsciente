import type {TotaisMes} from '../entities/Dashboard';
import type {CandidataDuplicata} from '../entities/Duplicata';
import type {FiltroRelatorio} from '../entities/Relatorio';
import type {
  DadosTransacao,
  TipoTransacao,
  Transacao,
} from '../entities/Transacao';

export interface ExemploCategoria {
  descricao: string;
  categoria: string;
}

export interface TransacaoRepository {
  listarRecentes(limite: number): Promise<Transacao[]>;
  listarPagina(limite: number, deslocamento: number): Promise<Transacao[]>;
  buscarPorId(id: number): Promise<Transacao | null>;
  criar(dados: DadosTransacao): Promise<number>;
  lancarRecorrente(dados: DadosTransacao): Promise<boolean>;
  idsExternosExistentes(ids: string[]): Promise<Set<string>>;
  importarLote(lote: DadosTransacao[]): Promise<number>;
  atualizar(id: number, dados: DadosTransacao): Promise<void>;
  excluir(id: number): Promise<void>;
  saldoAte(dataISO: string): Promise<number>;
  totaisPorMes(deAnoMes: string, ateAnoMes: string): Promise<TotaisMes[]>;
  gastosPorCategoria(anoMes: string): Promise<Record<string, number>>;
  exemplosDeCategoria(limite?: number): Promise<ExemploCategoria[]>;
  listarPorPeriodo(filtro: FiltroRelatorio): Promise<Transacao[]>;
  buscarCandidatasDuplicata(
    tipo: TipoTransacao,
    valorCentavos: number,
    data: string,
  ): Promise<CandidataDuplicata[]>;
}
