import {formatarCentavos} from './dinheiro';
import type {Cofre, DadosCofre, TipoMovimento} from './entities/Cofre';

export const MAX_NOME_COFRE = 30;

export const ICONES_COFRE = [
  '💰',
  '🎯',
  '🏖️',
  '🎓',
  '🚀',
  '🏋️',
  '🎸',
  '💊',
  '🐾',
  '🌍',
  '🎁',
  '🏡',
  '✈️',
  '🏠',
  '🚗',
  '🛡️',
] as const;

export const CORES_COFRE = [
  '#39FF84',
  '#64B5F6',
  '#CE93D8',
  '#FFB74D',
  '#FF6B6B',
  '#80DEEA',
] as const;

export type ErrosCofre = Partial<Record<keyof DadosCofre, string>>;

export interface ResultadoValidacaoCofre {
  valido: boolean;
  erros: ErrosCofre;
  dados: DadosCofre;
}

const normalizarNome = (nome: string) => nome.trim().toLocaleLowerCase();

export function validarCofre(
  dados: DadosCofre,
  nomesExistentes: string[],
): ResultadoValidacaoCofre {
  const erros: ErrosCofre = {};
  const nome = dados.nome.trim();

  if (nome === '') {
    erros.nome = 'Dê um nome ao cofre.';
  } else if (Array.from(nome).length > MAX_NOME_COFRE) {
    erros.nome = `O nome pode ter no máximo ${MAX_NOME_COFRE} caracteres.`;
  } else if (
    nomesExistentes.some(
      existente => normalizarNome(existente) === normalizarNome(nome),
    )
  ) {
    erros.nome = 'Já existe um cofre com esse nome.';
  }

  if (!(ICONES_COFRE as readonly string[]).includes(dados.icone)) {
    erros.icone = 'Escolha um ícone.';
  }

  if (!(CORES_COFRE as readonly string[]).includes(dados.cor)) {
    erros.cor = 'Escolha uma cor.';
  }

  if (
    dados.metaCentavos !== null &&
    (!Number.isInteger(dados.metaCentavos) || dados.metaCentavos <= 0)
  ) {
    erros.metaCentavos = 'A meta precisa ser maior que zero.';
  }

  return {
    valido: Object.keys(erros).length === 0,
    erros,
    dados: {...dados, nome},
  };
}

export function progressoCofre(
  saldoCentavos: number,
  metaCentavos: number | null,
): number | null {
  if (metaCentavos === null || metaCentavos <= 0) {
    return null;
  }
  return Math.min(Math.max(saldoCentavos / metaCentavos, 0), 1);
}

export interface DadosValidacaoMovimento {
  tipo: TipoMovimento;
  valorCentavos: number;
  saldoCofreCentavos: number;
  disponivelCentavos: number;
}

export function validarMovimento({
  tipo,
  valorCentavos,
  saldoCofreCentavos,
  disponivelCentavos,
}: DadosValidacaoMovimento): string | null {
  if (!Number.isInteger(valorCentavos) || valorCentavos <= 0) {
    return 'Informe um valor maior que zero.';
  }
  if (tipo === 'retirada') {
    return valorCentavos > saldoCofreCentavos
      ? `Este cofre tem só ${formatarCentavos(
          Math.max(saldoCofreCentavos, 0),
        )}.`
      : null;
  }
  if (disponivelCentavos <= 0) {
    return 'Não há saldo disponível para guardar.';
  }
  return valorCentavos > disponivelCentavos
    ? `Você tem só ${formatarCentavos(disponivelCentavos)} disponível.`
    : null;
}

export interface ResumoCofres {
  totalGuardadoCentavos: number;
  totalMetasCentavos: number;
  progressoGeral: number | null;
  quantidade: number;
}

export function resumoCofres(cofres: Cofre[]): ResumoCofres {
  const comMeta = cofres.filter(
    (cofre): cofre is Cofre & {metaCentavos: number} =>
      cofre.metaCentavos !== null && cofre.metaCentavos > 0,
  );
  const totalMetasCentavos = comMeta.reduce(
    (soma, cofre) => soma + cofre.metaCentavos,
    0,
  );
  const guardadoComMeta = comMeta.reduce(
    (soma, cofre) =>
      soma + Math.min(Math.max(cofre.saldoCentavos, 0), cofre.metaCentavos),
    0,
  );
  return {
    totalGuardadoCentavos: cofres.reduce(
      (soma, cofre) => soma + cofre.saldoCentavos,
      0,
    ),
    totalMetasCentavos,
    progressoGeral:
      totalMetasCentavos > 0 ? guardadoComMeta / totalMetasCentavos : null,
    quantidade: cofres.length,
  };
}
