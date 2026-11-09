import {describe, expect, it} from '@jest/globals';

import type {FiltroRelatorio} from '../src/domain/entities/Relatorio';
import type {Transacao} from '../src/domain/entities/Transacao';
import {evolucaoPatrimonio, resumoPatrimonio} from '../src/domain/patrimonio';
import {
  gerarCsv,
  montarRelatorio,
  nomeArquivo,
  periodoPredefinido,
  validarFiltro,
} from '../src/domain/relatorios';

let proximoId = 1;
const transacao = (dados: Partial<Transacao>): Transacao => ({
  id: proximoId++,
  tipo: 'despesa',
  descricao: 'Mercado',
  valorCentavos: 1000,
  data: '2026-11-03',
  categoria: 'alimentacao',
  recorrencia: 'variavel',
  comprovanteUri: null,
  contaRecorrenteId: null,
  sincronizado: false,
  ...dados,
});

const filtro = (dados: Partial<FiltroRelatorio> = {}): FiltroRelatorio => ({
  de: '2026-11-01',
  ate: '2026-11-30',
  tipo: 'todos',
  categoria: null,
  ...dados,
});

describe('periodoPredefinido', () => {
  const hoje = '2026-11-09';

  it('este mês vai do dia 1 até hoje', () => {
    expect(periodoPredefinido('este-mes', hoje)).toEqual({
      de: '2026-11-01',
      ate: '2026-11-09',
    });
  });

  it('mês passado vai do primeiro ao último dia', () => {
    expect(periodoPredefinido('mes-passado', hoje)).toEqual({
      de: '2026-10-01',
      ate: '2026-10-31',
    });
  });

  it('3 meses começa no dia 1 de dois meses atrás', () => {
    expect(periodoPredefinido('3-meses', hoje)).toEqual({
      de: '2026-09-01',
      ate: '2026-11-09',
    });
  });

  it('este ano começa em 1º de janeiro', () => {
    expect(periodoPredefinido('este-ano', hoje)).toEqual({
      de: '2026-01-01',
      ate: '2026-11-09',
    });
  });

  it('em janeiro, mês passado é dezembro do ano anterior', () => {
    expect(periodoPredefinido('mes-passado', '2027-01-15')).toEqual({
      de: '2026-12-01',
      ate: '2026-12-31',
    });
    expect(periodoPredefinido('3-meses', '2027-01-15')).toEqual({
      de: '2026-11-01',
      ate: '2027-01-15',
    });
  });

  it('mês passado considera fevereiro bissexto', () => {
    expect(periodoPredefinido('mes-passado', '2028-03-10').ate).toBe(
      '2028-02-29',
    );
  });
});

describe('validarFiltro', () => {
  it('aceita um período válido, inclusive de um dia', () => {
    expect(validarFiltro(filtro())).toBeNull();
    expect(
      validarFiltro(filtro({de: '2026-11-05', ate: '2026-11-05'})),
    ).toBeNull();
  });

  it('recusa data inicial depois da final', () => {
    expect(validarFiltro(filtro({de: '2026-11-10', ate: '2026-11-01'}))).toBe(
      'A data inicial precisa ser antes da final.',
    );
  });

  it('aceita até 3 anos e recusa mais', () => {
    expect(
      validarFiltro(filtro({de: '2023-11-01', ate: '2026-11-01'})),
    ).toBeNull();
    expect(validarFiltro(filtro({de: '2023-11-01', ate: '2026-11-02'}))).toBe(
      'O período pode ter no máximo 3 anos.',
    );
  });

  it('recusa datas inválidas', () => {
    expect(validarFiltro(filtro({de: '2026-02-30'}))).toBe(
      'Escolha datas válidas.',
    );
    expect(validarFiltro(filtro({ate: '30/11/2026'}))).toBe(
      'Escolha datas válidas.',
    );
  });
});

