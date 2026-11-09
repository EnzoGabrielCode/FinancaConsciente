import {describe, expect, it, jest} from '@jest/globals';
import {DateTimePickerAndroid} from '@react-native-community/datetimepicker';

import {
  paraDate,
  seletorDataPadrao,
} from '../src/presentation/servicos/seletorData';

const abrir = DateTimePickerAndroid.open as unknown as jest.Mock;

type Opcoes = {
  value: Date;
  maximumDate: Date;
  mode: string;
  onChange: (evento: {type: string}, data?: Date) => void;
};

describe('seletorDataPadrao', () => {
  it('abre o calendário com a data atual e o máximo, ao meio-dia local', async () => {
    abrir.mockImplementationOnce(opcoes => {
      const {onChange} = opcoes as Opcoes;
      onChange({type: 'set'}, new Date(2026, 10, 3, 12));
    });

    await expect(
      seletorDataPadrao.escolher('2026-11-05', '2026-11-08'),
    ).resolves.toBe('2026-11-03');

    const {value, maximumDate, mode} = abrir.mock.calls[0][0] as Opcoes;
    expect(mode).toBe('date');
    expect(value).toEqual(new Date(2026, 10, 5, 12));
    expect(maximumDate).toEqual(new Date(2026, 10, 8, 12));
  });

  it('fechar sem escolher devolve null', async () => {
    abrir.mockImplementationOnce(opcoes =>
      (opcoes as Opcoes).onChange({type: 'dismissed'}),
    );
    await expect(
      seletorDataPadrao.escolher('2026-11-05', '2026-11-08'),
    ).resolves.toBeNull();
  });

  it('paraDate não volta um dia por causa do fuso', () => {
    const data = paraDate('2026-11-03');
    expect([data.getFullYear(), data.getMonth(), data.getDate()]).toEqual([
      2026, 10, 3,
    ]);
  });
});
