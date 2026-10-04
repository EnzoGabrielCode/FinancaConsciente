import {describe, expect, it} from '@jest/globals';

import {
  JANELA_DUPLICATA_MINUTOS,
  filtrarDuplicatas,
  horaLocal,
} from '../src/domain/duplicatas';
import type {CandidataDuplicata} from '../src/domain/entities/Duplicata';
import type {DadosTransacao, Transacao} from '../src/domain/entities/Transacao';

const AGORA = new Date('2026-10-03T15:00:00.000Z');

const minutosAtras = (minutos: number) =>
  new Date(AGORA.getTime() - minutos * 60 * 1000).toISOString();

const nova: DadosTransacao = {
  tipo: 'despesa',
  descricao: 'Mercado',
  valorCentavos: 8990,
  data: '2026-10-03',
  categoria: 'alimentacao',
  recorrencia: 'variavel',
  comprovanteUri: null,
};

let proximoId = 1;

function candidata(
  parcial: Partial<Transacao> = {},
  criadoEm = minutosAtras(60),
): CandidataDuplicata {
  return {
    transacao: {...nova, id: proximoId++, sincronizado: false, ...parcial},
    criadoEm,
  };
}

describe('filtrarDuplicatas', () => {
  it('usa a janela de 10 minutos', () => {
    expect(JANELA_DUPLICATA_MINUTOS).toBe(10);
  });

  it('mesma categoria no mesmo dia gera alerta "mesma-categoria"', () => {
    const existente = candidata({}, minutosAtras(300));

    expect(filtrarDuplicatas(nova, [existente], AGORA)).toEqual([
      {...existente, motivo: 'mesma-categoria'},
    ]);
  });

  it('categoria diferente lançada há 2 minutos gera "lancada-agora"', () => {
    const existente = candidata({categoria: 'transporte'}, minutosAtras(2));

    expect(filtrarDuplicatas(nova, [existente], AGORA)).toEqual([
      {...existente, motivo: 'lancada-agora'},
    ]);
  });

  it('categoria diferente há 11 minutos não gera alerta', () => {
    const existente = candidata({categoria: 'transporte'}, minutosAtras(11));

    expect(filtrarDuplicatas(nova, [existente], AGORA)).toEqual([]);
  });

  it('exatamente 10 minutos ainda conta como lançada agora', () => {
    const existente = candidata({categoria: 'transporte'}, minutosAtras(10));

    expect(filtrarDuplicatas(nova, [existente], AGORA)).toEqual([
      {...existente, motivo: 'lancada-agora'},
    ]);
  });

  it('data diferente não gera alerta', () => {
    const existente = candidata({data: '2026-10-02'}, minutosAtras(1));

    expect(filtrarDuplicatas(nova, [existente], AGORA)).toEqual([]);
  });

  it('valor diferente não gera alerta', () => {
    const existente = candidata({valorCentavos: 8991}, minutosAtras(1));

    expect(filtrarDuplicatas(nova, [existente], AGORA)).toEqual([]);
  });

  it('nova receita devolve lista vazia', () => {
    const existente = candidata({tipo: 'receita'}, minutosAtras(1));

    expect(
      filtrarDuplicatas({...nova, tipo: 'receita'}, [existente], AGORA),
    ).toEqual([]);
  });

  it('ignora candidata do tipo receita', () => {
    const existente = candidata({tipo: 'receita'}, minutosAtras(1));

    expect(filtrarDuplicatas(nova, [existente], AGORA)).toEqual([]);
  });

  it('ordena da mais recente para a mais antiga', () => {
    const antiga = candidata({}, minutosAtras(120));
    const recente = candidata({categoria: 'transporte'}, minutosAtras(1));
    const meio = candidata({}, minutosAtras(30));

    expect(
      filtrarDuplicatas(nova, [antiga, recente, meio], AGORA).map(
        d => d.transacao.id,
      ),
    ).toEqual([recente.transacao.id, meio.transacao.id, antiga.transacao.id]);
  });

  it('criadoEm inválido não conta como recente, mas a mesma categoria ainda alerta', () => {
    const outraCategoria = candidata({categoria: 'transporte'}, 'ontem');
    const mesmaCategoria = candidata({}, 'invalido');
    const valida = candidata({}, minutosAtras(5));

    expect(
      filtrarDuplicatas(nova, [outraCategoria, mesmaCategoria, valida], AGORA),
    ).toEqual([
      {...valida, motivo: 'mesma-categoria'},
      {...mesmaCategoria, motivo: 'mesma-categoria'},
    ]);
  });

  it('usa o horário atual quando "agora" não é informado', () => {
    const existente = candidata(
      {categoria: 'transporte'},
      new Date().toISOString(),
    );

    expect(filtrarDuplicatas(nova, [existente])).toHaveLength(1);
  });
});

describe('horaLocal', () => {
  it('formata a hora local com zero à esquerda', () => {
    const criadoEm = new Date(2026, 9, 3, 7, 5).toISOString();

    expect(horaLocal(criadoEm)).toBe('07:05');
  });

  it('formata a tarde em 24 horas', () => {
    expect(horaLocal(new Date(2026, 9, 3, 14, 32).toISOString())).toBe('14:32');
  });

  it('devolve texto vazio para data inválida', () => {
    expect(horaLocal('nada')).toBe('');
  });
});
