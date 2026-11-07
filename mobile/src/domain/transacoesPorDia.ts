import {formatarCabecalhoDia} from './datas';
import type {Transacao} from './entities/Transacao';

export type ItemListaTransacoes =
  | {tipo: 'dia'; data: string; rotulo: string}
  | {tipo: 'transacao'; transacao: Transacao};

// Espera a lista já ordenada por data, como vem do repositório.
export function agruparPorDia(
  transacoes: Transacao[],
  hoje: Date = new Date(),
): ItemListaTransacoes[] {
  const itens: ItemListaTransacoes[] = [];
  let diaAtual: string | null = null;
  for (const transacao of transacoes) {
    if (transacao.data !== diaAtual) {
      diaAtual = transacao.data;
      itens.push({
        tipo: 'dia',
        data: diaAtual,
        rotulo: formatarCabecalhoDia(diaAtual, hoje),
      });
    }
    itens.push({tipo: 'transacao', transacao});
  }
  return itens;
}
