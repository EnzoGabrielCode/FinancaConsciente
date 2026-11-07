import {CATEGORIAS_DESPESA} from './categorias';
import {
  anoMesDe,
  avancarMes,
  diasEntre,
  formatarDiaCurto,
  ultimoDiaDoMes,
} from './datas';
import type {
  ContaRecorrente,
  DadosContaRecorrente,
} from './entities/ContaRecorrente';

export const MAX_DESCRICAO_CONTA = 40;
export const MAX_VALOR_CONTA_CENTAVOS = 9_999_999_999;
export const OPCOES_LEMBRETE = [0, 1, 2, 3, 5, 7];
export const HORA_LEMBRETE = 9;
export const LIMITE_VENCIMENTOS = 12;

type Agenda = Pick<DadosContaRecorrente, 'frequencia' | 'dia' | 'mes'>;

const doisDigitos = (n: number) => String(n).padStart(2, '0');

export function vencimentoNoMes(dia: number, anoMes: string): string {
  const ultimoDia = Number(ultimoDiaDoMes(anoMes).slice(8));
  return `${anoMes}-${doisDigitos(Math.min(dia, ultimoDia))}`;
}

const mesesEntreVencimentos = ({frequencia}: Agenda) =>
  frequencia === 'anual' ? 12 : 1;

export function primeiroVencimento(agenda: Agenda, hoje: string): string {
  const {dia, mes} = agenda;
  const anoMes =
    agenda.frequencia === 'anual'
      ? `${hoje.slice(0, 4)}-${doisDigitos(mes ?? 1)}`
      : anoMesDe(hoje);
  const vencimento = vencimentoNoMes(dia, anoMes);
  return vencimento >= hoje
    ? vencimento
    : vencimentoNoMes(dia, avancarMes(anoMes, mesesEntreVencimentos(agenda)));
}

// Parte sempre do dia original: 31/jan → 28/fev → 31/mar, sem grudar no 28.
export function vencimentoSeguinte(agenda: Agenda, data: string): string {
  return vencimentoNoMes(
    agenda.dia,
    avancarMes(anoMesDe(data), mesesEntreVencimentos(agenda)),
  );
}

export function vencimentosAte(
  conta: Pick<ContaRecorrente, 'frequencia' | 'dia' | 'mes' | 'proxima'>,
  hoje: string,
  limite: number = LIMITE_VENCIMENTOS,
): string[] {
  const datas: string[] = [];
  let data = conta.proxima;
  while (data <= hoje && datas.length < limite) {
    datas.push(data);
    data = vencimentoSeguinte(conta, data);
  }
  return datas;
}

export function mudouAgenda(antes: Agenda, depois: Agenda): boolean {
  return (
    antes.frequencia !== depois.frequencia ||
    antes.dia !== depois.dia ||
    antes.mes !== depois.mes
  );
}

export function dataDoLembrete(
  vencimento: string,
  lembrarDiasAntes: number,
): string {
  const instante =
    Date.parse(`${vencimento}T00:00:00Z`) - lembrarDiasAntes * 864e5;
  return new Date(instante).toISOString().slice(0, 10);
}

// No fuso do aparelho: "YYYY-MM-DD" passado direto ao Date seria lido como UTC.
export function momentoDoLembrete(data: string): Date {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(ano, mes - 1, dia, HORA_LEMBRETE);
}

export function totalMensalFixo(contas: ContaRecorrente[]): number {
  const ativas = contas.filter(conta => conta.ativa);
  const somaDe = (frequencia: ContaRecorrente['frequencia']) =>
    ativas
      .filter(conta => conta.frequencia === frequencia)
      .reduce((soma, conta) => soma + conta.valorCentavos, 0);
  return somaDe('mensal') + Math.ceil(somaDe('anual') / 12);
}

export function descreverFrequencia(agenda: Agenda): string {
  if (agenda.frequencia === 'mensal') {
    return `Todo dia ${agenda.dia}`;
  }
  // Ano bissexto de referência: 29/fev continua sendo 29/fev na descrição.
  const data = vencimentoNoMes(
    agenda.dia,
    `2000-${doisDigitos(agenda.mes ?? 1)}`,
  );
  return `Todo ano em ${formatarDiaCurto(data)}`;
}

export function descreverProximo(proxima: string, hoje: string): string {
  const dias = diasEntre(hoje, proxima);
  const quando =
    dias < 0
      ? 'atrasada'
      : dias === 0
      ? 'hoje'
      : dias === 1
      ? 'amanhã'
      : `em ${dias} dias`;
  return `Próximo: ${formatarDiaCurto(proxima)} · ${quando}`;
}

export function textoContasLancadas(quantidade: number): string {
  return quantidade === 1
    ? '1 conta fixa lançada'
    : `${quantidade} contas fixas lançadas`;
}

export type ErrosContaRecorrente = Partial<
  Record<keyof DadosContaRecorrente, string>
>;

export interface ResultadoValidacaoConta {
  valido: boolean;
  erros: ErrosContaRecorrente;
  dados: DadosContaRecorrente;
}

export function validarContaRecorrente(
  dados: DadosContaRecorrente,
): ResultadoValidacaoConta {
  const erros: ErrosContaRecorrente = {};
  const descricao = dados.descricao.trim();

  if (descricao === '') {
    erros.descricao = 'Dê um nome à conta.';
  } else if (Array.from(descricao).length > MAX_DESCRICAO_CONTA) {
    erros.descricao = `O nome pode ter no máximo ${MAX_DESCRICAO_CONTA} caracteres.`;
  }

  if (!Number.isInteger(dados.valorCentavos) || dados.valorCentavos <= 0) {
    erros.valorCentavos = 'Informe um valor maior que zero.';
  } else if (dados.valorCentavos > MAX_VALOR_CONTA_CENTAVOS) {
    erros.valorCentavos = 'O valor pode ser de até R$ 99.999.999,99.';
  }

  if (!CATEGORIAS_DESPESA.some(c => c.id === dados.categoria)) {
    erros.categoria = 'Escolha uma categoria de despesa.';
  }

  if (dados.frequencia !== 'mensal' && dados.frequencia !== 'anual') {
    erros.frequencia = 'Escolha mensal ou anual.';
  }

  if (!Number.isInteger(dados.dia) || dados.dia < 1 || dados.dia > 31) {
    erros.dia = 'Escolha um dia entre 1 e 31.';
  }

  if (dados.frequencia === 'anual') {
    if (
      dados.mes === null ||
      !Number.isInteger(dados.mes) ||
      dados.mes < 1 ||
      dados.mes > 12
    ) {
      erros.mes = 'Escolha o mês da conta anual.';
    }
  } else if (dados.mes !== null) {
    erros.mes = 'Só a conta anual tem mês.';
  }

  if (!OPCOES_LEMBRETE.includes(dados.lembrarDiasAntes)) {
    erros.lembrarDiasAntes = 'Escolha quando quer ser lembrado.';
  }

  return {
    valido: Object.keys(erros).length === 0,
    erros,
    dados: {...dados, descricao},
  };
}
