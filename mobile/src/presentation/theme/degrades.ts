import {CORES} from './cores';

// Equivalentes dos ângulos do CSS do Figma para o LinearGradient.
export const DIAGONAL = {start: {x: 0, y: 0}, end: {x: 1, y: 1}} as const; // 135deg
export const HORIZONTAL = {start: {x: 0, y: 0.5}, end: {x: 1, y: 0.5}} as const; // 90deg

export const DEGRADES: Record<string, string[]> = {
  verde: [CORES.verde, CORES.ciano],
  vermelho: [CORES.vermelho, '#E53935'],
  laranja: [CORES.laranja, '#FB8C00'],
  cardSaldo: [CORES.superficie, CORES.superficie2],
  cardTotal: ['#141E16', '#1A1A1A'],
  progresso: [`${CORES.verde}66`, CORES.verde, CORES.ciano],
};
