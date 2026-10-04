export type Tecla =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | ','
  | '⌫';

export const MAX_DIGITOS_INTEIROS = 9;
export const MAX_CASAS_DECIMAIS = 2;

export function aplicarTecla(valorDigitado: string, tecla: string): string {
  if (tecla === '⌫') {
    return valorDigitado.slice(0, -1);
  }

  if (tecla === ',') {
    if (valorDigitado.includes(',')) {
      return valorDigitado;
    }
    return valorDigitado === '' ? '0,' : `${valorDigitado},`;
  }

  if (!/^\d$/.test(tecla)) {
    return valorDigitado;
  }

  const [inteiros, decimais] = valorDigitado.split(',');

  if (decimais !== undefined) {
    return decimais.length >= MAX_CASAS_DECIMAIS
      ? valorDigitado
      : valorDigitado + tecla;
  }

  if (inteiros === '0') {
    return tecla;
  }

  return inteiros.length >= MAX_DIGITOS_INTEIROS
    ? valorDigitado
    : valorDigitado + tecla;
}

export function paraCentavos(texto: string): number {
  const semPontos = texto.trim().replace(/\./g, '');
  const partes = /^(\d*)(?:,(\d{0,2}))?$/.exec(semPontos);
  if (!partes) {
    return NaN;
  }
  const reais = partes[1] === '' ? 0 : parseInt(partes[1], 10);
  const centavos = parseInt((partes[2] ?? '').padEnd(2, '0'), 10);
  return reais * 100 + centavos;
}

function separarMilhares(inteiros: string): string {
  return inteiros.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatarCentavos(centavos: number): string {
  const sinal = centavos < 0 ? '-' : '';
  const absoluto = Math.abs(Math.trunc(centavos));
  const reais = Math.floor(absoluto / 100);
  const resto = String(absoluto % 100).padStart(2, '0');
  return `${sinal}R$ ${separarMilhares(String(reais))},${resto}`;
}

export function formatarDigitado(valorDigitado: string): string {
  if (valorDigitado === '') {
    return '0,00';
  }
  const [inteiros, decimais] = valorDigitado.split(',');
  const parteInteira = separarMilhares(inteiros === '' ? '0' : inteiros);
  return decimais === undefined ? parteInteira : `${parteInteira},${decimais}`;
}

export function centavosParaDigitado(centavos: number): string {
  if (centavos <= 0) {
    return '';
  }
  const reais = Math.floor(centavos / 100);
  const resto = centavos % 100;
  return resto === 0
    ? String(reais)
    : `${reais},${String(resto).padStart(2, '0')}`;
}

export interface OpcoesPercentual {
  casas?: number;
  sinalPositivo?: boolean;
}

export function formatarPercentual(
  fracao: number,
  {casas = 1, sinalPositivo = true}: OpcoesPercentual = {},
): string {
  const fator = 10 ** casas;
  const arredondado = Math.round(Math.abs(fracao) * 100 * fator);
  const sinal =
    arredondado === 0 ? '' : fracao < 0 ? '-' : sinalPositivo ? '+' : '';
  const inteiros = Math.floor(arredondado / fator);
  const decimais = String(arredondado % fator).padStart(casas, '0');
  return casas > 0
    ? `${sinal}${inteiros},${decimais}%`
    : `${sinal}${inteiros}%`;
}
