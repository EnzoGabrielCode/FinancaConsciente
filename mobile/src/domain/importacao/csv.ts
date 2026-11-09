import {dataISOValida} from '../datas';
import {normalizar} from '../texto';
import {
  centavosDeDecimal,
  DESCRICAO_PADRAO,
  hashTexto,
  limparDescricao,
  type ErroDeLinha,
  type LinhaExtrato,
} from './linhaExtrato';

export type FormatoCsv = 'nubank-conta' | 'nubank-cartao' | 'csv';

export interface MapeamentoColunas {
  data: number;
  descricao: number;
  valor: number;
  identificador: number | null;
}

export interface FormatoDetectado {
  formato: FormatoCsv;
  mapeamento: MapeamentoColunas;
  cartao: boolean;
}

const SEPARADORES = [';', ',', '\t'];

function contarForaDeAspas(linha: string, separador: string): number {
  let dentro = false;
  let total = 0;
  for (const caractere of linha) {
    if (caractere === '"') {
      dentro = !dentro;
    } else if (caractere === separador && !dentro) {
      total++;
    }
  }
  return total;
}

export function lerCsv(texto: string): string[][] {
  const conteudo = texto.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const primeira = conteudo.split('\n', 1)[0] ?? '';
  // Empate fica com a ordem: ";" é o padrão dos bancos brasileiros.
  const separador = SEPARADORES.reduce((melhor, candidato) =>
    contarForaDeAspas(primeira, candidato) > contarForaDeAspas(primeira, melhor)
      ? candidato
      : melhor,
  );

  const tabela: string[][] = [];
  let linha: string[] = [];
  let celula = '';
  let dentro = false;
  for (let i = 0; i < conteudo.length; i++) {
    const caractere = conteudo[i];
    if (dentro) {
      if (caractere === '"' && conteudo[i + 1] === '"') {
        celula += '"';
        i++;
      } else if (caractere === '"') {
        dentro = false;
      } else {
        celula += caractere;
      }
    } else if (caractere === '"' && celula === '') {
      // Aspas só abrem citação no começo do campo: PIX "JOAO" fica como está.
      dentro = true;
    } else if (caractere === separador) {
      linha.push(celula);
      celula = '';
    } else if (caractere === '\n') {
      linha.push(celula);
      tabela.push(linha);
      linha = [];
      celula = '';
    } else {
      celula += caractere;
    }
  }
  if (celula !== '' || linha.length > 0) {
    linha.push(celula);
    tabela.push(linha);
  }
  return tabela.filter(l => l.some(c => c.trim() !== ''));
}

const SINONIMOS: Record<keyof MapeamentoColunas, string[]> = {
  data: ['data', 'date', 'dt'],
  descricao: [
    'descricao',
    'historico',
    'title',
    'memo',
    'lancamento',
    'estabelecimento',
  ],
  valor: ['valor', 'amount', 'value', 'quantia'],
  identificador: ['identificador', 'id'],
};

// "Data Lançamento" é data, "Valor (R$)" é valor: vale a primeira palavra.
function papelDaColuna(nome: string): keyof MapeamentoColunas | null {
  const normalizado = normalizar(nome);
  const primeira = normalizado.split(' ')[0];
  for (const papel of Object.keys(SINONIMOS) as (keyof MapeamentoColunas)[]) {
    if (
      SINONIMOS[papel].includes(normalizado) ||
      SINONIMOS[papel].includes(primeira)
    ) {
      return papel;
    }
  }
  return null;
}

export function detectarFormato(cabecalho: string[]): FormatoDetectado | null {
  const nomes = cabecalho.map(nome => normalizar(nome));
  const igual = (esperado: string[]) =>
    nomes.length === esperado.length &&
    esperado.every((nome, i) => nomes[i] === nome);

  if (igual(['data', 'valor', 'identificador', 'descricao'])) {
    return {
      formato: 'nubank-conta',
      mapeamento: {data: 0, valor: 1, identificador: 2, descricao: 3},
      cartao: false,
    };
  }
  if (igual(['date', 'title', 'amount'])) {
    return {
      formato: 'nubank-cartao',
      mapeamento: {data: 0, descricao: 1, valor: 2, identificador: null},
      cartao: true,
    };
  }

  const encontrado: Partial<MapeamentoColunas> = {};
  cabecalho.forEach((nome, indice) => {
    const papel = papelDaColuna(nome);
    if (papel && encontrado[papel] === undefined) {
      encontrado[papel] = indice;
    }
  });
  const {data, descricao, valor, identificador} = encontrado;
  if (data === undefined || descricao === undefined || valor === undefined) {
    return null;
  }
  return {
    formato: 'csv',
    mapeamento: {data, descricao, valor, identificador: identificador ?? null},
    cartao: false,
  };
}

