import type {TotaisMes} from '../entities/Dashboard';
import type {CandidataDuplicata} from '../entities/Duplicata';
import type {
  DadosTransacao,
  TipoTransacao,
  Transacao,
} from '../entities/Transacao';

export interface TransacaoRepository {
  listarRecentes(limite: number): Promise<Transacao[]>;
  buscarPorId(id: number): Promise<Transacao | null>;
  criar(dados: DadosTransacao): Promise<number>;
  atualizar(id: number, dados: DadosTransacao): Promise<void>;
  excluir(id: number): Promise<void>;
  saldoAte(dataISO: string): Promise<number>;
  totaisPorMes(deAnoMes: string, ateAnoMes: string): Promise<TotaisMes[]>;
  buscarCandidatasDuplicata(
    tipo: TipoTransacao,
    valorCentavos: number,
    data: string,
  ): Promise<CandidataDuplicata[]>;
}
