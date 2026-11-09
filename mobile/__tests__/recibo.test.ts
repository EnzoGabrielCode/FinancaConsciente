import {describe, expect, it, jest} from '@jest/globals';
import TextRecognition from '@react-native-ml-kit/text-recognition';

import {MlKitReconhecedor} from '../src/data/servicos/MlKitReconhecedor';
import {LerRecibo} from '../src/domain/casosDeUso/LerRecibo';
import {
  agruparEmLinhas,
  extrairDadosRecibo,
  extrairData,
  extrairEstabelecimento,
  extrairValor,
  lerValores,
} from '../src/domain/recibo';
import {
  DATAS_INVALIDAS,
  HOJE,
  NFCE_SUPERMERCADO,
  OCR_COM_ESPACO,
  OCR_SEM_ESPACO,
  SEM_ROTULO_DE_TOTAL,
  TOTAL_NA_LINHA_DE_BAIXO,
  trechos,
  VIA_CARTAO,
} from './fixtures/recibos';

describe('extrairDadosRecibo', () => {
  it('a) NFC-e de supermercado', () => {
    expect(extrairDadosRecibo(NFCE_SUPERMERCADO, HOJE)).toEqual({
      valorCentavos: 8990,
      data: '2026-11-03',
      estabelecimento: 'Supermercado Bom Preco Ltda',
    });
  });

  it('b) via de cartão', () => {
    expect(extrairDadosRecibo(VIA_CARTAO, HOJE)).toEqual({
      valorCentavos: 125000,
      data: '2026-11-05',
      estabelecimento: 'Restaurante Sabor Da Terra',
    });
  });

  it('c) valor na linha abaixo do rótulo', () => {
    expect(extrairDadosRecibo(TOTAL_NA_LINHA_DE_BAIXO, HOJE)).toEqual({
      valorCentavos: 4500,
      data: '2026-11-01',
      estabelecimento: 'Mercadinho Sao Jose',
    });
  });

  it('d) "89, 90" e "R$89,90" do OCR', () => {
    expect(extrairDadosRecibo(OCR_COM_ESPACO, HOJE).valorCentavos).toBe(8990);
    expect(extrairDadosRecibo(OCR_SEM_ESPACO, HOJE).valorCentavos).toBe(8990);
  });

  it('e) sem rótulo de total o valor fica null', () => {
    expect(extrairDadosRecibo(SEM_ROTULO_DE_TOTAL, HOJE)).toEqual({
      valorCentavos: null,
      data: null,
      estabelecimento: 'Banca Do Ze',
    });
  });

  it('f) data futura, inexistente, antiga e de CNPJ ficam null', () => {
    expect(extrairDadosRecibo(DATAS_INVALIDAS, HOJE)).toMatchObject({
      valorCentavos: 1000,
      data: null,
    });
  });

  it('g) texto vazio deixa tudo null', () => {
    expect(extrairDadosRecibo([], HOJE)).toEqual({
      valorCentavos: null,
      data: null,
      estabelecimento: null,
    });
  });
});

describe('agruparEmLinhas', () => {
  it('une colunas na mesma altura, da esquerda para a direita', () => {
    expect(
      agruparEmLinhas(
        trechos([
          ['89,90', 323, 450],
          ['VALOR TOTAL R$', 320, 10],
        ]),
      ),
    ).toEqual(['VALOR TOTAL R$ 89,90']);
  });

  it('não mistura linhas diferentes e ordena de cima para baixo', () => {
    expect(
      agruparEmLinhas(
        trechos([
          ['TROCO', 380],
          ['10,10', 380, 450],
          ['DINHEIRO', 350],
          ['100,00', 352, 450],
        ]),
      ),
    ).toEqual(['DINHEIRO 100,00', 'TROCO 10,10']);
  });

  it('compara com o início da linha: uma foto torta não vira uma linha só', () => {
    const linhas = agruparEmLinhas(
      trechos([
        ['A', 0],
        ['B', 8, 100],
        ['C', 16, 200],
        ['D', 24, 300],
      ]),
    );
    expect(linhas.length).toBeGreaterThan(1);
  });

  it('ignora trechos vazios', () => {
    expect(
      agruparEmLinhas(
        trechos([
          ['  ', 10],
          ['TOTAL', 40],
        ]),
      ),
    ).toEqual(['TOTAL']);
  });
});