describe('montarRelatorio', () => {
  const lancamentos = [
    transacao({tipo: 'receita', categoria: 'salario', valorCentavos: 500000}),
    transacao({valorCentavos: 30000, categoria: 'alimentacao'}),
    transacao({valorCentavos: 10000, categoria: 'transporte'}),
    transacao({valorCentavos: 60000, categoria: 'alimentacao'}),
    transacao({valorCentavos: 99999, data: '2026-10-31'}),
  ];

  it('soma receitas, despesas e resultado dentro do período', () => {
    const relatorio = montarRelatorio(filtro(), lancamentos);
    expect(relatorio).toMatchObject({
      totalReceitas: 500000,
      totalDespesas: 100000,
      resultado: 400000,
      quantidade: 4,
    });
  });

  it('agrupa só as despesas por categoria, da maior para a menor', () => {
    expect(montarRelatorio(filtro(), lancamentos).porCategoria).toEqual([
      {categoria: 'alimentacao', totalCentavos: 90000, percentual: 0.9},
      {categoria: 'transporte', totalCentavos: 10000, percentual: 0.1},
    ]);
  });

  it('filtra por tipo', () => {
    const receitas = montarRelatorio(filtro({tipo: 'receita'}), lancamentos);
    expect(receitas).toMatchObject({
      quantidade: 1,
      totalDespesas: 0,
      porCategoria: [],
    });
    expect(
      montarRelatorio(filtro({tipo: 'despesa'}), lancamentos).quantidade,
    ).toBe(3);
  });

  it('filtra por categoria', () => {
    const relatorio = montarRelatorio(
      filtro({categoria: 'alimentacao'}),
      lancamentos,
    );
    expect(relatorio.quantidade).toBe(2);
    expect(relatorio.porCategoria).toEqual([
      {categoria: 'alimentacao', totalCentavos: 90000, percentual: 1},
    ]);
  });

  it('período sem lançamentos zera tudo sem dividir por zero', () => {
    expect(
      montarRelatorio(
        filtro({de: '2026-12-01', ate: '2026-12-31'}),
        lancamentos,
      ),
    ).toMatchObject({
      quantidade: 0,
      totalReceitas: 0,
      totalDespesas: 0,
      resultado: 0,
      porCategoria: [],
    });
  });
});

