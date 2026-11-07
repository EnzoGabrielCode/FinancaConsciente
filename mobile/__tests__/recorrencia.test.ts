import {describe, expect, it} from '@jest/globals';

import type {
  ContaRecorrente,
  DadosContaRecorrente,
} from '../src/domain/entities/ContaRecorrente';
import {
  dataDoLembrete,
  descreverFrequencia,
  descreverProximo,
  HORA_LEMBRETE,
  MAX_VALOR_CONTA_CENTAVOS,
  momentoDoLembrete,
  mudouAgenda,
  primeiroVencimento,
  textoContasLancadas,
  totalMensalFixo,
  validarContaRecorrente,
  vencimentoNoMes,
  vencimentosAte,
  vencimentoSeguinte,
} from '../src/domain/recorrencia';

const conta = (dados: Partial<ContaRecorrente> = {}): ContaRecorrente => ({
  id: 1,
  descricao: 'Internet',
  valorCentavos: 9990,
  categoria: 'outros',
  frequencia: 'mensal',
  dia: 10,
  mes: null,
  lembrarDiasAntes: 2,
  ativa: true,
  proxima: '2026-12-10',
  ...dados,
});

const mensal = (dia: number) => ({
  frequencia: 'mensal' as const,
  dia,
  mes: null,
});
const anual = (dia: number, mes: number) => ({
  frequencia: 'anual' as const,
  dia,
  mes,
});

describe('vencimentoNoMes', () => {
  it('mantém o dia quando o mês tem esse dia', () => {
    expect(vencimentoNoMes(10, '2026-12')).toBe('2026-12-10');
    expect(vencimentoNoMes(5, '2026-12')).toBe('2026-12-05');
    expect(vencimentoNoMes(31, '2026-12')).toBe('2026-12-31');
  });

  it('dia 31 em abril cai no dia 30', () => {
    expect(vencimentoNoMes(31, '2026-04')).toBe('2026-04-30');
  });

  it('29, 30 e 31 caem no último dia de fevereiro', () => {
    for (const dia of [29, 30, 31]) {
      expect(vencimentoNoMes(dia, '2026-02')).toBe('2026-02-28');
      expect(vencimentoNoMes(dia, '2028-02')).toBe('2028-02-29');
    }
  });
});

describe('primeiroVencimento', () => {
  it('com dia maior que hoje vence neste mês', () => {
    expect(primeiroVencimento(mensal(20), '2026-11-07')).toBe('2026-11-20');
  });

  it('com dia igual a hoje vence hoje', () => {
    expect(primeiroVencimento(mensal(7), '2026-11-07')).toBe('2026-11-07');
  });

  it('com dia menor que hoje vence no mês seguinte', () => {
    expect(primeiroVencimento(mensal(5), '2026-11-07')).toBe('2026-12-05');
    expect(primeiroVencimento(mensal(5), '2026-12-07')).toBe('2027-01-05');
  });

  it('dia 31 num mês de 30 dias vence no último dia', () => {
    expect(primeiroVencimento(mensal(31), '2026-11-07')).toBe('2026-11-30');
    expect(primeiroVencimento(mensal(31), '2026-11-30')).toBe('2026-11-30');
  });

  it('anual vence neste ano ou no seguinte', () => {
    expect(primeiroVencimento(anual(15, 12), '2026-11-07')).toBe('2026-12-15');
    expect(primeiroVencimento(anual(15, 11), '2026-11-15')).toBe('2026-11-15');
    expect(primeiroVencimento(anual(15, 3), '2026-11-07')).toBe('2027-03-15');
  });

  it('29/fev anual vence no último dia em ano não bissexto', () => {
    expect(primeiroVencimento(anual(29, 2), '2026-11-07')).toBe('2027-02-28');
    expect(primeiroVencimento(anual(29, 2), '2028-01-01')).toBe('2028-02-29');
  });
});

