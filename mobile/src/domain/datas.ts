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