describe('gerarCsv', () => {
  const csvDe = (lista: Transacao[]) =>
    gerarCsv(montarRelatorio(filtro(), lista));
  const linhas = (csv: string) => csv.slice(1).split('\r\n');

  it('começa com BOM e tem o cabeçalho com ;', () => {
    const csv = csvDe([]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(linhas(csv)[0]).toBe('Data;Descrição;Categoria;Tipo;Valor');
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('escreve data, categoria, tipo e valor no formato brasileiro', () => {
    const csv = csvDe([
      transacao({descricao: 'Açougue São João', valorCentavos: 8990}),
      transacao({
        tipo: 'receita',
        descricao: 'Salário',
        categoria: 'salario',
        valorCentavos: 125000,
        data: '2026-11-05',
      }),
    ]);
    expect(linhas(csv).slice(1, 3)).toEqual([
      '03/11/2026;Açougue São João;Alimentação;Despesa;-89,90',
      '05/11/2026;Salário;Salário;Receita;1250,00',
    ]);
  });

  it('põe entre aspas e duplica as aspas quando há ; " ou quebra de linha', () => {
    const csv = csvDe([
      transacao({descricao: 'Pão; leite e "café"'}),
      transacao({descricao: 'linha 1\nlinha 2'}),
    ]);
    expect(linhas(csv)[1]).toBe(
      '03/11/2026;"Pão; leite e ""café""";Alimentação;Despesa;-10,00',
    );
    expect(csv).toContain('"linha 1\nlinha 2"');
  });

  it.each([['=SOMA(A1)'], ['+5511999'], ['-desconto'], ['@usuario']])(
    'protege "%s" contra fórmula',
    descricao => {
      const csv = csvDe([transacao({descricao})]);
      expect(linhas(csv)[1].split(';')[1]).toBe(`'${descricao}`);
    },
  );

  it('fórmula com ; fica com o prefixo dentro das aspas', () => {
    const csv = csvDe([transacao({descricao: '=1;2'})]);
    expect(linhas(csv)[1]).toContain(`;"'=1;2";`);
  });

  it('o valor negativo da despesa não recebe o prefixo', () => {
    const csv = csvDe([transacao({valorCentavos: 8990})]);
    expect(linhas(csv)[1].endsWith(';-89,90')).toBe(true);
  });

  it('valores pequenos e grandes mantêm duas casas, sem milhar', () => {
    const csv = csvDe([
      transacao({valorCentavos: 5}),
      transacao({
        tipo: 'receita',
        categoria: 'salario',
        valorCentavos: 123456789,
      }),
    ]);
    expect(linhas(csv)[1].endsWith(';-0,05')).toBe(true);
    expect(linhas(csv)[2].endsWith(';1234567,89')).toBe(true);
  });
});

describe('nomeArquivo', () => {
  it('usa o período e a extensão', () => {
    expect(nomeArquivo(filtro(), 'pdf')).toBe(
      'financaconsciente-2026-11-01-a-2026-11-30.pdf',
    );
    expect(nomeArquivo(filtro(), 'csv')).toBe(
      'financaconsciente-2026-11-01-a-2026-11-30.csv',
    );
  });
});

describe('evolucaoPatrimonio', () => {
  const totais = (
    anoMes: string,
    receitasCentavos: number,
    despesasCentavos: number,
  ) => ({anoMes, receitasCentavos, despesasCentavos});

  it('acumula mês a mês e repete o anterior no mês vazio', () => {
    expect(
      evolucaoPatrimonio(
        10000,
        [totais('2026-09', 5000, 1000), totais('2026-11', 0, 3000)],
        ['2026-09', '2026-10', '2026-11'],
      ),
    ).toEqual([
      {anoMes: '2026-09', patrimonioCentavos: 14000},
      {anoMes: '2026-10', patrimonioCentavos: 14000},
      {anoMes: '2026-11', patrimonioCentavos: 11000},
    ]);
  });

  it('pode ficar negativo', () => {
    const serie = evolucaoPatrimonio(
      1000,
      [totais('2026-10', 0, 5000), totais('2026-11', 2000, 0)],
      ['2026-10', '2026-11'],
    );
    expect(serie.map(p => p.patrimonioCentavos)).toEqual([-4000, -2000]);
  });

  it('ignora meses fora da lista', () => {
    expect(
      evolucaoPatrimonio(0, [totais('2025-01', 9999, 0)], ['2026-11']),
    ).toEqual([{anoMes: '2026-11', patrimonioCentavos: 0}]);
  });
});

describe('resumoPatrimonio', () => {
  const serie = (...valores: number[]) =>
    valores.map((patrimonioCentavos, i) => ({
      anoMes: `2026-${String(i + 1).padStart(2, '0')}`,
      patrimonioCentavos,
    }));

  it('compara o último mês com o primeiro', () => {
    expect(resumoPatrimonio(serie(10000, 12000, 15000))).toEqual({
      atual: 15000,
      variacaoCentavos: 5000,
      variacaoPercentual: 0.5,
    });
  });

  it('percentual null quando o primeiro é zero', () => {
    expect(resumoPatrimonio(serie(0, 5000))).toEqual({
      atual: 5000,
      variacaoCentavos: 5000,
      variacaoPercentual: null,
    });
  });

  it('partindo do negativo, melhorar dá percentual positivo', () => {
    expect(resumoPatrimonio(serie(-1000, -500)).variacaoPercentual).toBe(0.5);
  });

  it('série vazia zera tudo', () => {
    expect(resumoPatrimonio([])).toEqual({
      atual: 0,
      variacaoCentavos: 0,
      variacaoPercentual: null,
    });
  });
});
