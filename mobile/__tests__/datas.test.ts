import {describe, expect, it} from '@jest/globals';

import {
  anoMesDe,
  formatarDataAmigavel,
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

describe('formatarDataAmigavel', () => {
  const dia = (ano: number, mes: number, d: number) =>
    new Date(ano, mes - 1, d, 15, 30);

  it('diz "Hoje" para a data de hoje', () => {
    expect(formatarDataAmigavel('2026-10-04', dia(2026, 10, 4))).toBe('Hoje');
  });

  it('diz "Ontem" para o dia anterior', () => {
    expect(formatarDataAmigavel('2026-10-03', dia(2026, 10, 4))).toBe('Ontem');
  });

  it('reconhece ontem na virada do mês', () => {
    expect(formatarDataAmigavel('2026-09-30', dia(2026, 10, 1))).toBe('Ontem');
  });

  it('reconhece ontem na virada do ano', () => {
    expect(formatarDataAmigavel('2025-12-31', dia(2026, 1, 1))).toBe('Ontem');
  });

  it('mostra dd/mm para outras datas do ano atual', () => {
    expect(formatarDataAmigavel('2026-09-28', dia(2026, 10, 4))).toBe('28/09');
    expect(formatarDataAmigavel('2026-10-05', dia(2026, 10, 4))).toBe('05/10');
  });

  it('mostra dd/mm/aaaa para datas de outro ano', () => {
    expect(formatarDataAmigavel('2025-12-30', dia(2026, 1, 1))).toBe(
      '30/12/2025',
    );
    expect(formatarDataAmigavel('2027-01-02', dia(2026, 10, 4))).toBe(
      '02/01/2027',
    );
  });
});
