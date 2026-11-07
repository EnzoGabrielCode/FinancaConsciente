import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {Icon} from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';

import {formatarCentavos} from '../../domain/dinheiro';
import type {
  Orcamento,
  ProgressoOrcamento,
  SituacaoOrcamento,
} from '../../domain/entities/Orcamento';
import {categoriaDoOrcamento} from '../../domain/orcamentos';
import {CORES, comAlfa} from '../theme/cores';
import {DEGRADES, HORIZONTAL} from '../theme/degrades';
import {FONTES} from '../theme/fontes';

interface Props {
  progresso: ProgressoOrcamento;
  onPress: (orcamento: Orcamento) => void;
}

export const COR_SITUACAO: Record<SituacaoOrcamento, string> = {
  ok: CORES.verde,
  perto: CORES.laranja,
  estourado: CORES.vermelho,
};

export const DEGRADE_SITUACAO: Record<SituacaoOrcamento, string[]> = {
  ok: DEGRADES.verde,
  perto: DEGRADES.laranja,
  estourado: DEGRADES.vermelho,
};

const ETIQUETA: Partial<Record<SituacaoOrcamento, string>> = {
  perto: 'Perto do limite',
  estourado: 'Estourado',
};

const DESCRICAO_SITUACAO: Record<SituacaoOrcamento, string> = {
  ok: 'dentro do limite',
  perto: 'perto do limite',
  estourado: 'estourado',
};

function OrcamentoCard({progresso, onPress}: Props): React.JSX.Element {
  const {orcamento, gastoCentavos, percentual, restanteCentavos, situacao} =
    progresso;
  const categoria = categoriaDoOrcamento(orcamento.categoria);
  const cor = COR_SITUACAO[situacao];
  const etiqueta = ETIQUETA[situacao];

  return (
    <Pressable
      onPress={() => onPress(orcamento)}
      accessibilityRole="button"
      accessibilityLabel={`${categoria.label}, ${percentual}% do orçamento, ${DESCRICAO_SITUACAO[situacao]}`}
      accessibilityHint="Toque para editar."
      testID={`orcamento-${orcamento.categoria}`}
      style={styles.card}>
      <View style={styles.topo}>
        <View
          style={[
            styles.icone,
            {backgroundColor: comAlfa(categoria.cor, 0.15)},
          ]}>
          <Icon source={categoria.icone} size={20} color={categoria.cor} />
        </View>
        <View style={styles.textos}>
          <View style={styles.linhaNome}>
            <Text style={styles.nome} numberOfLines={1}>
              {categoria.label}
            </Text>
            {etiqueta && (
              <Text
                style={[
                  styles.etiqueta,
                  {color: cor, backgroundColor: comAlfa(cor, 0.12)},
                ]}
                testID={`orcamento-etiqueta-${orcamento.categoria}`}>
                {etiqueta}
              </Text>
            )}
          </View>
          <Text
            style={styles.gasto}
            numberOfLines={1}
            adjustsFontSizeToFit
            testID={`orcamento-gasto-${orcamento.categoria}`}>
            Gasto: {formatarCentavos(gastoCentavos)} /{' '}
            {formatarCentavos(orcamento.limiteCentavos)}
          </Text>
        </View>
        <Text
          style={[
            styles.selo,
            {color: cor, backgroundColor: comAlfa(cor, 0.12)},
          ]}
          testID={`orcamento-percentual-${orcamento.categoria}`}>
          {percentual}%
        </Text>
      </View>

      <View style={styles.trilho}>
        <LinearGradient
          colors={DEGRADE_SITUACAO[situacao]}
          {...HORIZONTAL}
          style={[
            styles.preenchimento,
            {width: `${Math.min(percentual, 100)}%`},
          ]}
          testID={`orcamento-barra-${orcamento.categoria}`}
        />
      </View>

      {restanteCentavos < 0 ? (
        <Text
          style={styles.passou}
          testID={`orcamento-rodape-${orcamento.categoria}`}>
          Passou {formatarCentavos(-restanteCentavos)} do limite
        </Text>
      ) : (
        <View style={styles.rodape}>
          <Text
            style={styles.textoRodape}
            testID={`orcamento-rodape-${orcamento.categoria}`}>
            Disponível: {formatarCentavos(restanteCentavos)}
          </Text>
          <Text style={styles.textoRodape}>
            {Math.max(100 - percentual, 0)}% livre
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: CORES.borda,
    backgroundColor: CORES.superficie,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icone: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textos: {
    flex: 1,
    gap: 2,
  },
  linhaNome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nome: {
    flexShrink: 1,
    fontFamily: FONTES.seminegrito,
    fontSize: 14,
    color: CORES.texto,
  },
  etiqueta: {
    fontFamily: FONTES.negrito,
    fontSize: 9,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  gasto: {
    fontFamily: FONTES.monoMedio,
    fontSize: 11,
    color: CORES.textoSecundario,
  },
  selo: {
    fontFamily: FONTES.monoNegrito,
    fontSize: 12,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  trilho: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  preenchimento: {
    height: '100%',
    borderRadius: 999,
  },
  rodape: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  textoRodape: {
    fontFamily: FONTES.regular,
    fontSize: 11,
    color: CORES.textoSecundario,
  },
  passou: {
    fontFamily: FONTES.seminegrito,
    fontSize: 11,
    color: CORES.vermelho,
  },
});

export default OrcamentoCard;
