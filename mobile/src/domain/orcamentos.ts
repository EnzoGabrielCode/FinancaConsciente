import {
  buscarCategoria,
  CATEGORIAS_DESPESA,
  categoriasDo,
  type Categoria,
} from './categorias';
import {anoMesDe, ultimoDiaDoMes} from './datas';
import type {
  DadosOrcamento,
  NivelAlerta,
  Orcamento,
  ProgressoOrcamento,
  ResumoOrcamentos,
  SituacaoOrcamento,
} from './entities/Orcamento';

export const LIMIAR_PERTO = 80;
export const MAX_LIMITE_CENTAVOS = 9_999_999_999;

export type ErrosOrcamento = Partial<Record<keyof DadosOrcamento, string>>;

export interface ResultadoValidacaoOrcamento {
  valido: boolean;
  erros: ErrosOrcamento;
  dados: DadosOrcamento;
}

export function validarOrcamento(
  dados: DadosOrcamento,
): ResultadoValidacaoOrcamento {
  const erros: ErrosOrcamento = {};

  if (!CATEGORIAS_DESPESA.some(c => c.id === dados.categoria)) {
    erros.categoria = 'Escolha uma categoria de despesa.';
  }

  if (!Number.isInteger(dados.limiteCentavos) || dados.limiteCentavos <= 0) {
    erros.limiteCentavos = 'Informe um limite maior que zero.';
  } else if (dados.limiteCentavos > MAX_LIMITE_CENTAVOS) {
    erros.limiteCentavos = 'O limite pode ser de até R$ 99.999.999,99.';
  }

  return {valido: Object.keys(erros).length === 0, erros, dados};
}

export function categoriaDoOrcamento(id: string): Categoria {
  return (
    buscarCategoria('despesa', id) ??
    categoriasDo('despesa').find(c => c.id === 'outros')!
  );
}

export function nivelAlcancado(
  gastoCentavos: number,
  limiteCentavos: number,
): NivelAlerta | null {
  if (gastoCentavos >= limiteCentavos) {
    return 100;
  }
  return gastoCentavos * 100 >= limiteCentavos * LIMIAR_PERTO ? 80 : null;
}

export function situacaoDo(
  gastoCentavos: number,
  limiteCentavos: number,
): SituacaoOrcamento {
  const nivel = nivelAlcancado(gastoCentavos, limiteCentavos);
  if (nivel === 100) {
    return 'estourado';
  }
  return nivel === 80 ? 'perto' : 'ok';
}

// Arredonda para baixo: 99,9% continua 99 enquanto a situação é "perto".
export function percentualDe(
  gastoCentavos: number,
  limiteCentavos: number,
): number {
  if (limiteCentavos <= 0) {
    return 0;
  }
  const centesimos = gastoCentavos * 100;
  return (centesimos - (centesimos % limiteCentavos)) / limiteCentavos;
}

export function montarProgressos(
  orcamentos: Orcamento[],
  gastosPorCategoria: Record<string, number>,
): ProgressoOrcamento[] {
  const fracao = ({gastoCentavos, orcamento}: ProgressoOrcamento) =>
    gastoCentavos / orcamento.limiteCentavos;

  return orcamentos
    .map(orcamento => {
      const {categoria, limiteCentavos} = orcamento;
      const gastoCentavos = gastosPorCategoria[categoria] ?? 0;
      return {
        orcamento,
        gastoCentavos,
        percentual: percentualDe(gastoCentavos, limiteCentavos),
        restanteCentavos: limiteCentavos - gastoCentavos,
        situacao: situacaoDo(gastoCentavos, limiteCentavos),
      };
    })
    .sort((a, b) => fracao(b) - fracao(a));
}

export function resumir(
  progressos: ProgressoOrcamento[],
  hoje: string,
): ResumoOrcamentos {
  const totalLimite = progressos.reduce(
    (total, p) => total + p.orcamento.limiteCentavos,
    0,
  );
  const totalGasto = progressos.reduce(
    (total, p) => total + p.gastoCentavos,
    0,
  );
  const ultimoDia = Number(ultimoDiaDoMes(anoMesDe(hoje)).slice(8));
  return {
    totalLimite,
    totalGasto,
    disponivel: totalLimite - totalGasto,
    percentual: percentualDe(totalGasto, totalLimite),
    diasRestantes: ultimoDia - Number(hoje.slice(8)) + 1,
  };
}