describe('lerValores', () => {
  it.each([
    ['TOTAL 1.250,00', [125000]],
    ['TOTAL 89,90', [8990]],
    ['TOTAL R$89,90', [8990]],
    ['TOTAL 89, 90', [8990]],
    ['TOTAL 89 ,90', [8990]],
    ['TOTAL 89.90', [8990]],
    ['TOTAL 1250,00', [125000]],
    ['2 UN X 18,90 37,80', [1890, 3780]],
    ['TOTAL', []],
  ])('lê "%s"', (linha, valores) => {
    expect(lerValores(linha)).toEqual(valores);
  });

  it('não confunde data com valor', () => {
    expect(lerValores('EMITIDO 05.11.2026')).toEqual([]);
    expect(lerValores('05/11/26 12:31')).toEqual([]);
  });

  it('com vírgula na linha, o ponto é de milhar', () => {
    expect(lerValores('VALOR 1.250,00')).toEqual([125000]);
  });
});

describe('extrairValor', () => {
  it('prefere VALOR TOTAL a TOTAL e pega o último valor da linha', () => {
    expect(
      extrairValor(['TOTAL 10,00', 'VALOR TOTAL 5,00 89,90', 'TOTAL 1,00']),
    ).toBe(8990);
  });

  it('ignora SUBTOTAL, DESCONTO, DINHEIRO, TROCO e tributos', () => {
    expect(
      extrairValor([
        'SUBTOTAL 91,53',
        'DESCONTO 1,63',
        'VALOR RECEBIDO 100,00',
        'DINHEIRO 100,00',
        'TROCO 10,10',
        'VALOR APROX. TRIBUTOS 23,10',
      ]),
    ).toBeNull();
  });

  it('acentos e caixa não importam', () => {
    expect(extrairValor(['Valor Total: R$ 12,00'])).toBe(1200);
    expect(extrairValor(['Total à pagar 12,00'])).toBe(1200);
  });

  it('valor zero ou acima do limite vira null', () => {
    expect(extrairValor(['TOTAL 0,00'])).toBeNull();
    expect(extrairValor(['TOTAL 100.000.000,00'])).toBeNull();
    expect(extrairValor(['TOTAL 99.999.999,99'])).toBe(9_999_999_999);
  });

  it('rótulo sem número na linha nem abaixo continua procurando', () => {
    expect(extrairValor(['VALOR TOTAL', 'OBRIGADO', 'TOTAL 7,00'])).toBe(700);
  });
});

describe('extrairData', () => {
  it.each([
    ['03/11/2026', '2026-11-03'],
    ['03/11/26', '2026-11-03'],
    ['03-11-2026', '2026-11-03'],
    ['03.11.2026', '2026-11-03'],
    ['3/11/2026', '2026-11-03'],
  ])('lê %s', (texto, data) => {
    expect(extrairData([texto], HOJE)).toBe(data);
  });

  it('prefere a linha de DATA, EMISSÃO ou EMITIDO', () => {
    expect(extrairData(['PEDIDO 02/11/2026', 'EMISSÃO 03/11/2026'], HOJE)).toBe(
      '2026-11-03',
    );
    expect(extrairData(['PEDIDO 02/11/2026', 'OUTRA 01/11/2026'], HOJE)).toBe(
      '2026-11-02',
    );
  });

  it('aceita hoje e até 1 ano atrás', () => {
    expect(extrairData(['08/11/2026'], HOJE)).toBe('2026-11-08');
    expect(extrairData(['08/11/2025'], HOJE)).toBe('2025-11-08');
    expect(extrairData(['07/11/2025'], HOJE)).toBeNull();
  });

  it('recusa futuro, data inexistente e separadores misturados', () => {
    expect(extrairData(['09/11/2026'], HOJE)).toBeNull();
    expect(extrairData(['31/02/2026'], HOJE)).toBeNull();
    expect(extrairData(['03/11.2026'], HOJE)).toBeNull();
  });

  it('não lê data dentro de CNPJ nem de CPF', () => {
    expect(extrairData(['CNPJ: 03.11.2026/0001-26'], HOJE)).toBeNull();
    expect(extrairData(['12.345.678/0001-90'], HOJE)).toBeNull();
    expect(extrairData(['123.456.789-09'], HOJE)).toBeNull();
  });
});

