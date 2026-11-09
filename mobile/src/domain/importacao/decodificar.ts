/* eslint-disable no-bitwise -- decodificar UTF-8 é feito bit a bit. */
// Bytes 0x80–0x9F do Windows-1252; o resto coincide com o latin-1. Os 5 que
// o Windows-1252 não define ficam com o próprio código.
const WINDOWS_1252: Record<number, number> = {
  0x80: 0x20ac,
  0x82: 0x201a,
  0x83: 0x0192,
  0x84: 0x201e,
  0x85: 0x2026,
  0x86: 0x2020,
  0x87: 0x2021,
  0x88: 0x02c6,
  0x89: 0x2030,
  0x8a: 0x0160,
  0x8b: 0x2039,
  0x8c: 0x0152,
  0x8e: 0x017d,
  0x91: 0x2018,
  0x92: 0x2019,
  0x93: 0x201c,
  0x94: 0x201d,
  0x95: 0x2022,
  0x96: 0x2013,
  0x97: 0x2014,
  0x98: 0x02dc,
  0x99: 0x2122,
  0x9a: 0x0161,
  0x9b: 0x203a,
  0x9c: 0x0153,
  0x9e: 0x017e,
  0x9f: 0x0178,
};

// Sem TextDecoder: o Hermes desta versão do RN não tem.
function decodificarUtf8(bytes: Uint8Array): string | null {
  const pontos: number[] = [];
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    let extras: number;
    let ponto: number;
    let minimo: number;
    if (b < 0x80) {
      pontos.push(b);
      i++;
      continue;
    } else if (b >= 0xc2 && b <= 0xdf) {
      extras = 1;
      ponto = b & 0x1f;
      minimo = 0x80;
    } else if (b >= 0xe0 && b <= 0xef) {
      extras = 2;
      ponto = b & 0x0f;
      minimo = 0x800;
    } else if (b >= 0xf0 && b <= 0xf4) {
      extras = 3;
      ponto = b & 0x07;
      minimo = 0x10000;
    } else {
      return null;
    }
    for (let j = 1; j <= extras; j++) {
      const continuacao = bytes[i + j];
      if (continuacao === undefined || (continuacao & 0xc0) !== 0x80) {
        return null;
      }
      ponto = (ponto << 6) | (continuacao & 0x3f);
    }
    // Rejeita formas longas demais, surrogates e além do Unicode.
    if (
      ponto < minimo ||
      (ponto >= 0xd800 && ponto <= 0xdfff) ||
      ponto > 0x10ffff
    ) {
      return null;
    }
    pontos.push(ponto);
    i += extras + 1;
  }
  return juntar(pontos);
}

function juntar(pontos: number[]): string {
  let texto = '';
  // Em blocos: fromCodePoint com milhares de argumentos estoura a pilha.
  for (let i = 0; i < pontos.length; i += 4096) {
    texto += String.fromCodePoint(...pontos.slice(i, i + 4096));
  }
  return texto;
}

function decodificarWindows1252(bytes: Uint8Array): string {
  return juntar(Array.from(bytes, b => WINDOWS_1252[b] ?? b));
}

export function decodificarTexto(bytes: Uint8Array): string {
  const temBom =
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf;
  const conteudo = temBom ? bytes.subarray(3) : bytes;
  const texto = decodificarUtf8(conteudo) ?? decodificarWindows1252(conteudo);
  return texto.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}
