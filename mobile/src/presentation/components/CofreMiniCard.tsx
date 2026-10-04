import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {formatarCentavos} from '../../domain/dinheiro';
import type {Cofre} from '../../domain/entities/Cofre';
import {CORES, comAlfa} from '../theme/cores';
import {FONTES} from '../theme/fontes';

interface Props {
  cofre: Cofre;
  onPress: (cofre: Cofre) => void;
}

function CofreMiniCard({cofre, onPress}: Props): React.JSX.Element {
  const saldo = formatarCentavos(cofre.saldoCentavos);
  return (
    <Pressable
      onPress={() => onPress(cofre)}
      accessibilityRole="button"
      accessibilityLabel={`Cofre ${cofre.nome}: ${saldo} guardados`}
      testID={`cofre-mini-${cofre.id}`}
      style={({pressed}) => [
        styles.card,
        {borderColor: comAlfa(cofre.cor, 0.13)},
        pressed && styles.pressionado,
      ]}>
      <View style={[styles.icone, {backgroundColor: comAlfa(cofre.cor, 0.1)}]}>
        <Text style={styles.emoji}>{cofre.icone}</Text>
      </View>
      <Text style={styles.nome} numberOfLines={1}>
        {cofre.nome}
      </Text>
      <Text
        style={[styles.saldo, {color: cofre.cor}]}
        numberOfLines={1}
        adjustsFontSizeToFit>
        {saldo}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 120,
    backgroundColor: CORES.superficie,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    gap: 8,
  },
  pressionado: {
    opacity: 0.8,
  },
  icone: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontFamily: FONTES.regular,
    fontSize: 18,
  },
  nome: {
    fontFamily: FONTES.regular,
    fontSize: 11,
    color: CORES.textoSecundario,
  },
  saldo: {
    fontFamily: FONTES.monoNegrito,
    fontSize: 14,
  },
});

export default CofreMiniCard;
