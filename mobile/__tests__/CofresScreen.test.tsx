import React from 'react';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {PaperProvider} from 'react-native-paper';
import renderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import {resumoCofres} from '../src/domain/cofres';
import type {Cofre} from '../src/domain/entities/Cofre';
import type {UseCofres} from '../src/presentation/hooks/useCofres';
import CofresScreen from '../src/presentation/screens/CofresScreen';
import {darkTheme} from '../src/presentation/theme';

const HOJE = '2026-11-07';

const meta = (id: number, prazo: string | null, saldoCentavos = 0): Cofre => ({
  id,
  nome: `Cofre ${id}`,
  icone: '💰',
  cor: '#39FF84',
  metaCentavos: 100000,
  prazo,
  saldoCentavos,
});

describe('CofresScreen: total mensal das metas', () => {
  let tree: ReactTestRenderer;

  beforeEach(() => {
    jest.useFakeTimers({now: new Date(2026, 10, 7, 12)});
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
      tree.unmount();
    });
    jest.useRealTimers();
  });

  async function renderizar(cofres: Cofre[]) {
    const dados = {
      cofres,
      resumo: resumoCofres(cofres, HOJE),
      disponivelCentavos: 0,
      carregando: false,
      erro: null,
    } as unknown as UseCofres;
    await act(async () => {
      tree = renderer.create(
        <PaperProvider theme={darkTheme}>
          <CofresScreen visivel cofres={dados} onFechar={() => {}} />
        </PaperProvider>,
      );
    });
  }

  const linha = () =>
    tree.root.findAll(
      no =>
        typeof no.type === 'string' &&
        no.props.testID === 'cofres-total-mensal',
    );

  function textoDe(no: ReactTestInstance): string {
    return no.children
      .map(filho => (typeof filho === 'string' ? filho : textoDe(filho)))
      .join('');
  }

  it('mostra quanto guardar por mês para cumprir as metas', async () => {
    await renderizar([meta(1, '2027-01'), meta(2, null)]);
    expect(textoDe(linha()[0])).toBe('Para cumprir suas metas: R$ 333,34/mês');
  });

  it('esconde a linha sem metas em andamento', async () => {
    await renderizar([
      meta(1, null),
      meta(2, '2026-10'),
      meta(3, '2027-01', 100000),
    ]);
    expect(linha()).toHaveLength(0);
  });
});
