import {describe, expect, it} from '@jest/globals';

import {
  CORES_COFRE,
  ICONES_COFRE,
  progressoCofre,
  resumoCofres,
  validarCofre,
  validarMovimento,
} from '../src/domain/cofres';
import type {Cofre, DadosCofre} from '../src/domain/entities/Cofre';

const dados: DadosCofre = {
  nome: 'Viagem',
  icone: '✈️',
  cor: '#64B5F6',
  metaCentavos: 800000,
  prazo: null,
};

const HOJE = '2026-11-07';

const validar = (
  dadosCofre: DadosCofre,
  nomes: string[],
  prazoAnterior?: string | null,
) => validarCofre(dadosCofre, nomes, HOJE, prazoAnterior);

const resumoDe = (cofres: Cofre[]) => resumoCofres(cofres, HOJE);

const cofre = (
  id: number,
  saldoCentavos: number,
  metaCentavos: number | null,
  prazo: string | null = null,
): Cofre => ({
  id,
  nome: `Cofre ${id}`,
  icone: '💰',
  cor: '#39FF84',
  metaCentavos,
  prazo,
  saldoCentavos,
});

describe('listas de cofre', () => {
  it('tem 16 ícones e 6 cores sem repetir', () => {
    expect(ICONES_COFRE).toHaveLength(16);
    expect(new Set(ICONES_COFRE).size).toBe(16);
    expect(CORES_COFRE).toEqual([
      '#39FF84',
      '#64B5F6',
      '#CE93D8',
      '#FFB74D',
      '#FF6B6B',
      '#80DEEA',
    ]);
  });
});

describe('validarCofre', () => {
  it('aceita dados válidos e devolve o nome sem espaços nas pontas', () => {
    const resultado = validar({...dados, nome: '  Viagem  '}, ['Carro']);
    expect(resultado).toEqual({
      valido: true,
      erros: {},
      dados: {...dados, nome: 'Viagem'},
    });
  });

  it('aceita cofre sem meta', () => {
    expect(validar({...dados, metaCentavos: null}, []).valido).toBe(true);
  });

  it('exige o nome', () => {
    expect(validar({...dados, nome: ''}, []).erros.nome).toBe(
      'Dê um nome ao cofre.',
    );
  });

  it('não aceita nome só com espaços', () => {
    const resultado = validar({...dados, nome: '    '}, []);
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.nome).toBe('Dê um nome ao cofre.');
  });

  it('aceita 30 caracteres e recusa 31', () => {
    expect(validar({...dados, nome: 'a'.repeat(30)}, []).valido).toBe(true);
    expect(validar({...dados, nome: 'a'.repeat(31)}, []).erros.nome).toBe(
      'O nome pode ter no máximo 30 caracteres.',
    );
  });

  it('recusa nome repetido com outra caixa e espaços', () => {
    expect(
      validar({...dados, nome: ' viagem '}, ['Carro', 'VIAGEM ']).erros.nome,
    ).toBe('Já existe um cofre com esse nome.');
  });

  it('recusa ícone e cor fora das listas', () => {
    const {erros} = validar({...dados, icone: '🍕', cor: '#000000'}, []);
    expect(erros.icone).toBe('Escolha um ícone.');
    expect(erros.cor).toBe('Escolha uma cor.');
  });

  it('recusa meta 0, negativa ou fracionada', () => {
    for (const metaCentavos of [0, -100, 10.5]) {
      expect(validar({...dados, metaCentavos}, []).erros.metaCentavos).toBe(
        'A meta precisa ser maior que zero.',
      );
    }
  });
});

describe('progressoCofre', () => {
  it('sem meta devolve null', () => {
    expect(progressoCofre(50000, null)).toBeNull();
    expect(progressoCofre(50000, 0)).toBeNull();
  });

  it('calcula a metade', () => {
    expect(progressoCofre(400000, 800000)).toBe(0.5);
  });

  it('passou da meta fica em 1 e saldo zerado em 0', () => {
    expect(progressoCofre(900000, 800000)).toBe(1);
    expect(progressoCofre(0, 800000)).toBe(0);
  });
});

