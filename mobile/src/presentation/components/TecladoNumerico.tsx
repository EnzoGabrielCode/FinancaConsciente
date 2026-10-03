import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Icon} from 'react-native-paper';

import {aplicarTecla, type Tecla} from '../../domain/dinheiro';
import {CORES, FONTE_MONO, comAlfa} from '../theme/cores';

interface Props {
  valor: string;
  onChange: (novoValor: string, tecla: Tecla) => void;
  desabilitado?: boolean;
}

const TECLAS: Tecla[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [',', '0', '⌫'],
];

const ROTULO_TECLA: Partial<Record<Tecla, string>> = {
  ',': 'Vírgula',
  '⌫': 'Apagar',
};

function TecladoNumerico({
  valor,
  onChange,
  desabilitado = false,
}: Props): React.JSX.Element {
  return (
    <View style={styles.teclado}>
      {TECLAS.map(linha => (
        <View key={linha.join('')} style={styles.linhaTeclado}>
          {linha.map(tecla => {
            const apagar = tecla === '⌫';
            return (
              <Pressable
                key={tecla}
                onPress={() => onChange(aplicarTecla(valor, tecla), tecla)}
                disabled={desabilitado}
                accessibilityRole="button"
                accessibilityLabel={ROTULO_TECLA[tecla] ?? tecla}
                testID={`tecla-${tecla}`}
                style={({pressed}) => [
                  styles.tecla,
                  apagar && styles.teclaApagar,
                  pressed && styles.teclaPressionada,
                ]}>
                {apagar ? (
                  <Icon
                    source="backspace-outline"
                    size={22}
                    color={CORES.vermelho}
                  />
                ) : (
                  <Text style={styles.textoTecla}>{tecla}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  teclado: {
    gap: 8,
  },
  linhaTeclado: {
    flexDirection: 'row',
    gap: 8,
  },
  tecla: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.realce,
  },
  teclaApagar: {
    backgroundColor: comAlfa(CORES.vermelho, 0.1),
  },
  teclaPressionada: {
    opacity: 0.6,
  },
  textoTecla: {
    fontFamily: FONTE_MONO,
    fontSize: 20,
    color: CORES.texto,
  },
});

export default TecladoNumerico;
