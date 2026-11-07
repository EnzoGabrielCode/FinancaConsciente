import React from 'react';
import {Pressable, StyleSheet, Switch, Text, View} from 'react-native';
import {Icon} from 'react-native-paper';

import {formatarCentavos} from '../../domain/dinheiro';
import type {ContaRecorrente} from '../../domain/entities/ContaRecorrente';
import {categoriaDoOrcamento} from '../../domain/orcamentos';
import {descreverFrequencia, descreverProximo} from '../../domain/recorrencia';
import {CORES, comAlfa} from '../theme/cores';
import {FONTES} from '../theme/fontes';

interface Props {
  conta: ContaRecorrente;
  hoje: string;
  onPress: (conta: ContaRecorrente) => void;
  onAlternar: (conta: ContaRecorrente, ativa: boolean) => void;
}

function ContaRecorrenteCard({
  conta,
  hoje,
  onPress,
  onAlternar,
}: Props): React.JSX.Element {
  const categoria = categoriaDoOrcamento(conta.categoria);
  const valor = formatarCentavos(conta.valorCentavos);
  const frequencia = descreverFrequencia(conta);
  const proximo = conta.ativa
    ? descreverProximo(conta.proxima, hoje)
    : 'Pausada';

  return (
    <View style={styles.card} testID={`conta-card-${conta.id}`}>
      {/* O Switch fica fora do Pressable para o leitor de tela alcançá-lo. */}
      <Pressable
        onPress={() => onPress(conta)}
        accessibilityRole="button"
        accessibilityLabel={`${conta.descricao}, ${valor}, ${frequencia}, ${proximo}`}
        accessibilityHint="Toque para editar."
        testID={`conta-abrir-${conta.id}`}
        style={[styles.conteudo, !conta.ativa && styles.pausada]}>
        <View
          style={[
            styles.icone,
            {backgroundColor: comAlfa(categoria.cor, 0.15)},
          ]}>
          <Icon source={categoria.icone} size={20} color={categoria.cor} />
        </View>
        <View style={styles.textos}>
          <View style={styles.linhaTitulo}>
            <Text style={styles.descricao} numberOfLines={1}>
              {conta.descricao}
            </Text>
            <Text style={styles.valor} testID={`conta-valor-${conta.id}`}>
              {valor}
            </Text>
          </View>
          <Text style={styles.detalhe} testID={`conta-frequencia-${conta.id}`}>
            {frequencia}
          </Text>
          <Text style={styles.detalhe} testID={`conta-proximo-${conta.id}`}>
            {proximo}
          </Text>
        </View>
      </Pressable>
      <Switch
        value={conta.ativa}
        onValueChange={ativa => onAlternar(conta, ativa)}
        trackColor={{false: CORES.superficie3, true: comAlfa(CORES.verde, 0.4)}}
        thumbColor={conta.ativa ? CORES.verde : CORES.textoSecundario}
        accessibilityLabel={`Conta ${conta.descricao} ativa`}
        testID={`conta-ativa-${conta.id}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: CORES.borda,
    backgroundColor: CORES.superficie,
  },
  conteudo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pausada: {
    opacity: 0.5,
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
  linhaTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  descricao: {
    flexShrink: 1,
    fontFamily: FONTES.seminegrito,
    fontSize: 14,
    color: CORES.texto,
  },
  valor: {
    fontFamily: FONTES.monoNegrito,
    fontSize: 13,
    color: CORES.texto,
  },
  detalhe: {
    fontFamily: FONTES.regular,
    fontSize: 11,
    color: CORES.textoSecundario,
  },
});

export default ContaRecorrenteCard;
