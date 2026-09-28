import 'react-native';
import React from 'react';
import App from '../App';
import {it} from '@jest/globals';
import renderer, {act} from 'react-test-renderer';

it('renderiza a tela inicial', async () => {
  await act(async () => {
    renderer.create(<App />);
  });
});
