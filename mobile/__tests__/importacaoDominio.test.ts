import {describe, expect, it, jest} from '@jest/globals';

import type {Transacao} from '../src/domain/entities/Transacao';
import {
  detectarFormato,
  lerCsv,
  lerData,
  lerValor,
  linhasDoCsv,
} from '../src/domain/importacao/csv';
import {decodificarTexto} from '../src/domain/importacao/decodificar';
import {ERRO_MUITAS_LINHAS} from '../src/domain/importacao/limites';
import type {LinhaExtrato} from '../src/domain/importacao/linhaExtrato';
import {ERRO_NAO_OFX, lerOfx} from '../src/domain/importacao/ofx';
import {prepararImportacao} from '../src/domain/importacao/prepararImportacao';
import {
  COLUNAS_DESCONHECIDAS,
  COM_LINHA_INVALIDA,
  GENERICO_PONTO_E_VIRGULA,
  LINHAS_IDENTICAS,
  NUBANK_CARTAO,
  NUBANK_CONTA,
} from './fixtures/extratos/csv';
import {
  OFX_SEM_TRANSACOES,
  OFX_SGML_1252,
  OFX_XML,
} from './fixtures/extratos/ofx';

const bytes = (texto: string, codificacao: 'utf8' | 'latin1' = 'utf8') =>
  Uint8Array.from(Buffer.from(texto, codificacao));

describe('decodificarTexto', () => {
  it('lê UTF-8 e remove o BOM', () => {
    expect(decodificarTexto(bytes('\uFEFFCafé;Açaí'))).toBe('Café;Açaí');
  });

  it('cai para Windows-1252 quando não é UTF-8 válido', () => {
    expect(decodificarTexto(bytes('PREÇO;FARMÁCIA', 'latin1'))).toBe(
      'PREÇO;FARMÁCIA',
    );
  });

  it('usa a tabela própria para 0x80–0x9F', () => {
    const texto = decodificarTexto(
      Uint8Array.from([0x80, 0x20, 0x93, 0x41, 0x94, 0x96]),
    );
    expect(texto).toBe('€ “A”–');
  });

  it('normaliza CRLF e CR para LF', () => {
    expect(decodificarTexto(bytes('a\r\nb\rc\n'))).toBe('a\nb\nc\n');
  });

  it('não aceita UTF-8 com forma longa demais', () => {
    // 0xC0 0xAF seria "/" em forma longa: é inválido e vira Windows-1252.
    expect(decodificarTexto(Uint8Array.from([0xc0, 0xaf]))).toBe('À¯');
  });

  it('lê emoji (4 bytes) e caracteres de 3 bytes em UTF-8', () => {
    expect(decodificarTexto(bytes('Café ☕ 🍕'))).toBe('Café ☕ 🍕');
  });

  it('sequência UTF-8 incompleta cai no Windows-1252', () => {
    // 0xE9 abriria 3 bytes, mas o seguinte não é de continuação: é "é" no 1252.
    expect(decodificarTexto(Uint8Array.from([0x43, 0xe9, 0x41]))).toBe('CéA');
  });
});

