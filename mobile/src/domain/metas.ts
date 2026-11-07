import {
  anoMesDe,
  avancarMes,
  diasEntre,
  formatarDiaCurto,
  formatarMesCurto,
  mesesEntre,
  ultimoDiaDoMes,
} from './datas';
import {formatarCentavos} from './dinheiro';
import type {Cofre} from './entities/Cofre';

export {avancarMes};

export const LIMITE_CURTO_PRAZO_MESES = 2;
export const MAX_ANOS_PRAZO = 30;

export type SituacaoMeta = 'em-andamento' | 'concluida' | 'vencida';

export interface PlanoMeta {
  prazo: string;
  restanteCentavos: number;
  mesesRestantes: number;
  diasRestantes: number;
  situacao: SituacaoMeta;
  porMesCentavos: number | null;
  porDiaCentavos: number | null;
  curtoPrazo: boolean;
}

export type CofreDoPlano = Pick<
  Cofre,
  'metaCentavos' | 'saldoCentavos' | 'prazo'
>;

export function mesesAFrente(hoje: string, meses: number): string {
  return avancarMes(anoMesDe(hoje), meses);
}

export function planoDaMeta(
  {metaCentavos, saldoCentavos, prazo}: CofreDoPlano,
  hoje: string,
): PlanoMeta | null {
  if (metaCentavos === null || prazo === null) {
    return null;
  }
  const restanteCentavos = Math.max(metaCentavos - saldoCentavos, 0);
  const mesesRestantes = mesesEntre(anoMesDe(hoje), prazo) + 1;
  const diasRestantes = diasEntre(hoje, ultimoDiaDoMes(prazo)) + 1;
  const situacao: SituacaoMeta =
    restanteCentavos === 0
      ? 'concluida'
      : mesesRestantes < 1
      ? 'vencida'
      : 'em-andamento';
  const emAndamento = situacao === 'em-andamento';
  return {
    prazo,
    restanteCentavos,
    mesesRestantes,
    diasRestantes,
    situacao,
    porMesCentavos: emAndamento
      ? Math.ceil(restanteCentavos / mesesRestantes)
      : null,
    porDiaCentavos: emAndamento
      ? Math.ceil(restanteCentavos / diasRestantes)
      : null,
    curtoPrazo: mesesRestantes <= LIMITE_CURTO_PRAZO_MESES,
  };
}

export function totalMensalDasMetas(
  cofres: CofreDoPlano[],
  hoje: string,
): number {
  return cofres.reduce(
    (total, cofre) => total + (planoDaMeta(cofre, hoje)?.porMesCentavos ?? 0),
    0,
  );
}

export interface ParcelaMeta {
  valor: string;
  unidade: 'mês' | 'dia';
  ate: string;
}

// Só existe em andamento: nas outras situações não há o que guardar por período.
export function parcelaDoPlano(plano: PlanoMeta): ParcelaMeta | null {
  const {porMesCentavos, porDiaCentavos, curtoPrazo, prazo} = plano;
  if (porMesCentavos === null || porDiaCentavos === null) {
    return null;
  }
  return curtoPrazo
    ? {
        valor: formatarCentavos(porDiaCentavos),
        unidade: 'dia',
        ate: formatarDiaCurto(ultimoDiaDoMes(prazo)),
      }
    : {
        valor: formatarCentavos(porMesCentavos),
        unidade: 'mês',
        ate: formatarMesCurto(prazo),
      };
}

export function fraseDoPlano(plano: PlanoMeta): string {
  const parcela = parcelaDoPlano(plano);
  if (parcela) {
    return `${parcela.valor}/${parcela.unidade} · até ${parcela.ate}`;
  }
  return plano.situacao === 'concluida'
    ? 'Meta atingida 🎉'
    : `Prazo encerrado · faltam ${formatarCentavos(plano.restanteCentavos)}`;
}