describe('vencimentoSeguinte', () => {
  it('31/jan → 28/fev → 31/mar, sem grudar no 28', () => {
    const agenda = mensal(31);
    const fevereiro = vencimentoSeguinte(agenda, '2026-01-31');
    expect(fevereiro).toBe('2026-02-28');
    const marco = vencimentoSeguinte(agenda, fevereiro);
    expect(marco).toBe('2026-03-31');
    expect(vencimentoSeguinte(agenda, marco)).toBe('2026-04-30');
  });

  it('vira o ano', () => {
    expect(vencimentoSeguinte(mensal(10), '2026-12-10')).toBe('2027-01-10');
  });

  it('anual em 29/fev volta ao 29 no ano bissexto', () => {
    const agenda = anual(29, 2);
    expect(vencimentoSeguinte(agenda, '2026-02-28')).toBe('2027-02-28');
    expect(vencimentoSeguinte(agenda, '2027-02-28')).toBe('2028-02-29');
    expect(vencimentoSeguinte(agenda, '2028-02-29')).toBe('2029-02-28');
  });
});

describe('vencimentosAte', () => {
  it('nada a lançar antes do vencimento', () => {
    expect(vencimentosAte(conta(), '2026-12-09')).toEqual([]);
  });

  it('inclui o dia de hoje', () => {
    expect(vencimentosAte(conta(), '2026-12-10')).toEqual(['2026-12-10']);
  });

  it('lista 3 meses atrasados', () => {
    expect(
      vencimentosAte(conta({proxima: '2026-09-10'}), '2026-11-20'),
    ).toEqual(['2026-09-10', '2026-10-10', '2026-11-10']);
  });

  it('com 20 atrasados para em 12', () => {
    const datas = vencimentosAte(conta({proxima: '2025-04-10'}), '2026-11-20');
    expect(datas).toHaveLength(12);
    expect(datas[0]).toBe('2025-04-10');
    expect(datas[11]).toBe('2026-03-10');
  });

  it('funciona com conta anual', () => {
    expect(
      vencimentosAte(
        conta({frequencia: 'anual', mes: 3, dia: 15, proxima: '2025-03-15'}),
        '2026-11-20',
      ),
    ).toEqual(['2025-03-15', '2026-03-15']);
  });
});

describe('lembretes', () => {
  it('dataDoLembrete volta os dias, atravessando mês e ano', () => {
    expect(dataDoLembrete('2026-12-10', 2)).toBe('2026-12-08');
    expect(dataDoLembrete('2026-12-10', 0)).toBe('2026-12-10');
    expect(dataDoLembrete('2026-12-03', 7)).toBe('2026-11-26');
    expect(dataDoLembrete('2027-01-01', 1)).toBe('2026-12-31');
    expect(dataDoLembrete('2028-03-01', 1)).toBe('2028-02-29');
  });

  it('momentoDoLembrete é às 9h no fuso do aparelho', () => {
    const momento = momentoDoLembrete('2026-12-10');
    expect(HORA_LEMBRETE).toBe(9);
    expect(momento.getFullYear()).toBe(2026);
    expect(momento.getMonth()).toBe(11);
    expect(momento.getDate()).toBe(10);
    expect(momento.getHours()).toBe(9);
    expect(momento.getMinutes()).toBe(0);
  });
});

describe('totalMensalFixo', () => {
  it('soma as mensais e 1/12 das anuais, arredondando para cima', () => {
    expect(
      totalMensalFixo([
        conta({valorCentavos: 10000}),
        conta({frequencia: 'anual', mes: 3, valorCentavos: 100000}),
      ]),
    ).toBe(18334);
  });

  it('ignora as pausadas', () => {
    expect(
      totalMensalFixo([
        conta({valorCentavos: 10000}),
        conta({valorCentavos: 50000, ativa: false}),
        conta({
          frequencia: 'anual',
          mes: 3,
          valorCentavos: 120000,
          ativa: false,
        }),
      ]),
    ).toBe(10000);
  });

  it('sem contas é zero', () => {
    expect(totalMensalFixo([])).toBe(0);
  });
});

