import {buscarCategoria} from './categorias';
import {
  anoMesDe,
  avancarMes,
  dataISOValida,
  formatarDataCurta,
  ultimoDiaDoMes,
} from './datas';
import type {
  FiltroRelatorio,
  GastoCategoria,
  Relatorio,
} from './entities/Relatorio';
import type {Transacao} from './entities/Transacao';

export type PeriodoPredefinido =
  | 'este-mes'
  | 'mes-passado'
  | '3-meses'
  | 'este-ano';

export const MAX_ANOS_RELATORIO = 3;

export function periodoPredefinido(
  periodo: PeriodoPredefinido,
  hoje: string,
): Pick<FiltroRelatorio, 'de' | 'ate'> {
  const mesAtual = anoMesDe(hoje);
  switch (periodo) {
    case 'mes-passado': {
      const anterior = avancarMes(mesAtual, -1);
      return {de: `${anterior}-01`, ate: ultimoDiaDoMes(anterior)};
    }
    case '3-meses':
      return {de: `${avancarMes(mesAtual, -2)}-01`, ate: hoje};
    case 'este-ano':
      return {de: `${hoje.slice(0, 4)}-01-01`, ate: hoje};
    case 'este-mes':
      return {de: `${mesAtual}-01`, ate: hoje};
  }
}

export function validarFiltro({de, ate}: FiltroRelatorio): string | null {
  if (!dataISOValida(de) || !dataISOValida(ate)) {
    return 'Escolha datas válidas.';
  }
  if (de > ate) {
    return 'A data inicial precisa ser antes da final.';
  }
  // Comparação de texto: 29/02 + 3 anos vira "AAAA-02-29", que ainda ordena certo.
  const limite = `${Number(de.slice(0, 4)) + MAX_ANOS_RELATORIO}${de.slice(4)}`;
  if (ate > limite) {
    return `O período pode ter no máximo ${MAX_ANOS_RELATORIO} anos.`;
  }
  return null;
}

export function atendeAoFiltro(
  {de, ate, tipo, categoria}: FiltroRelatorio,
  transacao: Transacao,
): boolean {
  return (
    transacao.data >= de &&
    transacao.data <= ate &&
    (tipo === 'todos' || transacao.tipo === tipo) &&
    (categoria === null || transacao.categoria === categoria)
  );
}

export function montarRelatorio(
  filtro: FiltroRelatorio,
  transacoes: Transacao[],
): Relatorio {
  const filtradas = transacoes.filter(t => atendeAoFiltro(filtro, t));
  const somar = (lista: Transacao[]) =>
    lista.reduce((total, t) => total + t.valorCentavos, 0);
  const despesas = filtradas.filter(t => t.tipo === 'despesa');
  const totalReceitas = somar(filtradas.filter(t => t.tipo === 'receita'));
  const totalDespesas = somar(despesas);

  const porId = new Map<string, number>();
  for (const {categoria, valorCentavos} of despesas) {
    porId.set(categoria, (porId.get(categoria) ?? 0) + valorCentavos);
  }
  const porCategoria: GastoCategoria[] = [...porId]
    .map(([categoria, totalCentavos]) => ({
      categoria,
      totalCentavos,
      percentual: totalDespesas > 0 ? totalCentavos / totalDespesas : 0,
    }))
    .sort(
      (a, b) =>
        b.totalCentavos - a.totalCentavos ||
        a.categoria.localeCompare(b.categoria),
    );

  return {
    filtro,
    transacoes: filtradas,
    totalReceitas,
    totalDespesas,
    resultado: totalReceitas - totalDespesas,
    quantidade: filtradas.length,
    porCategoria,
  };
}

const BOM = '﻿';
const SEPARADOR = ';';
const QUEBRA = '\r\n';

// Prefixo contra injeção de fórmula: o Excel executaria "=..." ao abrir.
// Tab e CR também iniciam fórmula em algumas planilhas (recomendação OWASP).
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;

function celulaDeTexto(valor: string): string {
  const seguro = INICIO_DE_FORMULA.test(valor) ? `'${valor}` : valor;
  return /[;"\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

// Sem separador de milhar: o Excel em pt-BR lê "1250,00" como número.
function valorCsv(centavos: number): string {
  const sinal = centavos < 0 ? '-' : '';
  const absoluto = Math.abs(centavos);
  const reais = Math.floor(absoluto / 100);
  return `${sinal}${reais},${String(absoluto % 100).padStart(2, '0')}`;
}

export function rotuloCategoria(
  transacao: Pick<Transacao, 'tipo' | 'categoria'>,
) {
  return (
    buscarCategoria(transacao.tipo, transacao.categoria)?.label ??
    transacao.categoria
  );
}

export function gerarCsv(relatorio: Relatorio): string {
  const cabecalho = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor'];
  const linhas = relatorio.transacoes.map(t =>
    [
      celulaDeTexto(formatarDataCurta(t.data)),
      celulaDeTexto(t.descricao),
      celulaDeTexto(rotuloCategoria(t)),
      celulaDeTexto(t.tipo === 'receita' ? 'Receita' : 'Despesa'),
      // O valor é sempre número: o "-" da despesa não pode virar "'-".
      valorCsv(t.tipo === 'despesa' ? -t.valorCentavos : t.valorCentavos),
    ].join(SEPARADOR),
  );
  return BOM + [cabecalho.join(SEPARADOR), ...linhas].join(QUEBRA) + QUEBRA;
}

export function nomeArquivo(
  {de, ate}: FiltroRelatorio,
  extensao: 'pdf' | 'csv',
): string {
  return `financaconsciente-${de}-a-${ate}.${extensao}`;
}
