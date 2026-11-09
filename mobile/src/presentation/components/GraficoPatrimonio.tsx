import React, {useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {nomeMesAno, rotuloMes} from '../../domain/datas';
import {formatarCentavos} from '../../domain/dinheiro';
import type {PontoPatrimonio} from '../../domain/entities/Relatorio';
import {CORES, comAlfa} from '../theme/cores';
import {FONTES} from '../theme/fontes';

interface Props {
  serie: PontoPatrimonio[];
}

export const ALTURA_GRAFICO_PATRIMONIO = 120;
const ALTURA_MINIMA = 2;

export interface AreasGrafico {
  acima: number;
  abaixo: number;
}

// Divide a altura entre a parte positiva e a negativa, na proporção dos
// maiores valores: a linha do zero fica onde a escala manda.
export function areasDoGrafico(
  serie: PontoPatrimonio[],
  altura = ALTURA_GRAFICO_PATRIMONIO,
): AreasGrafico {
  const valores = serie.map(p => p.patrimonioCentavos);
  const maiorPositivo = Math.max(0, ...valores);
  const maiorNegativo = Math.max(0, ...valores.map(v => -v));
  const total = maiorPositivo + maiorNegativo;
  if (total === 0) {
    return {acima: altura, abaixo: 0};
  }
  const acima = (altura * maiorPositivo) / total;
  return {acima, abaixo: altura - acima};
}

export function alturaDaColuna(
  valor: number,
  maiorDoLado: number,
  area: number,
): number {
  if (valor === 0 || maiorDoLado === 0) {
    return 0;
  }
  return Math.max(ALTURA_MINIMA, (Math.abs(valor) / maiorDoLado) * area);
}

function GraficoPatrimonio({serie}: Props): React.JSX.Element {
  const indiceAtual = serie.length - 1;
  const [selecionado, setSelecionado] = useState(indiceAtual);

  useEffect(() => {
    setSelecionado(serie.length - 1);
  }, [serie]);

  const {acima, abaixo} = areasDoGrafico(serie);
  const valores = serie.map(p => p.patrimonioCentavos);
  const maiorPositivo = Math.max(0, ...valores);
  const maiorNegativo = Math.max(0, ...valores.map(v => -v));
  const pontoSelecionado = serie[selecionado];

  return (
    <View testID="grafico-patrimonio">
      {pontoSelecionado && (
        <Text style={styles.selecionado} testID="grafico-patrimonio-valor">
          {nomeMesAno(pontoSelecionado.anoMes)}:{' '}
          <Text
            style={[
              styles.valorSelecionado,
              pontoSelecionado.patrimonioCentavos < 0 && styles.negativo,
            ]}>
            {formatarCentavos(pontoSelecionado.patrimonioCentavos)}
          </Text>
        </Text>
      )}
      <View style={styles.colunas}>
        {serie.map((ponto, indice) => {
          const valor = ponto.patrimonioCentavos;
          const atual = indice === indiceAtual;
          const ativo = indice === selecionado;
          const cor = valor < 0 ? CORES.vermelho : CORES.verde;
          return (
            <Pressable
              key={ponto.anoMes}
              onPress={() => setSelecionado(indice)}
              style={styles.coluna}
              accessibilityRole="button"
              accessibilityState={{selected: ativo}}
              accessibilityLabel={`${nomeMesAno(
                ponto.anoMes,
              )}: ${formatarCentavos(valor)}`}
              testID={`patrimonio-mes-${ponto.anoMes}`}>
              <View style={[styles.area, styles.areaAcima, {height: acima}]}>
                {valor > 0 && (
                  <View
                    style={[
                      styles.barra,
                      styles.barraAcima,
                      {
                        height: alturaDaColuna(valor, maiorPositivo, acima),
                        backgroundColor:
                          atual || ativo ? cor : comAlfa(cor, 0.45),
                      },
                    ]}
                    testID={`patrimonio-barra-${ponto.anoMes}`}
                  />
                )}
              </View>
              <View style={styles.base} />
              <View style={[styles.area, {height: abaixo}]}>
                {valor < 0 && (
                  <View
                    style={[
                      styles.barra,
                      styles.barraAbaixo,
                      {
                        height: alturaDaColuna(valor, maiorNegativo, abaixo),
                        backgroundColor:
                          atual || ativo ? cor : comAlfa(cor, 0.45),
                      },
                    ]}
                    testID={`patrimonio-barra-${ponto.anoMes}`}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.rotulo,
                  atual && styles.rotuloAtual,
                  ativo && styles.rotuloAtivo,
                ]}>
                {rotuloMes(ponto.anoMes)}.
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  selecionado: {
    marginBottom: 12,
    fontFamily: FONTES.regular,
    fontSize: 12,
    color: CORES.textoSecundario,
  },
  valorSelecionado: {
    fontFamily: FONTES.monoNegrito,
    color: CORES.texto,
  },
  negativo: {
    color: CORES.vermelho,
  },
  colunas: {
    flexDirection: 'row',
  },
  coluna: {
    flex: 1,
    alignItems: 'stretch',
  },
  area: {
    alignItems: 'center',
  },
  areaAcima: {
    justifyContent: 'flex-end',
  },
  barra: {
    width: 10,
  },
  barraAcima: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barraAbaixo: {
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  base: {
    height: 1,
    backgroundColor: CORES.borda,
  },
  rotulo: {
    marginTop: 6,
    fontFamily: FONTES.regular,
    fontSize: 9,
    textAlign: 'center',
    color: CORES.textoApagado,
  },
  rotuloAtual: {
    color: CORES.texto,
  },
  rotuloAtivo: {
    fontFamily: FONTES.seminegrito,
    color: CORES.verde,
  },
});

export default GraficoPatrimonio;
