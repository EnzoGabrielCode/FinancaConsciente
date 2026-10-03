import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {IconButton, Menu} from 'react-native-paper';

import {progressoCofre} from '../../domain/cofres';
import {formatarCentavos, formatarPercentual} from '../../domain/dinheiro';
import type {Cofre} from '../../domain/entities/Cofre';
import {CORES, FONTE_MONO, comAlfa} from '../theme/cores';

interface Props {
  cofre: Cofre;
  onPress: (cofre: Cofre) => void;
  onGuardar: (cofre: Cofre) => void;
  onRetirar: (cofre: Cofre) => void;
  onEditar: (cofre: Cofre) => void;
  onExcluir: (cofre: Cofre) => void;
}

function CofreCard({
  cofre,
  onPress,
  onGuardar,
  onRetirar,
  onEditar,
  onExcluir,
}: Props): React.JSX.Element {
  const [menuAberto, setMenuAberto] = useState(false);
  const progresso = progressoCofre(cofre.saldoCentavos, cofre.metaCentavos);
  const saldo = formatarCentavos(cofre.saldoCentavos);

  const escolher = (acao: (cofre: Cofre) => void) => () => {
    setMenuAberto(false);
    acao(cofre);
  };

  return (
    <Pressable
      onPress={() => onPress(cofre)}
      accessibilityRole="button"
      accessibilityLabel={`Cofre ${cofre.nome}: ${saldo} guardados`}
      testID={`cofre-card-${cofre.id}`}
      style={({pressed}) => [styles.card, pressed && styles.pressionado]}>
      <View style={styles.topo}>
        <View
          style={[styles.icone, {backgroundColor: comAlfa(cofre.cor, 0.12)}]}>
          <Text style={styles.emoji}>{cofre.icone}</Text>
        </View>
        <Menu
          visible={menuAberto}
          onDismiss={() => setMenuAberto(false)}
          anchor={
            <IconButton
              icon="dots-vertical"
              size={20}
              iconColor={CORES.textoSecundario}
              onPress={() => setMenuAberto(true)}
              accessibilityLabel={`Opções do cofre ${cofre.nome}`}
              style={styles.botaoMenu}
              testID={`cofre-menu-${cofre.id}`}
            />
          }>
          <Menu.Item
            leadingIcon="arrow-down"
            title="Guardar"
            onPress={escolher(onGuardar)}
            testID="menu-cofre-guardar"
          />
          <Menu.Item
            leadingIcon="arrow-up"
            title="Retirar"
            onPress={escolher(onRetirar)}
            testID="menu-cofre-retirar"
          />
          <Menu.Item
            leadingIcon="pencil-outline"
            title="Editar cofre"
            onPress={escolher(onEditar)}
            testID="menu-cofre-editar"
          />
          <Menu.Item
            leadingIcon="trash-can-outline"
            title="Excluir cofre"
            titleStyle={styles.textoExcluir}
            onPress={escolher(onExcluir)}
            testID="menu-cofre-excluir"
          />
        </Menu>
      </View>

      <Text style={styles.nome} numberOfLines={1}>
        {cofre.nome}
      </Text>
      <Text
        style={[styles.saldo, {color: cofre.cor}]}
        numberOfLines={1}
        adjustsFontSizeToFit
        testID={`cofre-saldo-${cofre.id}`}>
        {saldo}
      </Text>

      {progresso !== null && cofre.metaCentavos !== null ? (
        <>
          <View
            style={styles.trilho}
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: 100,
              now: Math.round(progresso * 100),
            }}>
            <View
              style={[
                styles.preenchimento,
                {width: `${progresso * 100}%`, backgroundColor: cofre.cor},
              ]}
            />
          </View>
          <Text style={styles.detalhe} testID={`cofre-meta-${cofre.id}`}>
            {formatarPercentual(progresso, {casas: 0, sinalPositivo: false})} ·
            Meta: {formatarCentavos(cofre.metaCentavos)}
          </Text>
        </>
      ) : (
        <Text style={styles.detalhe} testID={`cofre-meta-${cofre.id}`}>
          Sem meta
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: CORES.superficie,
    borderRadius: 22,
    padding: 16,
    gap: 6,
  },
  pressionado: {
    opacity: 0.85,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  icone: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 22,
  },
  botaoMenu: {
    margin: -8,
  },
  textoExcluir: {
    color: CORES.vermelho,
  },
  nome: {
    fontSize: 14,
    fontWeight: 'bold',
    color: CORES.texto,
  },
  saldo: {
    fontFamily: FONTE_MONO,
    fontSize: 20,
    fontWeight: 'bold',
  },
  trilho: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
    marginTop: 4,
  },
  preenchimento: {
    height: '100%',
    borderRadius: 999,
  },
  detalhe: {
    fontSize: 10,
    color: CORES.textoApagado,
  },
});

export default CofreCard;
