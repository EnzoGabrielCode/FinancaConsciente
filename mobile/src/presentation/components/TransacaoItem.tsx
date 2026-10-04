import React, {useMemo, useRef} from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
} from 'react-native';
import {Icon} from 'react-native-paper';

import {buscarCategoria, categoriasDo} from '../../domain/categorias';
import {formatarDataCurta} from '../../domain/datas';
import {formatarCentavos} from '../../domain/dinheiro';
import type {Transacao} from '../../domain/entities/Transacao';
import {CORES, comAlfa, corDoTipo} from '../theme/cores';
import {FONTES} from '../theme/fontes';

interface Props {
  transacao: Transacao;
  onPress: (transacao: Transacao) => void;
  onExcluir: (transacao: Transacao) => void;
}

export const LARGURA_EXCLUIR = 88;

const ACOES_ACESSIBILIDADE = [
  {name: 'activate', label: 'Editar'},
  {name: 'excluir', label: 'Excluir'},
];

function TransacaoItem({
  transacao,
  onPress,
  onExcluir,
}: Props): React.JSX.Element {
  const deslocamento = useRef(new Animated.Value(0)).current;
  const aberto = useRef(false);

  const categoria =
    buscarCategoria(transacao.tipo, transacao.categoria) ??
    categoriasDo(transacao.tipo).find(c => c.id === 'outros')!;
  const receita = transacao.tipo === 'receita';
  const valor = `${receita ? '+' : '-'}${formatarCentavos(
    transacao.valorCentavos,
  )}`;
  const fixa = receita && transacao.recorrencia === 'fixa';

  const panResponder = useMemo(() => {
    const animarPara = (x: number) => {
      aberto.current = x !== 0;
      Animated.spring(deslocamento, {
        toValue: x,
        useNativeDriver: true,
        bounciness: 0,
      }).start();
    };
    const posicaoBase = () => (aberto.current ? -LARGURA_EXCLUIR : 0);

    return {
      animarPara,
      responder: PanResponder.create({
        onMoveShouldSetPanResponder: (_evento, gesto) =>
          Math.abs(gesto.dx) > 10 &&
          Math.abs(gesto.dx) > Math.abs(gesto.dy) * 1.5,
        onPanResponderMove: (_evento, gesto) => {
          const x = posicaoBase() + gesto.dx;
          deslocamento.setValue(
            Math.min(0, Math.max(-LARGURA_EXCLUIR * 1.25, x)),
          );
        },
        onPanResponderRelease: (_evento, gesto) => {
          const x = posicaoBase() + gesto.dx;
          const abrir =
            gesto.vx < -0.5 || (gesto.vx <= 0.5 && x < -LARGURA_EXCLUIR / 2);
          animarPara(abrir ? -LARGURA_EXCLUIR : 0);
        },
        onPanResponderTerminate: () => animarPara(posicaoBase()),
      }),
    };
  }, [deslocamento]);

  const tocar = () => {
    if (aberto.current) {
      panResponder.animarPara(0);
    } else {
      onPress(transacao);
    }
  };

  const excluir = () => {
    panResponder.animarPara(0);
    onExcluir(transacao);
  };

  const acaoAcessibilidade = (evento: AccessibilityActionEvent) => {
    if (evento.nativeEvent.actionName === 'excluir') {
      excluir();
    } else if (evento.nativeEvent.actionName === 'activate') {
      onPress(transacao);
    }
  };

  return (
    <View style={styles.container} testID={`transacao-${transacao.id}`}>
      <View style={styles.fundoExcluir}>
        <Pressable
          onPress={excluir}
          accessibilityRole="button"
          accessibilityLabel={`Excluir ${transacao.descricao}`}
          testID={`excluir-${transacao.id}`}
          style={styles.botaoExcluir}>
          <Icon source="trash-can-outline" size={22} color="#FFFFFF" />
          <Text style={styles.textoExcluir}>Excluir</Text>
        </Pressable>
      </View>

      <Animated.View
        style={{transform: [{translateX: deslocamento}]}}
        {...panResponder.responder.panHandlers}>
        <Pressable
          onPress={tocar}
          accessibilityRole="button"
          accessibilityLabel={`${transacao.descricao}, ${
            receita ? 'receita' : 'despesa'
          } de ${formatarCentavos(
            transacao.valorCentavos,
          )}, ${formatarDataCurta(transacao.data)}${fixa ? ', fixa' : ''}${
            transacao.comprovanteUri !== null ? ', tem comprovante' : ''
          }`}
          accessibilityHint="Toque para editar. Deslize para a esquerda para excluir."
          accessibilityActions={ACOES_ACESSIBILIDADE}
          onAccessibilityAction={acaoAcessibilidade}
          testID={`abrir-${transacao.id}`}
          style={styles.frente}>
          <View
            style={[
              styles.icone,
              {backgroundColor: comAlfa(categoria.cor, 0.15)},
            ]}>
            <Icon source={categoria.icone} size={20} color={categoria.cor} />
          </View>
          <View style={styles.meio}>
            <Text style={styles.titulo} numberOfLines={1}>
              {transacao.descricao}
            </Text>
            <View style={styles.linhaData}>
              <Text style={styles.data}>
                {formatarDataCurta(transacao.data)}
              </Text>
              {transacao.comprovanteUri !== null && (
                <View
                  accessible
                  accessibilityLabel="Tem comprovante"
                  testID="icone-comprovante">
                  <Icon
                    source="paperclip"
                    size={12}
                    color={CORES.textoSecundario}
                  />
                </View>
              )}
              {fixa && (
                <Text style={styles.seloFixa} testID="selo-fixa">
                  Fixa
                </Text>
              )}
            </View>
          </View>
          <Text style={[styles.valor, {color: corDoTipo(transacao.tipo)}]}>
            {valor}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  fundoExcluir: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: CORES.vermelhoExcluir,
  },
  botaoExcluir: {
    width: LARGURA_EXCLUIR,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  textoExcluir: {
    fontFamily: FONTES.negrito,
    fontSize: 11,
    color: '#FFFFFF',
  },
  frente: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: CORES.superficie,
  },
  icone: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meio: {
    flex: 1,
    gap: 2,
  },
  titulo: {
    fontFamily: FONTES.seminegrito,
    fontSize: 14,
    color: CORES.texto,
  },
  linhaData: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  data: {
    fontFamily: FONTES.regular,
    fontSize: 11,
    color: CORES.textoApagado,
  },
  seloFixa: {
    fontFamily: FONTES.negrito,
    fontSize: 9,
    color: CORES.verde,
    backgroundColor: comAlfa(CORES.verde, 0.12),
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  valor: {
    fontFamily: FONTES.monoNegrito,
    fontSize: 14,
  },
});

export default TransacaoItem;
