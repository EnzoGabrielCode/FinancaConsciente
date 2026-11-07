import {describe, expect, it} from '@jest/globals';

import type {Transacao} from '../src/domain/entities/Transacao';
import {agruparPorDia} from '../src/domain/transacoesPorDia';

const transacao = (id: number, data: string): Transacao => ({
  id,
  tipo: 'despesa',
  descricao: `Lançamento ${id}`,
  valorCentavos: 1000,
  data,
  categoria: 'outros',
  recorrencia: 'variavel',
  comprovanteUri: null,
  sincronizado: false,
});

const hoje = new Date(2026, 9, 14);

describe('agruparPorDia', () => {
  it('devolve lista vazia para lista vazia', () => {
    expect(agruparPorDia([], hoje)).toEqual([]);
  });

  it('coloca os cabeçalhos na ordem das transações', () => {
    const itens = agruparPorDia(
      [
        transacao(4, '2026-10-14'),
        transacao(3, '2026-10-13'),
        transacao(2, '2026-10-12'),
        transacao(1, '2025-12-30'),
      ],
      hoje,
    );

    expect(
      itens.flatMap(item => (item.tipo === 'dia' ? [item.rotulo] : [])),
    ).toEqual(['Hoje', 'Ontem', '12 de out.', '30 de dez. de 2025']);
  });

  it('agrupa as transações do mesmo dia sob um único cabeçalho', () => {
    const primeira = transacao(3, '2026-10-12');
    const segunda = transacao(2, '2026-10-12');
    const outroDia = transacao(1, '2026-10-11');

    expect(agruparPorDia([primeira, segunda, outroDia], hoje)).toEqual([
      {tipo: 'dia', data: '2026-10-12', rotulo: '12 de out.'},
      {tipo: 'transacao', transacao: primeira},
      {tipo: 'transacao', transacao: segunda},
      {tipo: 'dia', data: '2026-10-11', rotulo: '11 de out.'},
      {tipo: 'transacao', transacao: outroDia},
    ]);
  });
});
