import {anoMesDe} from '../datas';
import type {DadosTransacao} from '../entities/Transacao';
import {
  detectarFormato,
  lerCsv,
  linhasDoCsv,
  type FormatoCsv,
  type MapeamentoColunas,
} from '../importacao/csv';
import {decodificarTexto} from '../importacao/decodificar';
import {
  ERRO_ARQUIVO_GRANDE,
  ERRO_ARQUIVO_VAZIO,
  ERRO_MUITAS_LINHAS,
  ERRO_SEM_LANCAMENTOS,
  MAX_BYTES_EXTRATO,
  MAX_LINHAS_EXTRATO,
} from '../importacao/limites';
import type {ErroDeLinha, LinhaExtrato} from '../importacao/linhaExtrato';
import {lerOfx} from '../importacao/ofx';
import {
  prepararImportacao,
  type ItemImportacao,
} from '../importacao/prepararImportacao';
import type {TransacaoRepository} from '../repositories/TransacaoRepository';
import type {SugerirCategoria} from './SugerirCategoria';

export type FormatoExtrato = 'ofx' | FormatoCsv;

export const ROTULO_FORMATO: Record<FormatoExtrato, string> = {
  ofx: 'OFX',
  'nubank-conta': 'Nubank conta',
  'nubank-cartao': 'Nubank cartão',
  csv: 'CSV',
};

export interface LeituraExtrato {
  nome: string;
  formato: FormatoExtrato;
  itens: ItemImportacao[];
  errosDeLinha: ErroDeLinha[];
  precisaMapeamento: boolean;
  cabecalho: string[];
  // A 1ª linha de dados, para a tela mostrar um exemplo de cada coluna.
  exemplo: string[];
  tabela: string[][];
}

export class ImportarExtrato {
  constructor(
    private readonly transacoes: TransacaoRepository,
    private readonly sugeridor: Pick<
      SugerirCategoria,
      'preparar' | 'sugerir' | 'invalidar'
    >,
    private readonly aoImportarDespesa?: (
      categoria: string,
      data: string,
    ) => Promise<void> | void,
  ) {}

  async ler(nome: string, bytes: Uint8Array): Promise<LeituraExtrato> {
    if (bytes.length > MAX_BYTES_EXTRATO) {
      throw new Error(ERRO_ARQUIVO_GRANDE);
    }
    const texto = decodificarTexto(bytes);
    if (texto.trim() === '') {
      throw new Error(ERRO_ARQUIVO_VAZIO);
    }
    const base = {nome, cabecalho: [], exemplo: [], tabela: []};

    if (/<OFX>/i.test(texto) || /\.ofx$/i.test(nome)) {
      return {
        ...base,
        formato: 'ofx',
        itens: await this.preparar(lerOfx(texto)),
        errosDeLinha: [],
        precisaMapeamento: false,
      };
    }

    const tabela = lerCsv(texto);
    if (tabela.length < 2) {
      throw new Error(ERRO_SEM_LANCAMENTOS);
    }
    if (tabela.length - 1 > MAX_LINHAS_EXTRATO) {
      throw new Error(ERRO_MUITAS_LINHAS);
    }
    const leitura = {
      ...base,
      cabecalho: tabela[0],
      exemplo: tabela[1],
      tabela,
    };
    const detectado = detectarFormato(tabela[0]);
    if (!detectado) {
      return {
        ...leitura,
        formato: 'csv',
        itens: [],
        errosDeLinha: [],
        precisaMapeamento: true,
      };
    }
    return this.lerCsvMapeado(
      {
        ...leitura,
        formato: detectado.formato,
        itens: [],
        errosDeLinha: [],
        precisaMapeamento: false,
      },
      detectado.mapeamento,
      detectado.cartao,
    );
  }

  aplicarMapeamento(
    leitura: LeituraExtrato,
    mapeamento: MapeamentoColunas,
    cartao: boolean,
  ): Promise<LeituraExtrato> {
    return this.lerCsvMapeado(leitura, mapeamento, cartao);
  }

  private async lerCsvMapeado(
    leitura: LeituraExtrato,
    mapeamento: MapeamentoColunas,
    cartao: boolean,
  ): Promise<LeituraExtrato> {
    const {linhas, erros} = linhasDoCsv(leitura.tabela, mapeamento, {cartao});
    if (linhas.length === 0) {
      throw new Error(ERRO_SEM_LANCAMENTOS);
    }
    return {
      ...leitura,
      itens: await this.preparar(linhas),
      errosDeLinha: erros,
      precisaMapeamento: false,
    };
  }

  private preparar(linhas: LinhaExtrato[]): Promise<ItemImportacao[]> {
    return prepararImportacao(linhas, this.sugeridor, this.transacoes);
  }

  // Devolve quantos lançamentos entraram de fato (os já importados são pulados).
  async importar(itens: ItemImportacao[], hoje: string): Promise<number> {
    const escolhidos = itens.filter(item => item.selecionado);
    const lote: DadosTransacao[] = escolhidos.map(item => ({
      tipo: item.tipo,
      descricao: item.linha.descricao,
      valorCentavos: item.valorCentavos,
      data: item.linha.data,
      categoria: item.categoria,
      recorrencia: 'variavel',
      comprovanteUri: null,
      contaRecorrenteId: null,
      idExterno: item.linha.idExterno,
    }));
    const quantidade = await this.transacoes.importarLote(lote);
    if (quantidade === 0) {
      return 0;
    }
    this.sugeridor.invalidar();

    // Um aviso de orçamento por categoria: o gasto do mês já soma todas as linhas.
    const mesAtual = anoMesDe(hoje);
    const porCategoria = new Map<string, string>();
    for (const item of lote) {
      if (item.tipo === 'despesa' && anoMesDe(item.data) === mesAtual) {
        porCategoria.set(item.categoria, item.data);
      }
    }
    for (const [categoria, data] of porCategoria) {
      try {
        await this.aoImportarDespesa?.(categoria, data);
      } catch {
        // O extrato já entrou; um aviso que falha não desfaz a importação.
      }
    }
    return quantidade;
  }
}
