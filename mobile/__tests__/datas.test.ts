import {describe, expect, it} from '@jest/globals';

import {
  anoMesDe,
  avancarMes,
  diasEntre,
  formatarCabecalhoDia,
  formatarDiaComAno,
  formatarDiaCurto,
  formatarMesCurto,
  mesesEntre,
  nomeMesAno,
  ultimoDiaDoMes,
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

describe('formatarCabecalhoDia', () => {
  const hoje = new Date(2026, 9, 14);

  it('usa Hoje e Ontem como a data amigável', () => {
    expect(formatarCabecalhoDia('2026-10-14', hoje)).toBe('Hoje');
    expect(formatarCabecalhoDia('2026-10-13', hoje)).toBe('Ontem');
  });

  it('escreve dia e mês abreviado, sem zero à esquerda', () => {
    expect(formatarCabecalhoDia('2026-10-12', hoje)).toBe('12 de out.');
    expect(formatarCabecalhoDia('2026-03-05', hoje)).toBe('5 de mar.');
  });

  it('inclui o ano quando é outro ano', () => {
    expect(formatarCabecalhoDia('2025-12-30', hoje)).toBe('30 de dez. de 2025');
  });
});

describe('ultimoDiaDoMes', () => {
  it('considera meses de 30 e 31 dias e o ano bissexto', () => {
    expect(ultimoDiaDoMes('2026-11')).toBe('2026-11-30');
    expect(ultimoDiaDoMes('2026-12')).toBe('2026-12-31');
    expect(ultimoDiaDoMes('2026-02')).toBe('2026-02-28');
    expect(ultimoDiaDoMes('2028-02')).toBe('2028-02-29');
  });
});

describe('nomeMesAno', () => {
  it('escreve o mês por extenso com o ano', () => {
    expect(nomeMesAno('2026-11')).toBe('Novembro 2026');
    expect(nomeMesAno('2026-03')).toBe('Março 2026');
  });
});

describe('avancarMes e mesesEntre', () => {
  it('atravessa a virada de ano nos dois sentidos', () => {
    expect(avancarMes('2026-12', 1)).toBe('2027-01');
    expect(avancarMes('2027-01', -1)).toBe('2026-12');
    expect(avancarMes('2026-11', 24)).toBe('2028-11');
    expect(mesesEntre('2026-12', '2027-01')).toBe(1);
    expect(mesesEntre('2026-11', '2026-10')).toBe(-1);
  });
});

describe('diasEntre', () => {
  it('não sofre com bissexto nem virada de ano', () => {
    expect(diasEntre('2026-11-07', '2026-11-30')).toBe(23);
    expect(diasEntre('2028-02-28', '2028-03-01')).toBe(2);
    expect(diasEntre('2026-12-31', '2027-01-01')).toBe(1);
    expect(diasEntre('2026-11-07', '2026-10-31')).toBe(-7);
  });
});

describe('formatarDiaCurto e formatarMesCurto', () => {
  it('escrevem o dia e o mês abreviados', () => {
    expect(formatarDiaCurto('2026-11-30')).toBe('30 de nov.');
    expect(formatarDiaCurto('2026-03-05')).toBe('5 de mar.');
    expect(formatarMesCurto('2026-12')).toBe('dez. 2026');
  });
});

describe('formatarDiaComAno', () => {
  const hoje = new Date(2026, 10, 8);

  it('omite o ano atual e mostra os outros', () => {
    expect(formatarDiaComAno('2026-11-03', hoje)).toBe('3 de nov.');
    expect(formatarDiaComAno('2025-12-20', hoje)).toBe('20 de dez. de 2025');
  });

  it('não troca hoje e ontem por palavras', () => {
    expect(formatarDiaComAno('2026-11-08', hoje)).toBe('8 de nov.');
  });
});
