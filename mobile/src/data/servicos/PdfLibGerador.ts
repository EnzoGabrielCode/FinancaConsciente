import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';

import {buscarCategoria, CATEGORIAS_DESPESA} from '../../domain/categorias';
import {formatarDataCurta, hojeISO} from '../../domain/datas';
import {formatarCentavos, formatarPercentual} from '../../domain/dinheiro';
import type {Relatorio} from '../../domain/entities/Relatorio';
import {rotuloCategoria} from '../../domain/relatorios';
import type {GeradorPdf} from '../../domain/repositories/GeradorPdf';

const LARGURA = 595.28; // A4 retrato, em pontos
const ALTURA = 841.89;
const MARGEM = 40;
const RODAPE = 40;
const ALTURA_LINHA = 18;

const PRETO = rgb(0.1, 0.1, 0.1);
const CINZA = rgb(0.4, 0.4, 0.4);
const ZEBRA = rgb(0.95, 0.95, 0.95);
const VERDE_ESCURO = rgb(0.05, 0.45, 0.2);
const VERMELHO_ESCURO = rgb(0.65, 0.1, 0.1);

const COLUNAS = {
  data: MARGEM,
  descricao: MARGEM + 62,
  categoria: MARGEM + 300,
  valorDireita: LARGURA - MARGEM - 4,
};

// As fontes padrão do PDF só desenham WinAnsi: emoji e afins lançariam erro.
const WIN_ANSI = /^[\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]$/;

export function paraWinAnsi(texto: string): string {
  return Array.from(texto.replace(/[\r\n\t]+/g, ' '))
    .map(caractere => (WIN_ANSI.test(caractere) ? caractere : '?'))
    .join('');
}

function cortar(
  texto: string,
  fonte: PDFFont,
  tamanho: number,
  largura: number,
): string {
  if (fonte.widthOfTextAtSize(texto, tamanho) <= largura) {
    return texto;
  }
  let corte = Array.from(texto);
  while (
    corte.length > 0 &&
    fonte.widthOfTextAtSize(`${corte.join('')}…`, tamanho) > largura
  ) {
    corte = corte.slice(0, -1);
  }
  return `${corte.join('').trimEnd()}…`;
}

const doisDigitos = (n: number) => String(n).padStart(2, '0');

function descreverFiltro({filtro}: Relatorio): string {
  const tipo =
    filtro.tipo === 'todos'
      ? 'Todos'
      : filtro.tipo === 'receita'
      ? 'Receitas'
      : 'Despesas';
  const categoria =
    filtro.categoria === null
      ? 'Todas'
      : buscarCategoria(
          filtro.tipo === 'receita' ? 'receita' : 'despesa',
          filtro.categoria,
        )?.label ?? filtro.categoria;
  return `Tipo: ${tipo} · Categoria: ${categoria}`;
}

class Desenho {
  pagina!: PDFPage;
  y = 0;

  constructor(
    private readonly documento: PDFDocument,
    readonly fonte: PDFFont,
    readonly negrito: PDFFont,
  ) {
    this.novaPagina();
  }

  novaPagina(): void {
    this.pagina = this.documento.addPage([LARGURA, ALTURA]);
    this.y = ALTURA - MARGEM;
  }

  cabe(altura: number): boolean {
    return this.y - altura >= RODAPE + 10;
  }

  texto(
    conteudo: string,
    x: number,
    {
      tamanho = 10,
      fonte = this.fonte,
      cor = PRETO,
      direita = false,
      largura,
    }: {
      tamanho?: number;
      fonte?: PDFFont;
      cor?: ReturnType<typeof rgb>;
      direita?: boolean;
      largura?: number;
    } = {},
  ): void {
    const seguro = paraWinAnsi(conteudo);
    const final = largura ? cortar(seguro, fonte, tamanho, largura) : seguro;
    const posicaoX = direita ? x - fonte.widthOfTextAtSize(final, tamanho) : x;
    this.pagina.drawText(final, {
      x: posicaoX,
      y: this.y,
      size: tamanho,
      font: fonte,
      color: cor,
    });
  }

  faixa(cor: ReturnType<typeof rgb>): void {
    this.pagina.drawRectangle({
      x: MARGEM - 4,
      y: this.y - 5,
      width: LARGURA - 2 * MARGEM + 8,
      height: ALTURA_LINHA,
      color: cor,
    });
  }
}

