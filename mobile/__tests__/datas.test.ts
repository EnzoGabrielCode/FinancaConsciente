import {describe, expect, it} from '@jest/globals';

import {
  anoMesDe,
  mesesAte,
  rotuloMes,
  saudacao,
  ultimoDiaDoMesAnterior,
} from '../src/domain/datas';

const as = (hora: number, minuto: number) => new Date(2026, 9, 2, hora, minuto);

describe('anoMesDe', () => {
  it('pega o AAAA-MM da data', () => {
    expect(anoMesDe('2026-10-02')).toBe('2026-10');
    expect(anoMesDe('2025-01-31')).toBe('2025-01');
  });
});

describe('mesesAte', () => {
  it('lista do mais antigo ao mais novo virando o ano', () => {
    expect(mesesAte('2026-02', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
  });

  it('lista 6 meses dentro do mesmo ano', () => {
    expect(mesesAte('2026-10', 6)).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
  });

  it('vira o ano partindo de janeiro', () => {
    expect(mesesAte('2026-01', 2)).toEqual(['2025-12', '2026-01']);
  });

  it('com quantidade 1 devolve só o próprio mês', () => {
    expect(mesesAte('2026-10', 1)).toEqual(['2026-10']);
  });
});

describe('ultimoDiaDoMesAnterior', () => {
  it('acha o último dia certo, inclusive em fevereiro e na virada do ano', () => {
    expect(ultimoDiaDoMesAnterior('2026-10')).toBe('2026-09-30');
    expect(ultimoDiaDoMesAnterior('2026-03')).toBe('2026-02-28');
    expect(ultimoDiaDoMesAnterior('2024-03')).toBe('2024-02-29');
    expect(ultimoDiaDoMesAnterior('2026-01')).toBe('2025-12-31');
  });
});

describe('rotuloMes', () => {
  it('abrevia em pt-BR minúsculo', () => {
    expect(rotuloMes('2026-10')).toBe('out');
    expect(rotuloMes('2026-01')).toBe('jan');
    expect(rotuloMes('2026-05')).toBe('mai');
    expect(rotuloMes('2026-12')).toBe('dez');
  });
});

describe('saudacao', () => {
  it('respeita os limites de cada período', () => {
    expect(saudacao(as(4, 59))).toBe('Boa noite');
    expect(saudacao(as(5, 0))).toBe('Bom dia');
    expect(saudacao(as(11, 59))).toBe('Bom dia');
    expect(saudacao(as(12, 0))).toBe('Boa tarde');
    expect(saudacao(as(17, 59))).toBe('Boa tarde');
    expect(saudacao(as(18, 0))).toBe('Boa noite');
    expect(saudacao(as(0, 0))).toBe('Boa noite');
  });
});
