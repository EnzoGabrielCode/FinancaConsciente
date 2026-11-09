import type {SugeridorCategoria} from '../casosDeUso/SugerirCategoria';
import type {TipoTransacao} from '../entities/Transacao';
import type {TransacaoRepository} from '../repositories/TransacaoRepository';
import {ERRO_MUITAS_LINHAS, MAX_LINHAS_EXTRATO} from './limites';
import type {LinhaExtrato} from './linhaExtrato';

export type SituacaoImportacao = 'nova' | 'ja-importada' | 'possivel-duplicata';

export interface ItemImportacao {
  linha: LinhaExtrato;
  tipo: TipoTransacao;
  valorCentavos: number;
  categoria: string;
  // A categoria veio do classificador (selo "✨ Sugerida" até a pessoa trocar).
  sugerida: boolean;
  situacao: SituacaoImportacao;
  selecionado: boolean;
}

const chaveDuplicata = (
  valorCentavos: number,
  data: string,
  categoria: string,
) => `${valorCentavos}|${data}|${categoria}`;

export async function prepararImportacao(
  linhas: LinhaExtrato[],
  sugeridor: Pick<SugeridorCategoria, 'preparar' | 'sugerir'>,
  repositorio: Pick<
    TransacaoRepository,
    'idsExternosExistentes' | 'listarPorPeriodo'
  >,
): Promise<ItemImportacao[]> {
  if (linhas.length > MAX_LINHAS_EXTRATO) {
    throw new Error(ERRO_MUITAS_LINHAS);
  }
  if (linhas.length === 0) {
    return [];
  }
  await sugeridor.preparar();
  const idsDoArquivo = linhas.map(l => l.idExterno);
  const datas = linhas.map(l => l.data).sort();
  const [existentes, noPeriodo] = await Promise.all([
    repositorio.idsExternosExistentes(idsDoArquivo),
    repositorio.listarPorPeriodo({
      de: datas[0],
      ate: datas[datas.length - 1],
      tipo: 'despesa',
      categoria: null,
    }),
  ]);

  // Regra da US 1.5 sem a janela de 10 minutos: despesa com mesmo valor, dia e
  // categoria. O que já casou pelo id externo não conta, e cada lançamento do
  // app casa com uma linha só do arquivo.
  const ids = new Set(idsDoArquivo);
  const disponiveis = new Map<string, number>();
  for (const t of noPeriodo) {
    if (t.idExterno !== null && ids.has(t.idExterno)) {
      continue;
    }
    const chave = chaveDuplicata(t.valorCentavos, t.data, t.categoria);
    disponiveis.set(chave, (disponiveis.get(chave) ?? 0) + 1);
  }

  return linhas.map(linha => {
    const tipo: TipoTransacao = linha.valorCentavos > 0 ? 'receita' : 'despesa';
    const valorCentavos = Math.abs(linha.valorCentavos);
    const sugestao =
      tipo === 'despesa' ? sugeridor.sugerir(linha.descricao) : null;
    const categoria = sugestao?.categoria ?? 'outros';
    let situacao: SituacaoImportacao = 'nova';
    if (existentes.has(linha.idExterno)) {
      situacao = 'ja-importada';
    } else if (tipo === 'despesa') {
      const chave = chaveDuplicata(valorCentavos, linha.data, categoria);
      const restantes = disponiveis.get(chave) ?? 0;
      if (restantes > 0) {
        disponiveis.set(chave, restantes - 1);
        situacao = 'possivel-duplicata';
      }
    }
    return {
      linha,
      tipo,
      valorCentavos,
      categoria,
      sugerida: sugestao !== null,
      situacao,
      selecionado: situacao === 'nova',
    };
  });
}