describe('lerOfx', () => {
  it('lê OFX 1.x em SGML, sem fechamento, CRLF e CHARSET 1252', () => {
    const texto = decodificarTexto(bytes(OFX_SGML_1252, 'latin1'));
    expect(lerOfx(texto)).toEqual([
      {
        data: '2026-11-03',
        descricao: 'COMPRA CARTAO SUPERMERCADO BOM PREÇO',
        valorCentavos: -8990,
        idExterno: 'ofx:12345-6:202611030001',
      },
      {
        data: '2026-11-04',
        descricao: 'FARMÁCIA SAÚDE',
        valorCentavos: -4500,
        idExterno: 'ofx:12345-6:202611040001',
      },
      {
        data: '2026-11-05',
        descricao: 'SALARIO EMPRESA X',
        valorCentavos: 425000,
        idExterno: 'ofx:12345-6:202611050001',
      },
    ]);
  });

  it('lê OFX 2 (XML), com vírgula no valor e entidades', () => {
    const [padaria, uber] = lerOfx(OFX_XML);
    expect(padaria).toEqual({
      data: '2026-11-06',
      descricao: 'Padaria & Café',
      valorCentavos: -12050,
      idExterno: 'ofx:5555-4444:CC-1',
    });
    expect(uber.valorCentavos).toBe(-1500);
  });

  it('sem FITID usa um hash estável', () => {
    const [, primeira] = lerOfx(OFX_XML);
    const [, segunda] = lerOfx(OFX_XML);
    expect(primeira.idExterno).toMatch(/^ofx:5555-4444:h[0-9a-f]{8}$/);
    expect(segunda.idExterno).toBe(primeira.idExterno);
  });

  it('arquivo que não é OFX ou sem transações dá erro claro', () => {
    expect(() => lerOfx('Data;Valor\n01/11/2026;10,00')).toThrow(ERRO_NAO_OFX);
    expect(() => lerOfx(OFX_SEM_TRANSACOES)).toThrow(ERRO_NAO_OFX);
  });
});

