import {DateTimePickerAndroid} from '@react-native-community/datetimepicker';

import {hojeISO} from '../../domain/datas';

export interface SeletorData {
  escolher(atual: string, maxima: string): Promise<string | null>;
}

// Meio-dia no fuso do aparelho: "YYYY-MM-DD" direto no Date vira UTC e, no
// Brasil, cairia no dia anterior.
export function paraDate(dataISO: string): Date {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  return new Date(ano, mes - 1, dia, 12);
}

export const seletorDataPadrao: SeletorData = {
  escolher: (atual, maxima) =>
    new Promise(resolve => {
      DateTimePickerAndroid.open({
        value: paraDate(atual),
        maximumDate: paraDate(maxima),
        mode: 'date',
        onChange: (evento, data) =>
          resolve(evento.type === 'set' && data ? hojeISO(data) : null),
      });
    }),
};
