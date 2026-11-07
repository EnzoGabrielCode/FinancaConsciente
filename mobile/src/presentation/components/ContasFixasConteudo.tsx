import React from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import {Button, Icon} from 'react-native-paper';

import {hojeISO} from '../../domain/datas';
import {formatarCentavos} from '../../domain/dinheiro';
import type {ContaRecorrente} from '../../domain/entities/ContaRecorrente';
import type {UseContasRecorrentes} from '../hooks/useContasRecorrentes';
import {CORES, comAlfa} from '../theme/cores';
import {FONTES} from '../theme/fontes';
import {mensagemDeErro} from '../utils/mensagemDeErro';
import ContaRecorrenteCard from './ContaRecorrenteCard';

interface Props {
  contas: UseContasRecorrentes;
  margemInferior: number;
  onEditar: (conta: ContaRecorrente) => void;
  onAviso: (aviso: string) => void;
}

const textoAtivas = (quantidade: number) =>
  quantidade === 1 ? '1 conta ativa' : `${quantidade} contas ativas`;

function ContasFixasConteudo({
  contas,
  margemInferior,
  onEditar,
  onAviso,
}: Props): React.JSX.Element {
  const hoje = hojeISO();
  const [primeira] = contas.contas;

  const alternar = async (conta: ContaRecorrente, ativa: boolean) => {
    try {
      await (ativa ? contas.retomar(conta.id) : contas.pausar(conta.id));
    } catch (erro) {
      onAviso(mensagemDeErro(erro));
    }
  };

  const testarLembrete = async () => {
    try {
      await contas.testarLembrete(primeira);
      onAviso('Lembrete de teste em 10 segundos');
    } catch (erro) {
      onAviso(mensagemDeErro(erro));
    }
  };

  const cabecalho = (
    <View style={styles.cabecalho}>
      {contas.erro && (
        <View style={styles.caixaErro}>
          <Text style={styles.erro} testID="contas-erro">
            Não foi possível carregar as contas: {contas.erro}
          </Text>
          <Button onPress={contas.recarregar}>Tentar novamente</Button>
        </View>
      )}
      {contas.contas.length > 0 && (
        <View style={styles.cardResumo} testID="contas-resumo">
          <Text style={styles.rotuloResumo}>TOTAL FIXO POR MÊS</Text>
          <Text
            style={styles.valorResumo}
            numberOfLines={1}
            adjustsFontSizeToFit
            testID="contas-total">
            {formatarCentavos(contas.totalMensal)}
          </Text>
          <Text style={styles.detalheResumo} testID="contas-ativas">
            {textoAtivas(contas.contas.filter(c => c.ativa).length)}
          </Text>
        </View>
      )}
    </View>
  );

  const vazio =
    contas.carregando || contas.erro ? null : (
      <View style={styles.vazio} testID="contas-vazio">
        <View style={styles.iconeVazio}>
          <Icon source="repeat" size={32} color={CORES.verde} />
        </View>
        <Text style={styles.tituloVazio}>Nenhuma conta fixa</Text>
        <Text style={styles.textoVazio}>
          Cadastre aluguel, internet, assinaturas... e o app lança e avisa para
          você.
        </Text>
      </View>
    );

  const rodape =
    __DEV__ && primeira ? (
      <Pressable
        onPress={testarLembrete}
        accessibilityRole="button"
        accessibilityLabel="Testar lembrete"
        testID="contas-testar-lembrete"
        style={styles.botaoTeste}>
        <Text style={styles.textoTeste}>Testar lembrete</Text>
      </Pressable>
    ) : null;

  return (
    <FlatList
      data={contas.contas}
      keyExtractor={conta => String(conta.id)}
      contentContainerStyle={[styles.lista, {paddingBottom: margemInferior}]}
      ListHeaderComponent={cabecalho}
      ListEmptyComponent={vazio}
      ListFooterComponent={rodape}
      renderItem={({item}) => (
        <ContaRecorrenteCard
          conta={item}
          hoje={hoje}
          onPress={onEditar}
          onAlternar={alternar}
        />
      )}
      testID="contas-lista"
    />
  );
}

const styles = StyleSheet.create({
  lista: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  cabecalho: {
    gap: 16,
  },
  caixaErro: {
    alignItems: 'center',
    gap: 8,
  },
  erro: {
    fontFamily: FONTES.regular,
    fontSize: 13,
    textAlign: 'center',
    color: CORES.vermelho,
  },
  cardResumo: {
    gap: 4,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CORES.borda,
    backgroundColor: CORES.superficie,
  },
  rotuloResumo: {
    fontFamily: FONTES.regular,
    fontSize: 10,
    letterSpacing: 0.7,
    color: CORES.textoSecundario,
  },
  valorResumo: {
    fontFamily: FONTES.monoExtraNegrito,
    fontSize: 26,
    color: CORES.texto,
  },
  detalheResumo: {
    fontFamily: FONTES.regular,
    fontSize: 12,
    color: CORES.textoSecundario,
  },
  vazio: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 48,
  },
  iconeVazio: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: comAlfa(CORES.verde, 0.12),
  },
  tituloVazio: {
    fontFamily: FONTES.negrito,
    fontSize: 16,
    color: CORES.texto,
  },
  textoVazio: {
    fontFamily: FONTES.regular,
    fontSize: 13,
    textAlign: 'center',
    color: CORES.textoSecundario,
  },
  botaoTeste: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textoTeste: {
    fontFamily: FONTES.regular,
    fontSize: 11,
    color: CORES.textoApagado,
  },
});

export default ContasFixasConteudo;
