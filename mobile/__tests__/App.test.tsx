import 'react-native';
import React from 'react';
import {expect, it} from '@jest/globals';
import renderer, {act, type ReactTestRenderer} from 'react-test-renderer';

import App from '../App';

it('abre o banco local e mostra que ele está pronto', async () => {
  let tree: ReactTestRenderer | undefined;
  await act(async () => {
    tree = renderer.create(<App />);
  });

  const status = tree!.root.findByProps({testID: 'database-status'});
  const text = [status.props.children].flat().join('');
  expect(text).toBe('Banco pronto (schema v2)');
});
