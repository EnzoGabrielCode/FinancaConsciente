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

export function rotuloMes(anoMes: string): string {
  return ROTULOS_MES[separarAnoMes(anoMes)[1] - 1] ?? '';
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
