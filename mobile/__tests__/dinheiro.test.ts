import {describe, expect, it} from '@jest/globals';

import {
  aplicarTecla,
  centavosParaDigitado,
  formatarCentavos,
  formatarDigitado,
  formatarPercentual,
  paraCentavos,
} from '../src/domain/dinheiro';

const digitar = (...teclas: string[]) => teclas.reduce(aplicarTecla, '');

describe('aplicarTecla', () => {
  it('acrescenta dígitos', () => {
    expect(digitar('1', '2', '0', '0')).toBe('1200');
  });

  it('aceita só uma vírgula', () => {
    expect(digitar('1', ',', '5', ',')).toBe('1,5');
    expect(aplicarTecla('12,', ',')).toBe('12,');
  });

  it('transforma vírgula com o campo vazio em "0,"', () => {
    expect(aplicarTecla('', ',')).toBe('0,');
  });

  it('ignora a terceira casa decimal', () => {
    expect(digitar('3', ',', '1', '4', '9')).toBe('3,14');
  });

  it('apaga o último caractere com ⌫', () => {
    expect(aplicarTecla('12,5', '⌫')).toBe('12,');
    expect(aplicarTecla('12,', '⌫')).toBe('12');
    expect(aplicarTecla('', '⌫')).toBe('');
  });

  it('limita a 9 dígitos antes da vírgula', () => {
    expect(aplicarTecla('123456789', '0')).toBe('123456789');
    expect(aplicarTecla('123456789', ',')).toBe('123456789,');
    expect(aplicarTecla('12345678', '9')).toBe('123456789');
  });

  it('não deixa zero à esquerda', () => {
    expect(digitar('0', '0')).toBe('0');
    expect(digitar('0', '7')).toBe('7');
    expect(digitar(',', '0', '5')).toBe('0,05');
  });

  it('ignora teclas desconhecidas', () => {
    expect(aplicarTecla('12', 'a')).toBe('12');
  });
});

describe('paraCentavos', () => {
  it('converte sem erro de ponto flutuante', () => {
    expect(paraCentavos('0,29')).toBe(29);
    expect(paraCentavos('1234,56')).toBe(123456);
    expect(paraCentavos('0,07')).toBe(7);
  });

  it('aceita separador de milhar e uma casa decimal', () => {
    expect(paraCentavos('1.234,5')).toBe(123450);
    expect(paraCentavos('1234,5')).toBe(123450);
  });

  it('trata inteiro, vírgula no fim e vazio', () => {
    expect(paraCentavos('1200')).toBe(120000);
    expect(paraCentavos('12,')).toBe(1200);
    expect(paraCentavos('')).toBe(0);
  });

  it('devolve NaN para texto inválido', () => {
    expect(paraCentavos('-5')).toBeNaN();
    expect(paraCentavos('1,234')).toBeNaN();
    expect(paraCentavos('abc')).toBeNaN();
  });
});

describe('formatarCentavos', () => {
  it('formata em reais', () => {
    expect(formatarCentavos(0)).toBe('R$ 0,00');
    expect(formatarCentavos(5)).toBe('R$ 0,05');
    expect(formatarCentavos(100050)).toBe('R$ 1.000,50');
    expect(formatarCentavos(123456789)).toBe('R$ 1.234.567,89');
  });
});

describe('exibição do valor digitado', () => {
  it('formata o valor em digitação', () => {
    expect(formatarDigitado('')).toBe('0,00');
    expect(formatarDigitado('1200')).toBe('1.200');
    expect(formatarDigitado('1234567,8')).toBe('1.234.567,8');
  });

  it('converte centavos de volta para o teclado', () => {
    expect(centavosParaDigitado(120000)).toBe('1200');
    expect(centavosParaDigitado(8990)).toBe('89,90');
    expect(centavosParaDigitado(5)).toBe('0,05');
    expect(paraCentavos(centavosParaDigitado(8990))).toBe(8990);
  });
});

describe('formatarPercentual', () => {
  it('formata positivo com + e uma casa decimal', () => {
    expect(formatarPercentual(0.067)).toBe('+6,7%');
    expect(formatarPercentual(1.5)).toBe('+150,0%');
  });

  it('formata negativo com -', () => {
    expect(formatarPercentual(-0.032)).toBe('-3,2%');
  });

  it('formata zero sem sinal', () => {
    expect(formatarPercentual(0)).toBe('0,0%');
    expect(formatarPercentual(-0.0001)).toBe('0,0%');
  });

  it('arredonda para a casa decimal mais próxima', () => {
    expect(formatarPercentual(0.0666)).toBe('+6,7%');
    expect(formatarPercentual(-0.0666)).toBe('-6,7%');
    expect(formatarPercentual(0.0004)).toBe('0,0%');
  });

  it('aceita sem casa decimal e sem o + nos positivos', () => {
    const semDecimal = {casas: 0, sinalPositivo: false};
    expect(formatarPercentual(0.62, semDecimal)).toBe('62%');
    expect(formatarPercentual(0.6249, semDecimal)).toBe('62%');
    expect(formatarPercentual(-0.15, semDecimal)).toBe('-15%');
  });
});