export function lerData(texto: string): string | null {
  const limpo = texto.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(limpo);
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/.exec(limpo);
  let data: string | null = null;
  if (iso) {
    data = `${iso[1]}-${iso[2]}-${iso[3]}`;
  } else if (br) {
    const ano = br[3].length === 2 ? `20${br[3]}` : br[3];
    data = `${ano}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }
  return data && dataISOValida(data) ? data : null;
}

export function lerValor(texto: string): number | null {
  let limpo = texto.replace(/R\$/gi, '').replace(/\s/g, '');
  let negativo = false;
  if (/^\(.*\)$/.test(limpo)) {
    negativo = true;
    limpo = limpo.slice(1, -1);
  }
  if (/^[+-]/.test(limpo)) {
    negativo = negativo !== (limpo[0] === '-');
    limpo = limpo.slice(1);
  } else if (/-$/.test(limpo)) {
    negativo = !negativo;
    limpo = limpo.slice(0, -1);
  }
  if (!/^[\d.,]+$/.test(limpo) || !/\d/.test(limpo)) {
    return null;
  }
  // O último separador com 1 ou 2 dígitos depois é o decimal; os outros são milhar.
  const decimal = /[.,](\d{1,2})$/.exec(limpo);
  const parteInteira = decimal ? limpo.slice(0, decimal.index) : limpo;
  // Milhar só em grupos de 3 e com um separador só: "1.2.3" não é valor.
  if (!/^(\d*|\d{1,3}(\.\d{3})+|\d{1,3}(,\d{3})+)$/.test(parteInteira)) {
    return null;
  }
  return centavosDeDecimal(
    negativo,
    parteInteira.replace(/[.,]/g, ''),
    decimal ? decimal[1] : '',
  );
}

export interface ResultadoCsv {
  linhas: LinhaExtrato[];
  erros: ErroDeLinha[];
}

export function linhasDoCsv(
  tabela: string[][],
  mapeamento: MapeamentoColunas,
  {cartao}: {cartao: boolean},
): ResultadoCsv {
  const linhas: LinhaExtrato[] = [];
  const erros: ErroDeLinha[] = [];
  const ocorrencias = new Map<string, number>();

  tabela.slice(1).forEach((celulas, indice) => {
    const numero = indice + 2; // 1 é o cabeçalho
    const data = lerData(celulas[mapeamento.data] ?? '');
    const valor = lerValor(celulas[mapeamento.valor] ?? '');
    if (data === null) {
      erros.push({linha: numero, motivo: 'data inválida'});
      return;
    }
    if (valor === null) {
      erros.push({linha: numero, motivo: 'valor inválido'});
      return;
    }
    if (valor === 0) {
      return;
    }
    // Na fatura, compra vem positiva: vira saída. Estorno e pagamento, entrada.
    const valorCentavos = cartao ? -valor : valor;
    const descricao =
      limparDescricao(celulas[mapeamento.descricao] ?? '') || DESCRICAO_PADRAO;
    const identificador =
      mapeamento.identificador === null
        ? ''
        : (celulas[mapeamento.identificador] ?? '').trim();
    let idExterno: string;
    if (identificador) {
      idExterno = `csv:${identificador}`;
    } else {
      // Duas compras iguais no mesmo dia continuam sendo duas.
      const chave = `${data}|${valorCentavos}|${descricao}`;
      const vez = (ocorrencias.get(chave) ?? 0) + 1;
      ocorrencias.set(chave, vez);
      idExterno = `csv:h${hashTexto(`${chave}|${vez}`)}`;
    }
    linhas.push({data, descricao, valorCentavos, idExterno});
  });
  return {linhas, erros};
}
