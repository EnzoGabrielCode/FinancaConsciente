import {dataISOValida} from './datas';
import type {DadosRecibo} from './entities/Recibo';
import type {TrechoReconhecido} from './repositories/ReconhecedorTexto';

export const MAX_VALOR_RECIBO_CENTAVOS = 9_999_999_999;
export const MAX_ESTABELECIMENTO = 40;

const ROTULOS_TOTAL = [
  'VALOR TOTAL',
  'TOTAL A PAGAR',
  'VALOR A PAGAR',
  'VALOR PAGO',
  'TOTAL',
  'VALOR',
];

const IGNORAR_NO_TOTAL =
  /\b(SUBTOTAL|SUB TOTAL|DESCONTOS?|TROCO|DINHEIRO|RECEBIDO|TRIBUTOS|QTDE?|ITENS)\b|12\.?741/;

const NAO_E_ESTABELECIMENTO =
  /\b(CNPJ|CPF|CUPOM|NFC ?-? ?E|DOCUMENTO AUXILIAR|VIA (DO )?CLIENTE|CREDITO|DEBITO)\b/;

const ROTULO_DATA = /\b(DATA|EMISSAO|EMITIDO|EMITIDA)\b/;

const CNPJ = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;
const CPF = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;

const SEM_ACENTO: Record<string, string> = {
  Á: 'A',
  À: 'A',
  Â: 'A',
  Ã: 'A',
  Ä: 'A',
  É: 'E',
  È: 'E',
  Ê: 'E',
  Ë: 'E',
  Í: 'I',
  Ì: 'I',
  Î: 'I',
  Ï: 'I',
  Ó: 'O',
  Ò: 'O',
  Ô: 'O',
  Õ: 'O',
  Ö: 'O',
  Ú: 'U',
  Ù: 'U',
  Û: 'U',
  Ü: 'U',
  Ç: 'C',
};

// Sem acento e em maiúsculas: o OCR não é confiável com "Emissão" x "EMISSAO".
// Tabela em vez de normalize('NFD'), que depende do suporte a Unicode do motor.
export function normalizar(texto: string): string {
  return texto
    .toUpperCase()
    .replace(/[ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ]/g, letra => SEM_ACENTO[letra]);
}

const centro = ({topo, altura}: TrechoReconhecido) => topo + altura / 2;

export function agruparEmLinhas(trechos: TrechoReconhecido[]): string[] {
  const grupos: TrechoReconhecido[][] = [];
  const ordenados = [...trechos]
    .filter(trecho => trecho.texto.trim() !== '')
    .sort((a, b) => centro(a) - centro(b));
  for (const trecho of ordenados) {
    // Compara com o primeiro trecho do grupo, não com o último: senão uma foto
    // torta encadearia a página inteira numa linha só.
    const grupo = grupos.find(([base]) => {
      const tolerancia = Math.max(base.altura, trecho.altura) / 2;
      return Math.abs(centro(base) - centro(trecho)) < tolerancia;
    });
    if (grupo) {
      grupo.push(trecho);
    } else {
      grupos.push([trecho]);
    }
  }
  return grupos.map(grupo =>
    [...grupo]
      .sort((a, b) => a.esquerda - b.esquerda)
      .map(trecho => trecho.texto.trim())
      .join(' '),
  );
}

// Junta reais e centavos como texto e converte uma vez: nada de float.
function paraCentavos(inteiros: string, centavos: string): number | null {
  const digitos = `${inteiros.replace(/\./g, '')}${centavos}`;
  return digitos.length <= 15 ? Number(digitos) : null;
}

export function lerValores(linha: string): number[] {
  const valores: number[] = [];
  const comVirgula =
    /(^|[^\d.,])(\d{1,3}(?:\.\d{3})+|\d+)\s?,\s?(\d{2})(?!\d)/g;
  if (linha.includes(',')) {
    for (const [, , inteiros, centavos] of linha.matchAll(comVirgula)) {
      const valor = paraCentavos(inteiros, centavos);
      if (valor !== null) {
        valores.push(valor);
      }
    }
    return valores;
  }
  // "89.90" só vale sem vírgula na linha; o (?![.\d]) evita pegar datas.
  for (const [, , inteiros, centavos] of linha.matchAll(
    /(^|[^\d.])(\d+)\.(\d{2})(?![.\d])/g,
  )) {
    const valor = paraCentavos(inteiros, centavos);
    if (valor !== null) {
      valores.push(valor);
    }
  }
  return valores;
}

