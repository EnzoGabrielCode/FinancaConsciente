const doisDigitos = (n: number) => String(n).padStart(2, '0');

export function hojeISO(agora: Date = new Date()): string {
  return `${agora.getFullYear()}-${doisDigitos(
    agora.getMonth() + 1,
  )}-${doisDigitos(agora.getDate())}`;
}

export function dataISOValida(data: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!partes) {
    return false;
  }
  const [ano, mes, dia] = partes.slice(1).map(Number);
  const convertida = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    convertida.getUTCFullYear() === ano &&
    convertida.getUTCMonth() === mes - 1 &&
    convertida.getUTCDate() === dia
  );
}

export function formatarDataCurta(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function formatarDataAmigavel(
  dataISO: string,
  hoje: Date = new Date(),
): string {
  if (dataISO === hojeISO(hoje)) {
    return 'Hoje';
  }
  const ontem = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate() - 1,
  );
  if (dataISO === hojeISO(ontem)) {
    return 'Ontem';
  }
  const [ano, mes, dia] = dataISO.split('-');
  return Number(ano) === hoje.getFullYear()
    ? `${dia}/${mes}`
    : `${dia}/${mes}/${ano}`;
}

const NOMES_MES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const ROTULOS_MES = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

function separarAnoMes(anoMes: string): [number, number] {
  const [ano, mes] = anoMes.split('-').map(Number);
  return [ano, mes];
}

function montarAnoMes(indiceMeses: number): string {
  const ano = Math.floor(indiceMeses / 12);
  const mes = indiceMeses - ano * 12 + 1;
  return `${ano}-${doisDigitos(mes)}`;
}

const indiceDoMes = (anoMes: string) => {
  const [ano, mes] = separarAnoMes(anoMes);
  return ano * 12 + (mes - 1);
};

export function anoMesValido(anoMes: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(anoMes);
}

export function avancarMes(anoMes: string, delta: number): string {
  return montarAnoMes(indiceDoMes(anoMes) + delta);
}

export function mesesEntre(deAnoMes: string, ateAnoMes: string): number {
  return indiceDoMes(ateAnoMes) - indiceDoMes(deAnoMes);
}

// Em UTC: no horário local, um dia com mudança de fuso não teria 24 horas.
export function diasEntre(deISO: string, ateISO: string): number {
  const emDias = (dataISO: string) =>
    Date.parse(`${dataISO}T00:00:00Z`) / 864e5;
  return emDias(ateISO) - emDias(deISO);
}

export function anoMesDe(dataISO: string): string {
  return dataISO.slice(0, 7);
}

export function mesesAte(anoMes: string, quantidade: number): string[] {
  const [ano, mes] = separarAnoMes(anoMes);
  const indiceFinal = ano * 12 + (mes - 1);
  const meses: string[] = [];
  for (let i = quantidade - 1; i >= 0; i--) {
    meses.push(montarAnoMes(indiceFinal - i));
  }
  return meses;
}

export function ultimoDiaDoMesAnterior(anoMes: string): string {
  const [ano, mes] = separarAnoMes(anoMes);
  const ultimoDia = new Date(Date.UTC(ano, mes - 1, 0)).getUTCDate();
  return `${mesesAte(anoMes, 2)[0]}-${doisDigitos(ultimoDia)}`;
}

export function ultimoDiaDoMes(anoMes: string): string {
  const [ano, mes] = separarAnoMes(anoMes);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${anoMes}-${doisDigitos(ultimoDia)}`;
}

export function nomeMes(mes: number): string {
  return NOMES_MES[mes - 1] ?? '';
}

export function nomeMesAno(anoMes: string): string {
  const [ano, mes] = separarAnoMes(anoMes);
  return `${NOMES_MES[mes - 1] ?? ''} ${ano}`;
}

export function rotuloMes(anoMes: string): string {
  return ROTULOS_MES[separarAnoMes(anoMes)[1] - 1] ?? '';
}

export function formatarCabecalhoDia(
  dataISO: string,
  hoje: Date = new Date(),
): string {
  const amigavel = formatarDataAmigavel(dataISO, hoje);
  if (amigavel === 'Hoje' || amigavel === 'Ontem') {
    return amigavel;
  }
  const [ano] = dataISO.split('-');
  const rotulo = formatarDiaCurto(dataISO);
  return Number(ano) === hoje.getFullYear() ? rotulo : `${rotulo} de ${ano}`;
}

export function formatarDiaCurto(dataISO: string): string {
  return `${Number(dataISO.slice(8))} de ${rotuloMes(anoMesDe(dataISO))}.`;
}

export function formatarMesCurto(anoMes: string): string {
  return `${rotuloMes(anoMes)}. ${separarAnoMes(anoMes)[0]}`;
}

export function saudacao(agora: Date = new Date()): string {
  const hora = agora.getHours();
  if (hora >= 5 && hora < 12) {
    return 'Bom dia';
  }
  if (hora >= 12 && hora < 18) {
    return 'Boa tarde';
  }
  return 'Boa noite';
}
