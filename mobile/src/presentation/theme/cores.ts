import type {TipoTransacao} from '../../domain/entities/Transacao';

export const CORES = {
  fundo: '#121212',
  superficie: '#1E1E1E',
  superficie2: '#252525',
  superficie3: '#2C2C2C',
  barra: '#181818',
  texto: '#F2F2F2',
  textoSecundario: '#9E9E9E',
  textoApagado: '#616161',
  verde: '#39FF84',
  vermelho: '#FF6B6B',
  azul: '#64B5F6',
  laranja: '#FFB74D',
  ciano: '#00BCD4',
  roxo: '#CE93D8',
  vermelhoExcluir: '#C62828',
  realce: 'rgba(255,255,255,0.05)',
  realceForte: 'rgba(255,255,255,0.07)',
  borda: 'rgba(255,255,255,0.06)',
} as const;

export function corDoTipo(tipo: TipoTransacao): string {
  return tipo === 'receita' ? CORES.verde : CORES.vermelho;
}

export function comAlfa(corHex: string, alfa: number): string {
  const canal = Math.round(Math.min(Math.max(alfa, 0), 1) * 255);
  return `${corHex}${canal.toString(16).padStart(2, '0').toUpperCase()}`;
}
