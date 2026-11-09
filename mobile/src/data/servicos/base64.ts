const ALFABETO =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

const VALOR = new Map(Array.from(ALFABETO, (letra, i) => [letra, i]));

// Sem atob: o Hermes desta versão do RN não tem.
export function base64ParaBytes(base64: string): Uint8Array {
  const limpo = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((limpo.length * 3) / 4));
  let tamanho = 0;
  for (let i = 0; i < limpo.length; i += 4) {
    const a = VALOR.get(limpo[i]) ?? 0;
    const b = VALOR.get(limpo[i + 1]) ?? 0;
    const c = VALOR.get(limpo[i + 2]);
    const d = VALOR.get(limpo[i + 3]);
    bytes[tamanho++] = a * 4 + Math.floor(b / 16);
    if (c !== undefined) {
      bytes[tamanho++] = (b % 16) * 16 + Math.floor(c / 4);
    }
    if (c !== undefined && d !== undefined) {
      bytes[tamanho++] = (c % 4) * 64 + d;
    }
  }
  return bytes.subarray(0, tamanho);
}