describe('textos', () => {
  it('descreverFrequencia', () => {
    expect(descreverFrequencia(mensal(10))).toBe('Todo dia 10');
    expect(descreverFrequencia(anual(15, 3))).toBe('Todo ano em 15 de mar.');
    expect(descreverFrequencia(anual(29, 2))).toBe('Todo ano em 29 de fev.');
    expect(descreverFrequencia(anual(31, 4))).toBe('Todo ano em 30 de abr.');
  });

  it('descreverProximo', () => {
    const hoje = '2026-12-07';
    expect(descreverProximo('2026-12-10', hoje)).toBe(
      'Próximo: 10 de dez. · em 3 dias',
    );
    expect(descreverProximo('2026-12-07', hoje)).toBe(
      'Próximo: 7 de dez. · hoje',
    );
    expect(descreverProximo('2026-12-08', hoje)).toBe(
      'Próximo: 8 de dez. · amanhã',
    );
    expect(descreverProximo('2026-12-01', hoje)).toBe(
      'Próximo: 1 de dez. · atrasada',
    );
  });

  it('textoContasLancadas', () => {
    expect(textoContasLancadas(1)).toBe('1 conta fixa lançada');
    expect(textoContasLancadas(2)).toBe('2 contas fixas lançadas');
  });
});

describe('mudouAgenda', () => {
  it('compara frequência, dia e mês', () => {
    expect(mudouAgenda(mensal(10), mensal(10))).toBe(false);
    expect(mudouAgenda(mensal(10), mensal(11))).toBe(true);
    expect(mudouAgenda(mensal(10), anual(10, 3))).toBe(true);
    expect(mudouAgenda(anual(10, 3), anual(10, 4))).toBe(true);
  });
});

describe('validarContaRecorrente', () => {
  const dados: DadosContaRecorrente = {
    descricao: '  Internet ',
    valorCentavos: 9990,
    categoria: 'outros',
    frequencia: 'mensal',
    dia: 10,
    mes: null,
    lembrarDiasAntes: 2,
    ativa: true,
  };

  const erros = (alteracao: Partial<DadosContaRecorrente>) =>
    validarContaRecorrente({...dados, ...alteracao}).erros;

  it('aceita dados válidos e tira os espaços da descrição', () => {
    const resultado = validarContaRecorrente(dados);
    expect(resultado.valido).toBe(true);
    expect(resultado.dados.descricao).toBe('Internet');
  });

  it('aceita conta anual com mês e os limites', () => {
    expect(
      validarContaRecorrente({
        ...dados,
        frequencia: 'anual',
        mes: 12,
        dia: 31,
        valorCentavos: MAX_VALOR_CONTA_CENTAVOS,
        descricao: 'a'.repeat(40),
      }).valido,
    ).toBe(true);
  });

  it('exige a descrição de 1 a 40 caracteres', () => {
    expect(erros({descricao: '   '}).descricao).toBe('Dê um nome à conta.');
    expect(erros({descricao: 'a'.repeat(41)}).descricao).toBeDefined();
  });

  it.each([[0], [-100], [10.5], [Number.NaN], [MAX_VALOR_CONTA_CENTAVOS + 1]])(
    'recusa o valor %p',
    valorCentavos => {
      expect(erros({valorCentavos}).valorCentavos).toBeDefined();
    },
  );

  it.each([['inexistente'], ['salario'], ['']])(
    'recusa a categoria "%s"',
    categoria => {
      expect(erros({categoria}).categoria).toBeDefined();
    },
  );

  it('recusa frequência desconhecida', () => {
    expect(erros({frequencia: 'semanal' as never}).frequencia).toBeDefined();
  });

  it.each([[0], [32], [1.5]])('recusa o dia %p', dia => {
    expect(erros({dia}).dia).toBeDefined();
  });

  it('exige o mês só no anual', () => {
    expect(erros({mes: 3}).mes).toBe('Só a conta anual tem mês.');
    expect(erros({frequencia: 'anual', mes: null}).mes).toBeDefined();
    expect(erros({frequencia: 'anual', mes: 13}).mes).toBeDefined();
    expect(erros({frequencia: 'anual', mes: 0}).mes).toBeDefined();
  });

  it.each([[4], [6], [-1], [10]])('recusa o lembrete %p', lembrarDiasAntes => {
    expect(erros({lembrarDiasAntes}).lembrarDiasAntes).toBeDefined();
  });
});
