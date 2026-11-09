import type {TrechoReconhecido} from '../../src/domain/repositories/ReconhecedorTexto';

const ALTURA = 20;

// [texto, topo, esquerda]: imita a saída do ML Kit, uma linha por trecho.
type Linha = [string, number, number?];

export const trechos = (linhas: Linha[]): TrechoReconhecido[] =>
  linhas.map(([texto, topo, esquerda = 10]) => ({
    texto,
    topo,
    altura: ALTURA,
    esquerda,
  }));

export const HOJE = '2026-11-08';

// a) NFC-e de supermercado. O ML Kit põe as colunas em blocos diferentes:
// "VALOR TOTAL R$" à esquerda e "89,90" à direita, na mesma altura.
export const NFCE_SUPERMERCADO = trechos([
  ['SUPERMERCADO BOM PRECO LTDA', 10],
  ['CNPJ: 12.345.678/0001-90 IE: 123.456.789.110', 40],
  ['RUA DAS FLORES, 100 - CENTRO - SAO PAULO/SP', 70],
  ['DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRONICA', 100],
  ['001 ARROZ TIPO 1 5KG', 140],
  ['1 UN X 25,90', 140, 300],
  ['25,90', 141, 450],
  ['002 CAFE TORRADO 500G', 170],
  ['2 UN X 18,90', 170, 300],
  ['37,80', 169, 450],
  ['003 LEITE INTEGRAL 1L', 200],
  ['6 UN X 4,64', 200, 300],
  ['27,83', 201, 450],
  ['QTD. TOTAL DE ITENS', 230],
  ['3', 230, 450],
  ['SUBTOTAL', 260],
  ['91,53', 260, 450],
  ['DESCONTO', 290],
  ['1,63', 291, 450],
  ['VALOR TOTAL R$', 320],
  ['89,90', 323, 450],
  ['DINHEIRO', 350],
  ['100,00', 350, 450],
  ['TROCO', 380],
  ['10,10', 380, 450],
  ['Tributos Totais Incidentes (Lei Federal 12.741/2012) R$ 23,10', 410],
  ['Emissao: 03/11/2026 18:42:10', 440],
  ['CPF DO CONSUMIDOR: 123.456.789-09', 470],
]);

// b) Via do cliente de maquininha de cartão.
export const VIA_CARTAO = trechos([
  ['RESTAURANTE SABOR DA TERRA', 10],
  ['CNPJ 98.765.432/0001-10', 40],
  ['VIA CLIENTE', 70],
  ['CREDITO A VISTA', 100],
  ['05/11/26 12:31', 130],
  ['VALOR: R$ 1.250,00', 160],
  ['TRANSACAO APROVADA', 190],
]);

// c) Rótulo numa linha e o valor na de baixo.
export const TOTAL_NA_LINHA_DE_BAIXO = trechos([
  ['MERCADINHO SAO JOSE', 10],
  ['DATA 01/11/2026', 40],
  ['TOTAL', 70],
  ['45,00', 100],
  ['OBRIGADO PELA PREFERENCIA', 130],
]);

// d) Erros comuns do OCR no valor.
export const OCR_COM_ESPACO = trechos([
  ['PADARIA PAO QUENTE', 10],
  ['TOTAL R$ 89, 90', 40],
]);

export const OCR_SEM_ESPACO = trechos([
  ['FARMACIA SAUDE', 10],
  ['TOTAL R$89,90', 40],
]);

// e) Sem rótulo de total: o maior número (100,00) é o dinheiro entregue.
export const SEM_ROTULO_DE_TOTAL = trechos([
  ['BANCA DO ZE', 10],
  ['JORNAL 12,50', 40],
  ['REVISTA 25,00', 70],
  ['100,00', 100],
]);

// f) Datas que não servem.
export const DATAS_INVALIDAS = trechos([
  ['LOJA EXEMPLO', 10],
  ['CNPJ: 03.11.2026/0001-26', 40],
  ['VENCIMENTO 10/12/2026', 70],
  ['ENTREGA 31/02/2026', 100],
  ['CLIENTE DESDE 01/10/2025', 130],
  ['TOTAL 10,00', 160],
]);