const temRotulo = (linha: string, rotulo: string) =>
  new RegExp(`\\b${rotulo}\\b`).test(linha);

export function extrairValor(linhas: string[]): number | null {
  const normalizadas = linhas.map(normalizar);
  for (const rotulo of ROTULOS_TOTAL) {
    for (let i = 0; i < normalizadas.length; i++) {
      const linha = normalizadas[i];
      if (!temRotulo(linha, rotulo) || IGNORAR_NO_TOTAL.test(linha)) {
        continue;
      }
      const naLinha = lerValores(linha);
      const valores =
        naLinha.length > 0 ? naLinha : lerValores(normalizadas[i + 1] ?? '');
      const valor = valores[valores.length - 1];
      if (valor !== undefined) {
        return valor > 0 && valor <= MAX_VALOR_RECIBO_CENTAVOS ? valor : null;
      }
    }
  }
  // Sem rótulo, o maior número costuma ser o dinheiro recebido: melhor não chutar.
  return null;
}

const doisDigitos = (texto: string) => texto.padStart(2, '0');

function datasDaLinha(linha: string, hoje: string): string[] {
  const umAnoAtras = `${Number(hoje.slice(0, 4)) - 1}${hoje.slice(4)}`;
  const semDocumentos = linha.replace(CNPJ, ' ').replace(CPF, ' ');
  const datas: string[] = [];
  for (const [, , dia, , mes, ano] of semDocumentos.matchAll(
    /(^|\D)(\d{1,2})([/.-])(\d{1,2})\3(\d{4}|\d{2})(?!\d)/g,
  )) {
    const data = `${ano.length === 2 ? `20${ano}` : ano}-${doisDigitos(
      mes,
    )}-${doisDigitos(dia)}`;
    if (dataISOValida(data) && data <= hoje && data >= umAnoAtras) {
      datas.push(data);
    }
  }
  return datas;
}

export function extrairData(linhas: string[], hoje: string): string | null {
  const candidatas = linhas
    .map(normalizar)
    // Na linha do CNPJ/CPF, um número cortado pelo OCR pode parecer uma data.
    .filter(linha => !/\b(CNPJ|CPF)\b/.test(linha))
    .flatMap(linha =>
      datasDaLinha(linha, hoje).map(data => ({
        data,
        rotulada: ROTULO_DATA.test(linha),
      })),
    );
  return candidatas.find(c => c.rotulada)?.data ?? candidatas[0]?.data ?? null;
}

function emTitleCase(texto: string): string {
  return texto
    .toLowerCase()
    .replace(
      /(^|\s)(\S)/g,
      (_, espaco: string, letra: string) => `${espaco}${letra.toUpperCase()}`,
    );
}

export function extrairEstabelecimento(linhas: string[]): string | null {
  const linha = linhas
    .slice(0, 3)
    .map(texto => texto.replace(/\s+/g, ' ').trim())
    .find(
      texto =>
        (normalizar(texto).match(/[A-Z]/g)?.length ?? 0) >= 3 &&
        !NAO_E_ESTABELECIMENTO.test(normalizar(texto)),
    );
  if (!linha) {
    return null;
  }
  return Array.from(emTitleCase(linha))
    .slice(0, MAX_ESTABELECIMENTO)
    .join('')
    .trim();
}

export function extrairDadosRecibo(
  trechos: TrechoReconhecido[],
  hoje: string,
): DadosRecibo {
  const linhas = agruparEmLinhas(trechos);
  return {
    valorCentavos: extrairValor(linhas),
    data: extrairData(linhas, hoje),
    estabelecimento: extrairEstabelecimento(linhas),
  };
}

export function reciboVazio({
  valorCentavos,
  data,
  estabelecimento,
}: DadosRecibo): boolean {
  return valorCentavos === null && data === null && estabelecimento === null;
}
