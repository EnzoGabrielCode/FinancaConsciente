import {anoMesDe, mesesAte, ultimoDiaDoMesAnterior} from '../datas';
import type {
  FiltroRelatorio,
  PontoPatrimonio,
  Relatorio,
  ResumoPatrimonio,
} from '../entities/Relatorio';
import {evolucaoPatrimonio, resumoPatrimonio} from '../patrimonio';
import {
  gerarCsv,
  montarRelatorio,
  nomeArquivo,
  validarFiltro,
} from '../relatorios';
import {
  ehCancelamento,
  type ExportadorArquivos,
} from '../repositories/ExportadorArquivos';
import type {GeradorPdf} from '../repositories/GeradorPdf';
import type {TransacaoRepository} from '../repositories/TransacaoRepository';

export interface Patrimonio {
  serie: PontoPatrimonio[];
  resumo: ResumoPatrimonio;
}

export class GerarRelatorios {
  constructor(
    private readonly transacoes: TransacaoRepository,
    private readonly exportador: ExportadorArquivos,
    private readonly geradorPdf: GeradorPdf,
  ) {}

  async carregar(filtro: FiltroRelatorio): Promise<Relatorio> {
    const erro = validarFiltro(filtro);
    if (erro) {
      throw new Error(erro);
    }
    return montarRelatorio(
      filtro,
      await this.transacoes.listarPorPeriodo(filtro),
    );
  }

  async patrimonio(hoje: string, meses = 12): Promise<Patrimonio> {
    const lista = mesesAte(anoMesDe(hoje), meses);
    const [saldoAntes, totais] = await Promise.all([
      this.transacoes.saldoAte(ultimoDiaDoMesAnterior(lista[0])),
      this.transacoes.totaisPorMes(lista[0], lista[lista.length - 1]),
    ]);
    const serie = evolucaoPatrimonio(saldoAntes, totais, lista);
    return {serie, resumo: resumoPatrimonio(serie)};
  }

  // Devolvem false quando a pessoa fecha o menu de compartilhar sem escolher.
  async exportarCsv(relatorio: Relatorio): Promise<boolean> {
    const caminho = await this.exportador.salvarTexto(
      nomeArquivo(relatorio.filtro, 'csv'),
      gerarCsv(relatorio),
    );
    return this.compartilhar(caminho, 'text/csv', 'Extrato em CSV');
  }

  async exportarPdf(
    relatorio: Relatorio,
    agora: Date = new Date(),
  ): Promise<boolean> {
    const base64 = await this.geradorPdf.gerar(relatorio, agora);
    const caminho = await this.exportador.salvarBase64(
      nomeArquivo(relatorio.filtro, 'pdf'),
      base64,
    );
    return this.compartilhar(caminho, 'application/pdf', 'Extrato em PDF');
  }

  private async compartilhar(
    caminho: string,
    mime: string,
    titulo: string,
  ): Promise<boolean> {
    try {
      await this.exportador.compartilhar(caminho, mime, titulo);
      return true;
    } catch (erro) {
      if (ehCancelamento(erro)) {
        return false;
      }
      throw erro;
    }
  }
}
