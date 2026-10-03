import 'react-native';
import React from 'react';
import {afterEach, beforeEach, expect, it, jest} from '@jest/globals';
import renderer, {act, type ReactTestRenderer} from 'react-test-renderer';

import App from '../App';

let tree: ReactTestRenderer;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(async () => {
  await act(async () => {
    jest.runOnlyPendingTimers();
    tree.unmount();
  });
  jest.useRealTimers();
});

it('abre o banco local e mostra o painel zerado sem aviso de erro', async () => {
  await act(async () => {
    tree = renderer.create(<App />);
  });

  expect(tree.root.findAll(no => no.props.testID === 'database-card')).toEqual(
    [],
  );
  const texto = (id: string) =>
    [tree.root.findByProps({testID: id}).props.children].flat().join('');
  expect(
    tree.root.findByProps({testID: 'disponivel'}).props.accessibilityLabel,
  ).toBe('Disponível: R$ 0,00');
  expect(texto('receitas-mes')).toBe('+R$ 0,00');
  expect(tree.root.findAllByProps({testID: 'grafico-vazio'})).not.toEqual([]);
  expect(tree.root.findAllByProps({testID: 'selo-variacao'})).toEqual([]);
});

it('mostra a lista vazia', async () => {
  await act(async () => {
    tree = renderer.create(<App />);
  });

  const texto = (id: string) =>
    [tree.root.findByProps({testID: id}).props.children].flat().join('');
  expect(texto('lista-vazia')).toBe(
    'Nenhum lançamento ainda. Toque no + para começar.',
  );
});
