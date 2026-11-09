import {CATEGORIAS_DESPESA} from './categorias';
import {DICIONARIO_INICIAL} from './dicionarioCategorias';
import {tokenizar} from './texto';

export interface Exemplo {
  texto: string;
  categoria: string;
  peso: number;
}

export interface Sugestao {
  categoria: string;
  confianca: number;
}

export interface Modelo {
  categorias: string[];
  contagemPalavras: Map<string, Map<string, number>>;
  totalPalavras: Map<string, number>;
  documentos: Map<string, number>;
  vocabulario: Set<string>;
}

export const PESO_DICIONARIO = 1;
export const PESO_HISTORICO = 3;
export const CONFIANCA_MINIMA = 0.6;
// Suavização de Lidstone (Laplace com alfa < 1). Com alfa = 1, cada termo do
// dicionário pesa 1 e a suavização domina: uma palavra conhecida dá só ~0,33 de
// confiança entre 5 categorias e nada passa de CONFIANCA_MINIMA.
export const ALFA = 0.1;

// 'outros' não é sugerido: é o que sobra quando nada se encaixa.
const SUGERIVEIS = new Set(
  CATEGORIAS_DESPESA.map(c => c.id).filter(id => id !== 'outros'),
);

const somar = <K>(mapa: Map<K, number>, chave: K, valor: number) =>
  mapa.set(chave, (mapa.get(chave) ?? 0) + valor);

export function treinar(exemplos: Exemplo[]): Modelo {
  const modelo: Modelo = {
    categorias: [],
    contagemPalavras: new Map(),
    totalPalavras: new Map(),
    documentos: new Map(),
    vocabulario: new Set(),
  };
  for (const {texto, categoria, peso} of exemplos) {
    const palavras = tokenizar(texto);
    if (!SUGERIVEIS.has(categoria) || palavras.length === 0 || peso <= 0) {
      continue;
    }
    if (!modelo.documentos.has(categoria)) {
      modelo.categorias.push(categoria);
      modelo.contagemPalavras.set(categoria, new Map());
    }
    somar(modelo.documentos, categoria, peso);
    const contagem = modelo.contagemPalavras.get(categoria)!;
    for (const palavra of palavras) {
      somar(contagem, palavra, peso);
      somar(modelo.totalPalavras, categoria, peso);
      modelo.vocabulario.add(palavra);
    }
  }
  return modelo;
}

export function sugerir(modelo: Modelo, texto: string): Sugestao | null {
  const palavras = tokenizar(texto).filter(p => modelo.vocabulario.has(p));
  if (palavras.length === 0 || modelo.categorias.length === 0) {
    return null;
  }
  const totalDocumentos = modelo.categorias.reduce(
    (soma, c) => soma + (modelo.documentos.get(c) ?? 0),
    0,
  );
  const tamanhoVocabulario = modelo.vocabulario.size;
  const pontuacoes = modelo.categorias.map(categoria => {
    const contagem = modelo.contagemPalavras.get(categoria)!;
    const denominador =
      (modelo.totalPalavras.get(categoria) ?? 0) + ALFA * tamanhoVocabulario;
    return palavras.reduce(
      (soma, palavra) =>
        soma + Math.log(((contagem.get(palavra) ?? 0) + ALFA) / denominador),
      Math.log((modelo.documentos.get(categoria) ?? 0) / totalDocumentos),
    );
  });
  // Softmax estável: subtrair o maior evita exp() de números muito negativos.
  const maior = Math.max(...pontuacoes);
  const exponenciais = pontuacoes.map(p => Math.exp(p - maior));
  const soma = exponenciais.reduce((total, e) => total + e, 0);
  const melhor = exponenciais.indexOf(Math.max(...exponenciais));
  const confianca = exponenciais[melhor] / soma;
  return confianca >= CONFIANCA_MINIMA
    ? {categoria: modelo.categorias[melhor], confianca}
    : null;
}

export function exemplosDoDicionario(): Exemplo[] {
  return Object.entries(DICIONARIO_INICIAL).flatMap(([categoria, termos]) =>
    termos.map(texto => ({texto, categoria, peso: PESO_DICIONARIO})),
  );
}
