const STOPWORDS = new Set([
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'o',
  'a',
  'os',
  'as',
  'em',
  'no',
  'na',
  'pra',
  'para',
  'com',
  'por',
  'um',
  'uma',
  'r',
]);

// "99" é o app de transporte; os outros números não ajudam a classificar.
const NUMEROS_COM_SENTIDO = new Set(['99']);

const SEM_ACENTO: Record<string, string> = {
  á: 'a',
  à: 'a',
  â: 'a',
  ã: 'a',
  ä: 'a',
  é: 'e',
  è: 'e',
  ê: 'e',
  ë: 'e',
  í: 'i',
  ì: 'i',
  î: 'i',
  ï: 'i',
  ó: 'o',
  ò: 'o',
  ô: 'o',
  õ: 'o',
  ö: 'o',
  ú: 'u',
  ù: 'u',
  û: 'u',
  ü: 'u',
  ç: 'c',
  ñ: 'n',
};

// Criada em tempo de execução: um literal com \p{} que o motor não aceite
// quebraria o módulo inteiro na carga.
function criarRegexDiacriticos(): RegExp {
  try {
    return new RegExp('\\p{Diacritic}', 'gu');
  } catch {
    return /[̀-ͯ]/g;
  }
}

const DIACRITICOS = criarRegexDiacriticos();

function semDiacriticos(texto: string): string {
  try {
    return texto.normalize('NFD').replace(DIACRITICOS, '');
  } catch {
    return texto;
  }
}

export function normalizar(texto: string): string {
  // A tabela cobre o português mesmo sem normalize() no motor JS do aparelho.
  const minusculo = texto
    .toLowerCase()
    .replace(/[áàâãäéèêëíìîïóòôõöúùûüçñ]/g, letra => SEM_ACENTO[letra]);
  return semDiacriticos(minusculo)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokenizar(texto: string): string[] {
  return normalizar(texto)
    .split(' ')
    .filter(
      palavra =>
        palavra.length >= 2 &&
        !STOPWORDS.has(palavra) &&
        (!/^\d+$/.test(palavra) || NUMEROS_COM_SENTIDO.has(palavra)),
    );
}