describe('lerCsv', () => {
  it('detecta ";" e respeita aspas com ; e aspas duplicadas', () => {
    const tabela = lerCsv(GENERICO_PONTO_E_VIRGULA);
    expect(tabela[0]).toEqual(['Data Lançamento', 'Histórico', 'Valor (R$)']);
    expect(tabela[2]).toEqual([
      '02/11/2026',
      'PADARIA; CAFE DA MANHA',
      '-12,50',
    ]);
    // Aspas no meio de um campo sem aspas são texto, não citação.
    expect(tabela[3][1]).toBe('PIX ENVIADO "JOAO"');
  });

  it('detecta "," e tab', () => {
    expect(lerCsv(NUBANK_CONTA)[3][3]).toBe('Pagamento de boleto - Luz, gás');
    expect(lerCsv('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('aceita aspas duplicadas e quebra de linha dentro de aspas', () => {
    expect(lerCsv('a;b\n"diz ""oi""";"linha 1\nlinha 2"')).toEqual([
      ['a', 'b'],
      ['diz "oi"', 'linha 1\nlinha 2'],
    ]);
  });

  it('ignora linhas vazias', () => {
    expect(lerCsv('a;b\n\n1;2\n\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('lerData e lerValor', () => {
  it.each([
    ['03/11/2026', '2026-11-03'],
    ['3/11/26', '2026-11-03'],
    ['2026-11-03', '2026-11-03'],
    ['2026-11-03T10:00:00', '2026-11-03'],
    ['31/02/2026', null],
    ['ontem', null],
  ])('lerData("%s") = %p', (texto, data) => {
    expect(lerData(texto)).toBe(data);
  });

  it.each([
    ['1.234,56', 123456],
    ['-12,50', -1250],
    ['1234.56', 123456],
    ['R$ 12,00', 1200],
    ['(12,50)', -1250],
    ['- R$ 1.250,00', -125000],
    ['12,50-', -1250],
    ['4.250,00', 425000],
    ['1.234', 123400],
    ['100', 10000],
    ['abc', null],
    ['', null],
  ])('lerValor("%s") = %p', (texto, valor) => {
    expect(lerValor(texto)).toBe(valor);
  });
});

describe('detectarFormato', () => {
  it('reconhece o Nubank conta e cartão', () => {
    expect(detectarFormato(lerCsv(NUBANK_CONTA)[0])).toEqual({
      formato: 'nubank-conta',
      mapeamento: {data: 0, valor: 1, identificador: 2, descricao: 3},
      cartao: false,
    });
    expect(detectarFormato(lerCsv(NUBANK_CARTAO)[0])).toMatchObject({
      formato: 'nubank-cartao',
      cartao: true,
    });
  });

  it('acha colunas genéricas pelo nome, sem acento', () => {
    expect(detectarFormato(lerCsv(GENERICO_PONTO_E_VIRGULA)[0])).toEqual({
      formato: 'csv',
      mapeamento: {data: 0, descricao: 1, valor: 2, identificador: null},
      cartao: false,
    });
  });

  it('coluna desconhecida devolve null', () => {
    expect(detectarFormato(lerCsv(COLUNAS_DESCONHECIDAS)[0])).toBeNull();
  });
});

describe('linhasDoCsv', () => {
  const ler = (texto: string) => {
    const tabela = lerCsv(texto);
    const {mapeamento, cartao} = detectarFormato(tabela[0])!;
    return linhasDoCsv(tabela, mapeamento, {cartao});
  };

  it('Nubank conta usa o Identificador', () => {
    const {linhas, erros} = ler(NUBANK_CONTA);
    expect(erros).toEqual([]);
    expect(linhas[0]).toEqual({
      data: '2026-11-03',
      descricao: 'Compra no débito - Supermercado Bom Preço',
      valorCentavos: -8990,
      idExterno: 'csv:6720f0c1-aaaa-4bbb-8ccc-000000000001',
    });
    expect(linhas[1].valorCentavos).toBe(425000);
  });

  it('Nubank cartão inverte o sinal: compra sai, pagamento entra', () => {
    const {linhas} = ler(NUBANK_CARTAO);
    expect(linhas.map(l => [l.descricao, l.valorCentavos])).toEqual([
      ['Ifood *Restaurante', -4590],
      ['Uber *Trip', -1820],
      ['Pagamento recebido', 50000],
    ]);
  });

  it('genérico com ; e "4.250,00"', () => {
    const {linhas} = ler(GENERICO_PONTO_E_VIRGULA);
    expect(linhas.map(l => l.valorCentavos)).toEqual([425000, -1250, -10000]);
    expect(linhas[1].descricao).toBe('PADARIA; CAFE DA MANHA');
  });

  it('linha com data ou valor inválido vira erro dela e valor 0 é ignorado', () => {
    const {linhas, erros} = ler(COM_LINHA_INVALIDA);
    expect(linhas.map(l => l.descricao)).toEqual(['Mercado', 'Farmácia']);
    expect(erros).toEqual([
      {linha: 3, motivo: 'data inválida'},
      {linha: 4, motivo: 'valor inválido'},
    ]);
  });

  it('duas linhas idênticas continuam sendo duas, com ids diferentes e estáveis', () => {
    const {linhas} = ler(LINHAS_IDENTICAS);
    expect(linhas).toHaveLength(2);
    expect(linhas[0].idExterno).not.toBe(linhas[1].idExterno);
    expect(ler(LINHAS_IDENTICAS).linhas.map(l => l.idExterno)).toEqual(
      linhas.map(l => l.idExterno),
    );
  });

  it('descrição vazia recebe um texto padrão e longa é cortada em 80', () => {
    const tabela = [
      ['Data', 'Descrição', 'Valor'],
      ['01/11/2026', '   ', '-1,00'],
      ['01/11/2026', 'x'.repeat(120), '-2,00'],
    ];
    const {linhas} = linhasDoCsv(
      tabela,
      {data: 0, descricao: 1, valor: 2, identificador: null},
      {cartao: false},
    );
    expect(linhas[0].descricao).toBe('Lançamento importado');
    expect(linhas[1].descricao).toHaveLength(80);
  });
});

describe('prepararImportacao', () => {
  const linha = (dados: Partial<LinhaExtrato>): LinhaExtrato => ({
    data: '2026-11-03',
    descricao: 'Mercado',
    valorCentavos: -8990,
    idExterno: 'csv:1',
    ...dados,
  });

  const existente = (dados: Partial<Transacao>): Transacao => ({
    id: 1,
    tipo: 'despesa',
    descricao: 'Mercado',
    valorCentavos: 8990,
    data: '2026-11-03',
    categoria: 'alimentacao',
    recorrencia: 'variavel',
    comprovanteUri: null,
    contaRecorrenteId: null,
    idExterno: null,
    sincronizado: false,
    ...dados,
  });

  const sugeridor = {
    preparar: jest.fn(async () => {}),
    sugerir: (texto: string) =>
      /mercado/i.test(texto)
        ? {categoria: 'alimentacao', confianca: 0.9}
        : null,
  };

  const repositorio = (ids: string[] = [], noPeriodo: Transacao[] = []) => ({
    idsExternosExistentes: jest.fn(async () => new Set(ids)),
    listarPorPeriodo: jest.fn(async () => noPeriodo),
  });

  it('nova despesa recebe a categoria sugerida e vem marcada', async () => {
    const [item] = await prepararImportacao(
      [linha({})],
      sugeridor,
      repositorio(),
    );
    expect(item).toEqual({
      linha: linha({}),
      tipo: 'despesa',
      valorCentavos: 8990,
      categoria: 'alimentacao',
      sugerida: true,
      situacao: 'nova',
      selecionado: true,
    });
    expect(sugeridor.preparar).toHaveBeenCalled();
  });

  it('sem sugestão vai para "outros"; receita é sempre "outros"', async () => {
    const itens = await prepararImportacao(
      [
        linha({descricao: 'xyz', idExterno: 'a'}),
        linha({
          descricao: 'Mercado reembolso',
          valorCentavos: 500,
          idExterno: 'b',
        }),
      ],
      sugeridor,
      repositorio(),
    );
    expect(itens.map(i => [i.tipo, i.categoria, i.sugerida])).toEqual([
      ['despesa', 'outros', false],
      ['receita', 'outros', false],
    ]);
  });

  it('id externo que já existe vira "já importada" e vem desmarcado', async () => {
    const [item] = await prepararImportacao(
      [linha({})],
      sugeridor,
      repositorio(['csv:1']),
    );
    expect(item).toMatchObject({situacao: 'ja-importada', selecionado: false});
  });

  it('mesma despesa lançada à mão vira "possível duplicata", uma por lançamento', async () => {
    const repo = repositorio([], [existente({})]);
    const itens = await prepararImportacao(
      [linha({idExterno: 'a'}), linha({idExterno: 'b'})],
      sugeridor,
      repo,
    );
    expect(itens.map(i => i.situacao)).toEqual(['possivel-duplicata', 'nova']);
    expect(itens[0].selecionado).toBe(false);
    expect(repo.listarPorPeriodo).toHaveBeenCalledWith({
      de: '2026-11-03',
      ate: '2026-11-03',
      tipo: 'despesa',
      categoria: null,
    });
  });

  it('o que já casou pelo id externo não conta como duplicata de outra linha', async () => {
    const itens = await prepararImportacao(
      [linha({idExterno: 'a'}), linha({idExterno: 'b'})],
      sugeridor,
      repositorio(['a'], [existente({idExterno: 'a'})]),
    );
    expect(itens.map(i => i.situacao)).toEqual(['ja-importada', 'nova']);
  });

  it('outra categoria ou outro dia não é duplicata (regra da US 1.5)', async () => {
    const itens = await prepararImportacao(
      [linha({idExterno: 'a'}), linha({idExterno: 'b', data: '2026-11-04'})],
      sugeridor,
      repositorio([], [existente({categoria: 'lazer'})]),
    );
    expect(itens.map(i => i.situacao)).toEqual(['nova', 'nova']);
  });

  it('recusa mais de 2.000 linhas', async () => {
    const muitas = Array.from({length: 2001}, (_, i) =>
      linha({idExterno: `x${i}`}),
    );
    await expect(
      prepararImportacao(muitas, sugeridor, repositorio()),
    ).rejects.toThrow(ERRO_MUITAS_LINHAS);
  });
});