export class PdfLibGerador implements GeradorPdf {
  async gerar(relatorio: Relatorio, geradoEm: Date): Promise<string> {
    const documento = await PDFDocument.create();
    documento.setTitle('FinançaConsciente - Extrato');
    const desenho = new Desenho(
      documento,
      await documento.embedFont(StandardFonts.Helvetica),
      await documento.embedFont(StandardFonts.HelveticaBold),
    );
    const {negrito} = desenho;

    desenho.texto('FinançaConsciente · Extrato', MARGEM, {
      tamanho: 18,
      fonte: negrito,
    });
    desenho.y -= 22;
    desenho.texto(
      `Período: ${formatarDataCurta(relatorio.filtro.de)} a ${formatarDataCurta(
        relatorio.filtro.ate,
      )}`,
      MARGEM,
    );
    desenho.y -= 14;
    desenho.texto(descreverFiltro(relatorio), MARGEM, {cor: CINZA});
    desenho.y -= 14;
    desenho.texto(
      `Gerado em ${formatarDataCurta(hojeISO(geradoEm))} às ${doisDigitos(
        geradoEm.getHours(),
      )}:${doisDigitos(geradoEm.getMinutes())}`,
      MARGEM,
      {cor: CINZA, tamanho: 9},
    );
    desenho.y -= 30;

    // Resumo
    const resumo: [string, number, ReturnType<typeof rgb>][] = [
      ['Receitas', relatorio.totalReceitas, VERDE_ESCURO],
      ['Despesas', -relatorio.totalDespesas, VERMELHO_ESCURO],
      [
        'Resultado',
        relatorio.resultado,
        relatorio.resultado < 0 ? VERMELHO_ESCURO : PRETO,
      ],
    ];
    const larguraBloco = (LARGURA - 2 * MARGEM) / resumo.length;
    resumo.forEach(([rotulo], i) =>
      desenho.texto(rotulo.toUpperCase(), MARGEM + i * larguraBloco, {
        tamanho: 8,
        cor: CINZA,
      }),
    );
    desenho.y -= 16;
    resumo.forEach(([, valor, cor], i) =>
      desenho.texto(formatarCentavos(valor), MARGEM + i * larguraBloco, {
        tamanho: 14,
        fonte: negrito,
        cor,
      }),
    );
    desenho.y -= 14;
    desenho.texto(
      `${relatorio.quantidade} ${
        relatorio.quantidade === 1 ? 'lançamento' : 'lançamentos'
      }`,
      MARGEM,
      {tamanho: 9, cor: CINZA},
    );
    desenho.y -= 30;

    // Gastos por categoria
    if (relatorio.porCategoria.length > 0) {
      desenho.texto('Gastos por categoria', MARGEM, {
        tamanho: 12,
        fonte: negrito,
      });
      desenho.y -= 20;
      relatorio.porCategoria.forEach((gasto, i) => {
        if (!desenho.cabe(ALTURA_LINHA)) {
          desenho.novaPagina();
        }
        if (i % 2 === 0) {
          desenho.faixa(ZEBRA);
        }
        const rotulo =
          CATEGORIAS_DESPESA.find(c => c.id === gasto.categoria)?.label ??
          gasto.categoria;
        desenho.texto(rotulo, MARGEM);
        desenho.texto(
          formatarPercentual(gasto.percentual, {sinalPositivo: false}),
          COLUNAS.categoria + 80,
          {direita: true},
        );
        desenho.texto(
          formatarCentavos(gasto.totalCentavos),
          COLUNAS.valorDireita,
          {direita: true},
        );
        desenho.y -= ALTURA_LINHA;
      });
      desenho.y -= 20;
    }

    // Lançamentos
    const cabecalhoTabela = () => {
      desenho.texto('Data', COLUNAS.data, {fonte: negrito, tamanho: 9});
      desenho.texto('Descrição', COLUNAS.descricao, {
        fonte: negrito,
        tamanho: 9,
      });
      desenho.texto('Categoria', COLUNAS.categoria, {
        fonte: negrito,
        tamanho: 9,
      });
      desenho.texto('Valor', COLUNAS.valorDireita, {
        fonte: negrito,
        tamanho: 9,
        direita: true,
      });
      desenho.y -= 4;
      desenho.pagina.drawLine({
        start: {x: MARGEM - 4, y: desenho.y},
        end: {x: LARGURA - MARGEM + 4, y: desenho.y},
        thickness: 0.5,
        color: CINZA,
      });
      desenho.y -= ALTURA_LINHA - 4;
    };

    if (!desenho.cabe(60)) {
      desenho.novaPagina();
    }
    desenho.texto('Lançamentos', MARGEM, {tamanho: 12, fonte: negrito});
    desenho.y -= 20;
    if (relatorio.transacoes.length === 0) {
      desenho.texto('Nenhum lançamento neste período.', MARGEM, {cor: CINZA});
    } else {
      cabecalhoTabela();
    }
    relatorio.transacoes.forEach((transacao, i) => {
      if (!desenho.cabe(ALTURA_LINHA)) {
        desenho.novaPagina();
        cabecalhoTabela();
      }
      if (i % 2 === 0) {
        desenho.faixa(ZEBRA);
      }
      const despesa = transacao.tipo === 'despesa';
      desenho.texto(formatarDataCurta(transacao.data), COLUNAS.data, {
        tamanho: 9,
      });
      desenho.texto(transacao.descricao, COLUNAS.descricao, {
        tamanho: 9,
        largura: COLUNAS.categoria - COLUNAS.descricao - 10,
      });
      desenho.texto(rotuloCategoria(transacao), COLUNAS.categoria, {
        tamanho: 9,
        largura: 100,
      });
      desenho.texto(
        formatarCentavos(
          despesa ? -transacao.valorCentavos : transacao.valorCentavos,
        ),
        COLUNAS.valorDireita,
        {
          tamanho: 9,
          direita: true,
          cor: despesa ? VERMELHO_ESCURO : VERDE_ESCURO,
        },
      );
      desenho.y -= ALTURA_LINHA;
    });

    // Rodapé depois de tudo: só agora o total de páginas é conhecido.
    const paginas = documento.getPages();
    paginas.forEach((pagina, i) => {
      const texto = `Página ${i + 1} de ${paginas.length}`;
      pagina.drawText(texto, {
        x: LARGURA - MARGEM - desenho.fonte.widthOfTextAtSize(texto, 8),
        y: RODAPE - 16,
        size: 8,
        font: desenho.fonte,
        color: CINZA,
      });
    });

    return documento.saveAsBase64();
  }
}
