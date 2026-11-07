import {describe, expect, it} from '@jest/globals';

import {
  avancarMes,
  fraseDoPlano,
  mesesAFrente,
  parcelaDoPlano,
  planoDaMeta,
  totalMensalDasMetas,
} from '../src/domain/metas';

const HOJE = '2026-11-07';

const meta = (
  metaCentavos: number | null,
  prazo: string | null,
  saldoCentavos = 0,
) => ({metaCentavos, prazo, saldoCentavos});

const plano = (
  metaCentavos: number | null,
  prazo: string | null,
  saldoCentavos = 0,
  hoje = HOJE,
) => planoDaMeta(meta(metaCentavos, prazo, saldoCentavos), hoje);

describe('planoDaMeta', () => {
  it('devolve null sem meta ou sem prazo', () => {
    expect(plano(null, '2026-12')).toBeNull();
    expect(plano(100000, null)).toBeNull();
    expect(plano(null, null)).toBeNull();
  });

  it('com prazo no mês atual conta 1 mês e os dias até 30/11 com hoje', () => {
    expect(plano(120000, '2026-11')).toEqual({
      prazo: '2026-11',
      restanteCentavos: 120000,
      mesesRestantes: 1,
      diasRestantes: 24,
      situacao: 'em-andamento',
      porMesCentavos: 120000,
      porDiaCentavos: 5000,
      curtoPrazo: true,
    });
  });

  it('no último dia do mês resta 1 dia', () => {
    expect(plano(1000, '2026-11', 0, '2026-11-30')).toMatchObject({
      mesesRestantes: 1,
      diasRestantes: 1,
      porDiaCentavos: 1000,
    });
  });

  it('arredonda para cima: R$ 1.000 em 3 meses dá R$ 333,34', () => {
    const resultado = plano(100000, '2027-01');
    expect(resultado).toMatchObject({mesesRestantes: 3, porMesCentavos: 33334});
    expect((resultado?.porMesCentavos ?? 0) * 3).toBeGreaterThanOrEqual(100000);
  });

  it('desconta o saldo do restante', () => {
    expect(plano(100000, '2027-01', 40000)).toMatchObject({
      restanteCentavos: 60000,
      porMesCentavos: 20000,
    });
  });

  it('com saldo igual ou maior que a meta fica concluída', () => {
    for (const saldo of [100000, 150000]) {
      expect(plano(100000, '2027-01', saldo)).toMatchObject({
        situacao: 'concluida',
        restanteCentavos: 0,
        porMesCentavos: null,
        porDiaCentavos: null,
      });
    }
  });

  it('com prazo passado fica vencida, sem parcelas', () => {
    expect(plano(100000, '2026-10', 30000)).toMatchObject({
      situacao: 'vencida',
      mesesRestantes: 0,
      restanteCentavos: 70000,
      porMesCentavos: null,
      porDiaCentavos: null,
    });
    expect(plano(100000, '2025-01')?.situacao).toBe('vencida');
  });

  it('concluída vale mais que vencida', () => {
    expect(plano(100000, '2026-10', 100000)?.situacao).toBe('concluida');
  });

  it('curto prazo vai até 2 meses', () => {
    expect(plano(100000, '2026-12')?.curtoPrazo).toBe(true);
    expect(plano(100000, '2027-01')?.curtoPrazo).toBe(false);
  });

  it('atravessa a virada de ano', () => {
    expect(plano(100000, '2027-01', 0, '2026-12-15')).toMatchObject({
      mesesRestantes: 2,
      diasRestantes: 48,
      curtoPrazo: true,
    });
  });

  it('considera 29 de fevereiro em ano bissexto', () => {
    expect(plano(100000, '2028-02', 0, '2028-02-01')?.diasRestantes).toBe(29);
  });
});

describe('totalMensalDasMetas', () => {
  it('soma só as metas em andamento', () => {
    expect(
      totalMensalDasMetas(
        [
          meta(100000, '2027-01'),
          meta(60000, '2027-01', 30000),
          meta(100000, '2027-01', 100000),
          meta(100000, '2026-10'),
          meta(100000, null),
          meta(null, null),
        ],
        HOJE,
      ),
    ).toBe(43334);
  });

  it('sem metas é zero', () => {
    expect(totalMensalDasMetas([], HOJE)).toBe(0);
  });
});

describe('mesesAFrente e avancarMes', () => {
  it('avança a partir do mês de hoje', () => {
    expect(mesesAFrente(HOJE, 3)).toBe('2027-02');
    expect(mesesAFrente(HOJE, 12)).toBe('2027-11');
    expect(mesesAFrente(HOJE, 0)).toBe('2026-11');
  });

  it('avancarMes aceita delta negativo', () => {
    expect(avancarMes('2027-01', -2)).toBe('2026-11');
  });
});

describe('fraseDoPlano e parcelaDoPlano', () => {
  const frase = (...args: Parameters<typeof plano>) => {
    const resultado = plano(...args);
    return resultado && fraseDoPlano(resultado);
  };

  it('em andamento mostra o valor por mês', () => {
    expect(frase(960000, '2027-10')).toBe('R$ 800,00/mês · até out. 2027');
  });

  it('em curto prazo mostra o valor por dia e o último dia', () => {
    expect(frase(12000, '2026-11')).toBe('R$ 5,00/dia · até 30 de nov.');
  });

  it('no último dia do mês não diz "Hoje"', () => {
    expect(frase(500, '2026-11', 0, '2026-11-30')).toBe(
      'R$ 5,00/dia · até 30 de nov.',
    );
  });

  it('concluída e vencida têm frases próprias e nenhuma parcela', () => {
    expect(frase(1000, '2027-01', 1000)).toBe('Meta atingida 🎉');
    expect(frase(100000, '2026-10', 30000)).toBe(
      'Prazo encerrado · faltam R$ 700,00',
    );
    const concluida = plano(1000, '2027-01', 1000);
    expect(concluida && parcelaDoPlano(concluida)).toBeNull();
  });
});
