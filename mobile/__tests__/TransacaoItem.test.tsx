import React from 'react';
import {afterEach, describe, expect, it, jest} from '@jest/globals';
import {PanResponder, type PanResponderCallbacks} from 'react-native';
import {PaperProvider} from 'react-native-paper';
import renderer, {act, type ReactTestRenderer} from 'react-test-renderer';

import type {Transacao} from '../src/domain/entities/Transacao';
import TransacaoItem from '../src/presentation/components/TransacaoItem';
import {darkTheme} from '../src/presentation/theme';

const transacao = (id: number): Transacao => ({
  id,
  tipo: 'despesa',
  descricao: `Lançamento ${id}`,
  valorCentavos: 1000,
  data: '2026-10-01',
  categoria: 'outros',
  recorrencia: 'variavel',
  comprovanteUri: null,
  contaRecorrenteId: null,
  idExterno: null,
  sincronizado: false,
});

describe('TransacaoItem', () => {
  let tree: ReactTestRenderer;

  afterEach(() => {
    jest.restoreAllMocks();
    act(() => tree.unmount());
  });

  const tocar = (id: number) =>
    act(() =>
      tree.root
        .find(
          no =>
            no.props.testID === `abrir-${id}` &&
            no.props.accessibilityRole === 'button' &&
            typeof no.props.onPress === 'function',
        )
        .props.onPress(),
    );

  it('fecha o deslize quando a célula é reciclada para outra transação', () => {
    const criarResponder = jest.spyOn(PanResponder, 'create');
    const onPress = jest.fn();
    const onExcluir = jest.fn();
    const item = (id: number) => (
      <PaperProvider theme={darkTheme}>
        <TransacaoItem
          transacao={transacao(id)}
          onPress={onPress}
          onExcluir={onExcluir}
        />
      </PaperProvider>
    );
    act(() => {
      tree = renderer.create(item(1));
    });

    const gestos = criarResponder.mock.calls[0][0] as PanResponderCallbacks;
    act(() => {
      gestos.onPanResponderRelease?.({} as never, {dx: -100, vx: -1} as never);
    });
    tocar(1); // aberto: o toque só fecha
    expect(onPress).not.toHaveBeenCalled();

    act(() => {
      gestos.onPanResponderRelease?.({} as never, {dx: -100, vx: -1} as never);
    });
    act(() => tree.update(item(2)));
    tocar(2);

    expect(onPress).toHaveBeenCalledWith(transacao(2));
  });

  describe('ícone de conta fixa', () => {
    const renderizar = (dados: Partial<Transacao>) =>
      act(() => {
        tree = renderer.create(
          <PaperProvider theme={darkTheme}>
            <TransacaoItem
              transacao={{...transacao(1), ...dados}}
              onPress={() => {}}
              onExcluir={() => {}}
            />
          </PaperProvider>,
        );
      });

    const icones = () =>
      tree.root.findAll(
        no =>
          typeof no.type === 'string' && no.props.testID === 'icone-conta-fixa',
      );

    it('aparece na despesa gerada por uma conta', () => {
      renderizar({contaRecorrenteId: 7});

      expect(icones()).toHaveLength(1);
      expect(icones()[0].props.accessibilityLabel).toBe('conta fixa');
    });

    it('entra no rótulo lido pelo leitor de tela', () => {
      renderizar({contaRecorrenteId: 7});

      const [item] = tree.root.findAll(
        no =>
          no.props.testID === 'abrir-1' &&
          typeof no.props.accessibilityLabel === 'string',
      );
      expect(item.props.accessibilityLabel).toContain(', conta fixa');
    });

    it('não aparece sem vínculo', () => {
      renderizar({contaRecorrenteId: null});
      expect(icones()).toHaveLength(0);
    });
  });
});