describe('extrairEstabelecimento', () => {
  it('pula as linhas de documento e usa Title Case', () => {
    expect(
      extrairEstabelecimento([
        'DOCUMENTO AUXILIAR DA NFC-E',
        'CNPJ 12.345.678/0001-90',
        'PADARIA PÃO QUENTE',
      ]),
    ).toBe('Padaria Pão Quente');
  });

  it('só olha as 3 primeiras linhas e exige 3 letras', () => {
    expect(
      extrairEstabelecimento(['12', 'VIA CLIENTE', 'CUPOM FISCAL', 'LOJA']),
    ).toBeNull();
  });

  it('corta em 40 caracteres', () => {
    const nome = extrairEstabelecimento([
      'COMERCIO DE ALIMENTOS E BEBIDAS DO BAIRRO NOVO LTDA',
    ]);
    expect(nome).toBe('Comercio De Alimentos E Bebidas Do Bairr');
    expect(nome).toHaveLength(40);
  });

  it('ignora crédito e débito', () => {
    expect(extrairEstabelecimento(['CRÉDITO', 'DÉBITO', 'BAR DO JOÃO'])).toBe(
      'Bar Do João',
    );
  });
});

describe('LerRecibo', () => {
  it('extrai os dados do que o reconhecedor devolveu', async () => {
    const lerRecibo = new LerRecibo({reconhecer: async () => VIA_CARTAO});
    await expect(lerRecibo.ler('file:///foto.jpg', HOJE)).resolves.toEqual({
      valorCentavos: 125000,
      data: '2026-11-05',
      estabelecimento: 'Restaurante Sabor Da Terra',
    });
  });

  it('erro do reconhecedor vira null', async () => {
    const lerRecibo = new LerRecibo({
      reconhecer: async () => {
        throw new Error('ML Kit indisponível');
      },
    });
    await expect(lerRecibo.ler('file:///foto.jpg', HOJE)).resolves.toBeNull();
  });
});

describe('MlKitReconhecedor', () => {
  const reconhecer = TextRecognition.recognize as unknown as jest.Mock<
    (uri: string) => Promise<unknown>
  >;
  const quadro = (top: number, left: number, height = 20) => ({
    top,
    left,
    height,
    width: 100,
  });

  it('achata blocos e linhas usando a posição de cada linha', async () => {
    reconhecer.mockResolvedValueOnce({
      text: '',
      blocks: [
        {
          text: '',
          frame: quadro(300, 10, 60),
          recognizedLanguages: [],
          lines: [
            {text: 'VALOR TOTAL R$', frame: quadro(320, 10), elements: []},
            {text: 'DINHEIRO', frame: quadro(350, 10), elements: []},
          ],
        },
        {
          text: '',
          frame: quadro(320, 450),
          recognizedLanguages: [],
          lines: [{text: '89,90', frame: quadro(322, 450), elements: []}],
        },
      ],
    });

    const resultado = await new MlKitReconhecedor().reconhecer('file:///a.jpg');

    expect(reconhecer).toHaveBeenCalledWith('file:///a.jpg');
    expect(resultado).toEqual([
      {texto: 'VALOR TOTAL R$', topo: 320, altura: 20, esquerda: 10},
      {texto: 'DINHEIRO', topo: 350, altura: 20, esquerda: 10},
      {texto: '89,90', topo: 322, altura: 20, esquerda: 450},
    ]);
    expect(agruparEmLinhas(resultado)).toEqual([
      'VALOR TOTAL R$ 89,90',
      'DINHEIRO',
    ]);
  });

  it('linha sem posição usa a do bloco, sem juntar as linhas do bloco', async () => {
    reconhecer.mockResolvedValueOnce({
      text: '',
      blocks: [
        {
          text: '',
          frame: quadro(100, 10, 40),
          recognizedLanguages: [],
          lines: [
            {text: 'SUBTOTAL 91,53', elements: []},
            {text: 'TOTAL 89,90', elements: []},
          ],
        },
      ],
    });

    const resultado = await new MlKitReconhecedor().reconhecer('file:///a.jpg');

    expect(resultado).toEqual([
      {texto: 'SUBTOTAL 91,53', topo: 100, altura: 20, esquerda: 10},
      {texto: 'TOTAL 89,90', topo: 120, altura: 20, esquerda: 10},
    ]);
    expect(extrairValor(agruparEmLinhas(resultado))).toBe(8990);
  });

  it('bloco sem posição mantém a ordem dos blocos', async () => {
    reconhecer.mockResolvedValueOnce({
      text: '',
      blocks: [
        {text: '', recognizedLanguages: [], lines: [{text: 'A', elements: []}]},
        {text: '', recognizedLanguages: [], lines: [{text: 'B', elements: []}]},
      ],
    });

    const resultado = await new MlKitReconhecedor().reconhecer('file:///a.jpg');

    expect(agruparEmLinhas(resultado)).toEqual(['A', 'B']);
  });
});
