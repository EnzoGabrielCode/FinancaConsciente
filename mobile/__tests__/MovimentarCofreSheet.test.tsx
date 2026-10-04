import 'react-native';
import React from 'react';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {PaperProvider} from 'react-native-paper';
import renderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import type {Cofre, MovimentoCofre} from '../src/domain/entities/Cofre';
import MovimentarCofreSheet from '../src/presentation/components/MovimentarCofreSheet';
import {darkTheme} from '../src/presentation/theme';

type Operacao = (cofreId: number, valorCentavos: number) => Promise<void>;

const viagem: Cofre = {
  id: 4,
  nome: 'Viagem',
  icone: '✈️',
  cor: '#64B5F6',
  metaCentavos: 800000,
  saldoCentavos: 30000,
};

const movimentos: MovimentoCofre[] = [
  {
    id: 2,
    cofreId: 4,
    tipo: 'retirada',
    valorCentavos: 20000,
    data: '2026-10-02',
  },
  {
    id: 1,
    cofreId: 4,
    tipo: 'deposito',
    valorCentavos: 50000,
    data: '2026-09-28',
  },
];

let tree: ReactTestRenderer;
let onGuardar: jest.Mock<Operacao>;
let onRetirar: jest.Mock<Operacao>;
let onFechar: jest.Mock<() => void>;
let carregarMovimentos: jest.Mock<
  (cofreId: number, limite: number) => Promise<MovimentoCofre[]>
>;

async function renderizar(disponivelCentavos = 100000) {
  await act(async () => {
    tree = renderer.create(
      <PaperProvider theme={darkTheme}>
        <MovimentarCofreSheet
          visivel
          cofre={viagem}
          disponivelCentavos={disponivelCentavos}
          carregarMovimentos={carregarMovimentos}
          onFechar={onFechar}
          onGuardar={onGuardar}
          onRetirar={onRetirar}
        />
      </PaperProvider>,
    );
  });
}

const comId = (id: string) => tree.root.findAll(no => no.props.testID === id);

function textoDe(no: ReactTestInstance): string {
  return no.children
    .map(filho => (typeof filho === 'string' ? filho : textoDe(filho)))
    .join('');
}

const texto = (id: string) => textoDe(comId(id)[0]);

const tocavel = (id: string) =>
  tree.root.findAll(
    no => no.props.testID === id && typeof no.props.onPress === 'function',
  )[0];

async function tocar(id: string) {
  await act(async () => {
    await tocavel(id).props.onPress();
  });
}

async function digitar(...teclas: string[]) {
  for (const tecla of teclas) {
    await tocar(`tecla-${tecla}`);
  }
}

describe('MovimentarCofreSheet', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    onGuardar = jest.fn<Operacao>(async () => {});
    onRetirar = jest.fn<Operacao>(async () => {});
    onFechar = jest.fn();
    carregarMovimentos = jest.fn(async () => movimentos);
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
      tree.unmount();
    });
    jest.useRealTimers();
  });

  it('mostra o cofre, o guardado e o disponível', async () => {
    await renderizar();

    expect(texto('movimentar-titulo')).toBe('✈️ Viagem');
    expect(texto('movimentar-guardado')).toBe('Guardado: R$ 300,00');
    expect(texto('movimentar-limite')).toBe(
      'Disponível para guardar: R$ 1.000,00',
    );
    expect(tocavel('movimentar-confirmar').props.disabled).toBe(true);
  });

  it('digitar 500 e "Guardar" chama guardar com 50000', async () => {
    await renderizar();

    await digitar('5', '0', '0');
    expect(texto('movimentar-valor')).toBe('500');
    expect(texto('movimentar-confirmar')).toBe('Guardar R$ 500,00');
    await tocar('movimentar-confirmar');

    expect(onGuardar).toHaveBeenCalledWith(4, 50000);
    expect(onRetirar).not.toHaveBeenCalled();
  });

  it('em Retirar mostra o limite do cofre e chama retirar', async () => {
    await renderizar();

    await tocar('movimento-retirada');
    expect(texto('movimentar-limite')).toBe('Pode retirar até R$ 300,00');
    await digitar('2', '0', '0');
    expect(texto('movimentar-confirmar')).toBe('Retirar R$ 200,00');
    await tocar('movimentar-confirmar');

    expect(onRetirar).toHaveBeenCalledWith(4, 20000);
    expect(onGuardar).not.toHaveBeenCalled();
  });

  it('erro do caso de uso aparece e a folha continua aberta', async () => {
    onGuardar.mockRejectedValueOnce(
      new Error('Você tem só R$ 1.000,00 disponível.'),
    );
    await renderizar();

    await digitar('2', '0', '0', '0');
    await tocar('movimentar-confirmar');

    expect(texto('movimentar-erro')).toBe(
      'Você tem só R$ 1.000,00 disponível.',
    );
    expect(onFechar).not.toHaveBeenCalled();
    expect(comId('movimentar-cofre-sheet')).not.toEqual([]);
    expect(texto('movimentar-valor')).toBe('2.000');
  });

  it('lista os últimos movimentos com sinal e cor', async () => {
    await renderizar();

    expect(carregarMovimentos).toHaveBeenCalledWith(4, 5);
    expect(texto('movimento-valor-1')).toBe('+R$ 500,00');
    expect(texto('movimento-valor-2')).toBe('-R$ 200,00');
    expect(comId('movimento-valor-1')[0].props.style).toEqual(
      expect.arrayContaining([{color: '#39FF84'}]),
    );
    expect(comId('movimento-valor-2')[0].props.style).toEqual(
      expect.arrayContaining([{color: '#FFB74D'}]),
    );
  });
});
