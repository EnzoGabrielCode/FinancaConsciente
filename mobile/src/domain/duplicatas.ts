import type {
  CandidataDuplicata,
  MotivoDuplicata,
  PossivelDuplicata,
} from './entities/Duplicata';
import type {DadosTransacao} from './entities/Transacao';

export const JANELA_DUPLICATA_MINUTOS = 10;

const JANELA_MS = JANELA_DUPLICATA_MINUTOS * 60 * 1000;

const doisDigitos = (n: number) => String(n).padStart(2, '0');

function instante(criadoEm: string): number | null {
  const ms = Date.parse(criadoEm);
  return Number.isNaN(ms) ? null : ms;
}

function motivoDe(
  nova: DadosTransacao,
  candidata: CandidataDuplicata,
  agora: Date,
): MotivoDuplicata | null {
  if (candidata.transacao.categoria === nova.categoria) {
    return 'mesma-categoria';
  }
  const criadoEm = instante(candidata.criadoEm);
  if (criadoEm !== null && Math.abs(agora.getTime() - criadoEm) <= JANELA_MS) {
    return 'lancada-agora';
  }
  return null;
}

function maisRecentePrimeiro(a: PossivelDuplicata, b: PossivelDuplicata) {
  const instanteA = instante(a.criadoEm) ?? -Infinity;
  const instanteB = instante(b.criadoEm) ?? -Infinity;
  if (instanteA === instanteB) {
    return 0;
  }
  return instanteA > instanteB ? -1 : 1;
}

export function filtrarDuplicatas(
  nova: DadosTransacao,
  candidatas: CandidataDuplicata[],
  agora: Date = new Date(),
): PossivelDuplicata[] {
  if (nova.tipo !== 'despesa') {
    return [];
  }
  const duplicatas: PossivelDuplicata[] = [];
  for (const candidata of candidatas) {
    const {transacao} = candidata;
    if (
      transacao.tipo !== 'despesa' ||
      transacao.valorCentavos !== nova.valorCentavos ||
      transacao.data !== nova.data
    ) {
      continue;
    }
    const motivo = motivoDe(nova, candidata, agora);
    if (motivo) {
      duplicatas.push({...candidata, motivo});
    }
  }
  return duplicatas.sort(maisRecentePrimeiro);
}

export function horaLocal(criadoEmISO: string): string {
  const ms = instante(criadoEmISO);
  if (ms === null) {
    return '';
  }
  const data = new Date(ms);
  return `${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`;
}
