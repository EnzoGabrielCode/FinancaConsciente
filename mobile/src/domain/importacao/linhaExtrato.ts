export interface LinhaExtrato {
  data: string;
  descricao: string;
  // Com sinal: positivo entra (receita), negativo sai (despesa).
  valorCentavos: number;
  idExterno: string;
}

export interface ErroDeLinha {
  linha: number;
  motivo: string;
}

export const MAX_DESCRICAO_IMPORTADA = 80;
export const DESCRICAO_PADRAO = 'Lançamento importado';

// FNV-1a de 32 bits: estável entre execuções, sem dependência de crypto.
/* eslint-disable no-bitwise -- o FNV-1a é definido em operações de bit. */
export function hashTexto(texto: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
/* eslint-enable no-bitwise */

export function limparDescricao(texto: string): string {
  const limpa = texto.replace(/\s+/g, ' ').trim();
  return Array.from(limpa).slice(0, MAX_DESCRICAO_IMPORTADA).join('').trim();
}

// "12,5" → 1250; "-1234.567" → -123457. Só manipula texto e inteiros.
export function centavosDeDecimal(
  negativo: boolean,
  inteiros: string,
  decimais: string,
): number | null {
  if (!/^\d+$/.test(inteiros || '0') || !/^\d*$/.test(decimais)) {
    return null;
  }
  const casas = `${decimais}00`.slice(0, 2);
  const arredondar = decimais.length > 2 && Number(decimais[2]) >= 5 ? 1 : 0;
  const digitos = `${(inteiros || '0').replace(/^0+(?=\d)/, '')}${casas}`;
  if (digitos.length > 15) {
    return null;
  }
  const centavos = Number(digitos) + arredondar;
  return negativo ? -centavos : centavos;
}
