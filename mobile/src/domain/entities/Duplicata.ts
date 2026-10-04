import type {Transacao} from './Transacao';

export type MotivoDuplicata = 'mesma-categoria' | 'lancada-agora';

export interface CandidataDuplicata {
  transacao: Transacao;
  criadoEm: string;
}

export interface PossivelDuplicata extends CandidataDuplicata {
  motivo: MotivoDuplicata;
}
