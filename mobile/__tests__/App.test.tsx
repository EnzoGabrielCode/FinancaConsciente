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

it('abre o banco local e mostra que ele está pronto', async () => {
  await act(async () => {
    tree = renderer.create(<App />);
  });

  const status = tree.root.findByProps({testID: 'database-status'});
  const text = [status.props.children].flat().join('');
  expect(text).toBe('Banco pronto (schema v2)');
});

it('mostra a lista vazia e o total de receitas zerado', async () => {
  await act(async () => {
    tree = renderer.create(<App />);
  });

  const texto = (id: string) =>
    [tree.root.findByProps({testID: id}).props.children].flat().join('');
  expect(texto('lista-vazia')).toBe(
    'Nenhum lançamento ainda. Toque no + para começar.',
  );
  expect(texto('total-receitas')).toBe('R$ 0,00');
});
