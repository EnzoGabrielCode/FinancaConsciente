import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {formatarCentavos} from '../../domain/dinheiro';
import type {MesSerie} from '../../domain/entities/Dashboard';
import {CORES} from '../theme/cores';
import {FONTES} from '../theme/fontes';

interface Props {
  serie: MesSerie[];
}

export const ALTURA_GRAFICO = 64;
const ALTURA_MINIMA = 2;

export function alturaDaBarra(valorCentavos: number, altura: number): number {
  if (valorCentavos <= 0) {
    return 0;
  }
  return Math.max(ALTURA_MINIMA, altura * ALTURA_GRAFICO);
}

function GraficoMensal({serie}: Props): React.JSX.Element {
  const vazio = serie.every(
    mes => mes.receitasCentavos === 0 && mes.despesasCentavos === 0,
  );

  if (vazio) {
    return (
      <View testID="grafico-vazio">
        <View style={[styles.area, styles.areaVazia]}>
          <Text style={styles.textoVazio}>
            Sem lançamentos nos últimos meses
          </Text>
        </View>
        <View style={styles.base} />
      </View>
    );
  }

  const indiceAtual = serie.length - 1;

  return (
    <View>
      <View style={styles.colunas}>
        {serie.map((mes, indice) => (
          <View
            key={mes.anoMes}
            style={styles.coluna}
            accessible
            accessibilityLabel={`${mes.rotulo}: receitas ${formatarCentavos(
              mes.receitasCentavos,
            )}, despesas ${formatarCentavos(mes.despesasCentavos)}`}
            testID={`grafico-mes-${mes.anoMes}`}>
            <View style={styles.area}>
              <View
                style={[
                  styles.barra,
                  styles.barraReceita,
                  {
                    height: alturaDaBarra(
                      mes.receitasCentavos,
                      mes.alturaReceita,
                    ),
                  },
                ]}
                testID={`barra-receita-${mes.anoMes}`}
              />
              <View
                style={[
                  styles.barra,
                  styles.barraDespesa,
                  {
                    height: alturaDaBarra(
                      mes.despesasCentavos,
                      mes.alturaDespesa,
                    ),
                  },
                ]}
                testID={`barra-despesa-${mes.anoMes}`}
              />
            </View>
            <View style={styles.base} />
            <Text
              style={[
                styles.rotulo,
                indice === indiceAtual && styles.rotuloAtual,
              ]}>
              {mes.rotulo}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  colunas: {
    flexDirection: 'row',
  },
  coluna: {
    flex: 1,
    alignItems: 'stretch',
  },
  area: {
    height: ALTURA_GRAFICO,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 3,
  },
  areaVazia: {
    alignItems: 'center',
  },
  barra: {
    width: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barraReceita: {
    backgroundColor: CORES.verde,
  },
  barraDespesa: {
    backgroundColor: CORES.vermelho,
  },
  base: {
    height: 1,
    backgroundColor: CORES.borda,
  },
  rotulo: {
    marginTop: 6,
    fontFamily: FONTES.regular,
    fontSize: 10,
    textAlign: 'center',
    color: CORES.textoApagado,
  },
  rotuloAtual: {
    color: CORES.texto,
  },
  textoVazio: {
    fontFamily: FONTES.regular,
    fontSize: 12,
    color: CORES.textoApagado,
  },
});

export default GraficoMensal;