describe('validarMovimento', () => {
  const base = {saldoCofreCentavos: 30000, disponivelCentavos: 100000};

  it('exige valor maior que zero', () => {
    expect(
      validarMovimento({...base, tipo: 'deposito', valorCentavos: 0}),
    ).toBe('Informe um valor maior que zero.');
    expect(
      validarMovimento({...base, tipo: 'retirada', valorCentavos: 0}),
    ).toBe('Informe um valor maior que zero.');
  });

  it('não deixa retirar mais do que o cofre tem', () => {
    expect(
      validarMovimento({...base, tipo: 'retirada', valorCentavos: 30001}),
    ).toBe('Este cofre tem só R$ 300,00.');
    expect(
      validarMovimento({...base, tipo: 'retirada', valorCentavos: 30000}),
    ).toBeNull();
  });

  it('não deixa guardar mais do que o disponível', () => {
    expect(
      validarMovimento({...base, tipo: 'deposito', valorCentavos: 100001}),
    ).toBe('Você tem só R$ 1.000,00 disponível.');
    expect(
      validarMovimento({...base, tipo: 'deposito', valorCentavos: 100000}),
    ).toBeNull();
  });

  it('com disponível zerado ou negativo não deixa guardar', () => {
    for (const disponivelCentavos of [0, -5000]) {
      expect(
        validarMovimento({
          ...base,
          disponivelCentavos,
          tipo: 'deposito',
          valorCentavos: 100,
        }),
      ).toBe('Não há saldo disponível para guardar.');
    }
  });

  it('retirar continua possível com disponível negativo', () => {
    expect(
      validarMovimento({
        ...base,
        disponivelCentavos: -5000,
        tipo: 'retirada',
        valorCentavos: 10000,
      }),
    ).toBeNull();
  });
});

describe('resumoCofres', () => {
  it('sem cofres zera tudo', () => {
    expect(resumoDe([])).toEqual({
      totalGuardadoCentavos: 0,
      totalMetasCentavos: 0,
      progressoGeral: null,
      quantidade: 0,
      totalMensalMetasCentavos: 0,
    });
  });

  it('sem metas deixa o progresso geral null', () => {
    expect(resumoDe([cofre(1, 5000, null), cofre(2, 7000, null)])).toEqual({
      totalGuardadoCentavos: 12000,
      totalMetasCentavos: 0,
      progressoGeral: null,
      quantidade: 2,
      totalMensalMetasCentavos: 0,
    });
  });

  it('misto: progresso geral só com os cofres que têm meta', () => {
    const resumo = resumoDe([
      cofre(1, 20000, 100000),
      cofre(2, 50000, null),
      cofre(3, 60000, 100000),
    ]);
    expect(resumo).toEqual({
      totalGuardadoCentavos: 130000,
      totalMetasCentavos: 200000,
      progressoGeral: 0.4,
      quantidade: 3,
      totalMensalMetasCentavos: 0,
    });
  });

  it('um cofre que passou da meta não infla o progresso geral', () => {
    const resumo = resumoDe([cofre(1, 300000, 100000), cofre(2, 0, 100000)]);
    expect(resumo.progressoGeral).toBe(0.5);
  });
});

describe('validarCofre: prazo', () => {
  const erroPrazo = (prazo: string | null, prazoAnterior?: string | null) =>
    validar({...dados, prazo}, [], prazoAnterior).erros.prazo;

  it('aceita sem prazo, no mês atual e no futuro', () => {
    expect(erroPrazo(null)).toBeUndefined();
    expect(erroPrazo('2026-11')).toBeUndefined();
    expect(erroPrazo('2027-01')).toBeUndefined();
  });

  it('exige meta para ter prazo', () => {
    expect(
      validar({...dados, metaCentavos: null, prazo: '2026-12'}, []).erros.prazo,
    ).toBe('Defina o valor da meta para escolher um prazo.');
  });

  it('recusa mês passado em cofre novo ou com outro prazo', () => {
    expect(erroPrazo('2026-10')).toBe(
      'O prazo não pode ser antes do mês atual.',
    );
    expect(erroPrazo('2026-10', '2026-09')).toBeDefined();
  });

  it('aceita o mês passado que o cofre já tinha', () => {
    expect(erroPrazo('2026-10', '2026-10')).toBeUndefined();
  });

  it('aceita até 30 anos à frente e recusa 31', () => {
    expect(erroPrazo('2056-11')).toBeUndefined();
    expect(erroPrazo('2056-12')).toBeDefined();
    expect(erroPrazo('2057-11')).toBeDefined();
  });

  it.each([
    ['2026-1'],
    ['26-12'],
    ['2026-13'],
    ['2026-00'],
    ['dez/2026'],
    [''],
  ])('recusa o formato "%s"', prazo => {
    expect(erroPrazo(prazo)).toBe('Escolha um mês válido para o prazo.');
  });
});

describe('resumoCofres: metas com prazo', () => {
  it('soma o mensal das metas em andamento', () => {
    const resumo = resumoDe([
      cofre(1, 0, 100000, '2027-01'),
      cofre(2, 0, 100000, null),
    ]);
    expect(resumo.totalMensalMetasCentavos).toBe(33334);
  });
});
