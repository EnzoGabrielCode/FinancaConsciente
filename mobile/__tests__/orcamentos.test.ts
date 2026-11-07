import {describe, expect, it} from '@jest/globals';

import {
  MAX_LIMITE_CENTAVOS,
  montarProgressos,
  nivelAlcancado,
  percentualDe,
  resumir,
  situacaoDo,
  validarOrcamento,
} from '../src/domain/orcamentos';

const orcamento = (id: number, categoria: string, limiteCentavos: number) => ({
  id,
  categoria,
  limiteCentavos,
});

describe('situacaoDo', () => {
  it.each([
    [7999, 'ok'],
    [8000, 'perto'],
    [9900, 'perto'],
    [9999, 'perto'],
    [10000, 'estourado'],
    [15000, 'estourado'],
  ])('com gasto %i de 10000 fica %s', (gasto, situacao) => {
    expect(situacaoDo(gasto, 10000)).toBe(situacao);
  });

  it('funciona com limite de 1 centavo', () => {
    expect(situacaoDo(0, 1)).toBe('ok');
    expect(situacaoDo(1, 1)).toBe('estourado');
  });

  it('compara exato no maior limite permitido', () => {
    const oitentaPorCento = (MAX_LIMITE_CENTAVOS / 100) * 80 + 0.2;
    expect(situacaoDo(Math.floor(oitentaPorCento), MAX_LIMITE_CENTAVOS)).toBe(
      'ok',
    );
    expect(situacaoDo(Math.ceil(oitentaPorCento), MAX_LIMITE_CENTAVOS)).toBe(
      'perto',
    );
  });
});

describe('nivelAlcancado', () => {
  it('devolve null, 80 ou 100', () => {
    expect(nivelAlcancado(7999, 10000)).toBeNull();
    expect(nivelAlcancado(8000, 10000)).toBe(80);
    expect(nivelAlcancado(9999, 10000)).toBe(80);
    expect(nivelAlcancado(10000, 10000)).toBe(100);
  });
});

describe('percentualDe', () => {
  it('arredonda para baixo para não mostrar 100% antes de estourar', () => {
    expect(percentualDe(9999, 10000)).toBe(99);
    expect(percentualDe(7999, 10000)).toBe(79);
    expect(percentualDe(12000, 10000)).toBe(120);
  });

  it('devolve 0 sem limite', () => {
    expect(percentualDe(100, 0)).toBe(0);
  });
});

describe('montarProgressos', () => {
  it('calcula os campos e ordena do maior percentual para o menor', () => {
    const progressos = montarProgressos(
      [
        orcamento(1, 'lazer', 10000),
        orcamento(2, 'compras', 10000),
        orcamento(3, 'saude', 10000),
      ],
      {lazer: 5000, compras: 12000},
    );

    expect(progressos.map(p => p.orcamento.categoria)).toEqual([
      'compras',
      'lazer',
      'saude',
    ]);
    expect(progressos[0]).toMatchObject({
      gastoCentavos: 12000,
      percentual: 120,
      restanteCentavos: -2000,
      situacao: 'estourado',
    });
    expect(progressos[2]).toMatchObject({
      gastoCentavos: 0,
      percentual: 0,
      restanteCentavos: 10000,
      situacao: 'ok',
    });
  });
});

describe('resumir', () => {
  it('soma os totais e aceita disponível negativo', () => {
    const progressos = montarProgressos(
      [orcamento(1, 'lazer', 10000), orcamento(2, 'compras', 5000)],
      {lazer: 20000, compras: 1000},
    );
    expect(resumir(progressos, '2026-11-06')).toEqual({
      totalLimite: 15000,
      totalGasto: 21000,
      disponivel: -6000,
      percentual: 140,
      diasRestantes: 25,
    });
  });

  it('conta hoje em diasRestantes', () => {
    expect(resumir([], '2026-11-30').diasRestantes).toBe(1);
    expect(resumir([], '2026-11-01').diasRestantes).toBe(30);
    expect(resumir([], '2028-02-28').diasRestantes).toBe(2);
  });

  it('não divide por zero sem orçamentos', () => {
    expect(resumir([], '2026-11-06').percentual).toBe(0);
  });
});

describe('validarOrcamento', () => {
  const dados = {categoria: 'lazer', limiteCentavos: 10000};

  it('aceita dados válidos e o limite máximo', () => {
    expect(validarOrcamento(dados).valido).toBe(true);
    expect(
      validarOrcamento({...dados, limiteCentavos: MAX_LIMITE_CENTAVOS}).valido,
    ).toBe(true);
  });

  it.each([['inexistente'], ['salario'], ['']])(
    'rejeita a categoria "%s"',
    categoria => {
      const {valido, erros} = validarOrcamento({...dados, categoria});
      expect(valido).toBe(false);
      expect(erros.categoria).toBeDefined();
    },
  );

  it.each([[0], [-100], [10.5], [Number.NaN], [MAX_LIMITE_CENTAVOS + 1]])(
    'rejeita o limite %p',
    limiteCentavos => {
      const {valido, erros} = validarOrcamento({...dados, limiteCentavos});
      expect(valido).toBe(false);
      expect(erros.limiteCentavos).toBeDefined();
    },
  );
});
