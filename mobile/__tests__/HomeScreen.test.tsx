import 'react-native';
import React from 'react';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {PaperProvider} from 'react-native-paper';
import renderer, {act, type ReactTestRenderer} from 'react-test-renderer';

import type {ArmazenamentoComprovantes} from '../src/domain/repositories/ArmazenamentoComprovantes';
import type {CofreRepository} from '../src/domain/repositories/CofreRepository';
import type {TransacaoRepository} from '../src/domain/repositories/TransacaoRepository';
import HomeScreen from '../src/presentation/screens/HomeScreen';
import {darkTheme} from '../src/presentation/theme';

// Repositórios vazios em memória: a barra não depende dos dados.
const repositorio: TransacaoRepository = {
  listarRecentes: async () => [],
  buscarPorId: async () => null,
  criar: async () => 1,
  atualizar: async () => {},
  excluir: async () => {},
  saldoAte: async () => 0,
  totaisPorMes: async () => [],
  buscarCandidatasDuplicata: async () => [],
};

const repositorioCofres: CofreRepository = {
  listar: async () => [],
  buscarPorId: async () => null,
  criar: async () => 1,
  atualizar: async () => {},
  excluir: async () => {},
  registrarMovimento: async () => 1,
  listarMovimentos: async () => [],
  totalGuardado: async () => 0,
};

const armazenamento: ArmazenamentoComprovantes = {
  guardar: async uri => uri,
  apagar: async () => {},
  ehDefinitivo: () => true,
};

let tree: ReactTestRenderer;

async function renderizar() {
  await act(async () => {
    tree = renderer.create(
      <PaperProvider theme={darkTheme}>
        <HomeScreen
          repositorio={repositorio}
          armazenamento={armazenamento}
          repositorioCofres={repositorioCofres}
        />
      </PaperProvider>,
    );
  });
}

const aba = (id: string) =>
  tree.root.find(
    no => no.props.testID === id && no.props.accessibilityRole === 'tab',
  );

const temTexto = (texto: string) =>
  tree.root.findAll(no => no.props.children === texto).length > 0;

describe('HomeScreen: barra de navegação', () => {
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

  it('mostra as quatro abas com Início selecionada', async () => {
    await renderizar();

    expect(aba('aba-inicio').props.accessibilityState).toEqual({
      selected: true,
    });
    for (const id of ['aba-planejamento', 'aba-desafios', 'aba-assistente']) {
      expect(aba(id).props.accessibilityState).toEqual({selected: false});
    }
  });

  it('avisa "Disponível em breve" ao tocar numa aba inativa', async () => {
    await renderizar();
    expect(temTexto('Disponível em breve')).toBe(false);

    await act(async () => {
      aba('aba-planejamento').props.onPress();
    });

    expect(temTexto('Disponível em breve')).toBe(true);
  });
});
