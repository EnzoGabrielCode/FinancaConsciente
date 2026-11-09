import {dataISOValida} from '../datas';
import {
  centavosDeDecimal,
  DESCRICAO_PADRAO,
  hashTexto,
  limparDescricao,
  type LinhaExtrato,
} from './linhaExtrato';

export const ERRO_NAO_OFX = 'Este arquivo não parece um extrato OFX.';

const ENTIDADES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

function semEntidades(texto: string): string {
  return texto.replace(/&(amp|lt|gt|quot|apos);/g, e => ENTIDADES[e]);
}

// Serve para SGML (OFX 1, <TAG>valor sem fechamento) e XML (OFX 2): o valor
// vai até o próximo "<" ou o fim da linha.
function campo(bloco: string, tag: string): string {
  const achado = new RegExp(`<${tag}>([^<\\n]*)`, 'i').exec(bloco);
  return achado ? semEntidades(achado[1]).trim() : '';
}

function valorOfx(texto: string): number | null {
  const achado = /^([+-]?)(\d*)(?:[.,](\d*))?$/.exec(texto.replace(/\s/g, ''));
  if (!achado || (achado[2] === '' && !achado[3])) {
    return null;
  }
  return centavosDeDecimal(achado[1] === '-', achado[2], achado[3] ?? '');
}

function dataOfx(texto: string): string | null {
  const achado = /^(\d{4})(\d{2})(\d{2})/.exec(texto);
  if (!achado) {
    return null;
  }
  const data = `${achado[1]}-${achado[2]}-${achado[3]}`;
  return dataISOValida(data) ? data : null;
}

// MEMO e NAME: alguns bancos repetem, outros completam um com o outro.
function descricaoOfx(bloco: string): string {
  const memo = limparDescricao(campo(bloco, 'MEMO'));
  const nome = limparDescricao(campo(bloco, 'NAME'));
  const maisInformativa = memo.length >= nome.length ? memo : nome;
  return (
    maisInformativa ||
    limparDescricao(campo(bloco, 'TRNTYPE')) ||
    DESCRICAO_PADRAO
  );
}

export function lerOfx(texto: string): LinhaExtrato[] {
  if (!/<OFX>/i.test(texto)) {
    throw new Error(ERRO_NAO_OFX);
  }
  const linhas: LinhaExtrato[] = [];
  const inicio = /<STMTTRN>/gi;
  let achado: RegExpExecArray | null;
  let posicao = 0;
  while ((achado = inicio.exec(texto)) !== null) {
    const resto = texto.slice(achado.index + achado[0].length);
    const fim = resto.search(/<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>/i);
    const bloco = fim === -1 ? resto : resto.slice(0, fim);
    // A conta é a do último ACCTID antes desta transação.
    const antes = texto.slice(0, achado.index);
    const contas = antes.match(/<ACCTID>([^<\n]*)/gi);
    const conta = contas
      ? contas[contas.length - 1].replace(/<ACCTID>/i, '').trim()
      : '';
    const data = dataOfx(campo(bloco, 'DTPOSTED'));
    const valorCentavos = valorOfx(campo(bloco, 'TRNAMT'));
    posicao++;
    if (data === null || valorCentavos === null || valorCentavos === 0) {
      continue;
    }
    const descricao = descricaoOfx(bloco);
    const fitid = campo(bloco, 'FITID');
    const idExterno = fitid
      ? `ofx:${conta}:${fitid}`
      : `ofx:${conta}:h${hashTexto(
          `${data}|${valorCentavos}|${descricao}|${posicao}`,
        )}`;
    linhas.push({data, descricao, valorCentavos, idExterno});
  }
  if (linhas.length === 0) {
    throw new Error(ERRO_NAO_OFX);
  }
  return linhas;
}
