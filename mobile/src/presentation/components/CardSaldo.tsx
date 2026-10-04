import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import {formatarCentavos} from '../../domain/dinheiro';
import type {ResumoDashboard} from '../../domain/entities/Dashboard';
import {CORES, comAlfa} from '../theme/cores';
import {DEGRADES, DIAGONAL} from '../theme/degrades';
import {FONTES} from '../theme/fontes';
import GraficoMensal from './GraficoMensal';

interface Props {
  resumo: ResumoDashboard;
  quantidadeCofres: number;
}

function partesDoSaldo(centavos: number) {
  const semMoeda = formatarCentavos(Math.abs(centavos)).replace('R$ ', '');
  const [inteiros, decimais] = semMoeda.split(',');
  return {
    sinal: centavos < 0 ? '-' : '',
    inteiros,
    decimais: `,${decimais}`,
  };
}

function textoCofres(quantidade: number): string {
  if (quantidade === 0) {
    return 'Nenhum cofre';
  }
  return `${quantidade} ${quantidade === 1 ? 'cofre' : 'cofres'}`;
}

interface ColunaProps {
  rotulo: string;
  valor: string;
  cor: string;
  rotuloAcessivel?: string;
  detalhe?: string | null;
  idValor: string;
}

function Coluna({
  rotulo,
  valor,
  cor,
  rotuloAcessivel = `${rotulo} do mês`,
  detalhe,
  idValor,
}: ColunaProps): React.JSX.Element {
  return (
    <View
      style={styles.coluna}
      accessible
      accessibilityLabel={`${rotuloAcessivel}: ${valor}${
        detalhe ? `, ${detalhe}` : ''
      }`}>
      <Text style={styles.rotuloColuna}>{rotulo}</Text>
      <Text
        style={[styles.valorColuna, {color: cor}]}
        numberOfLines={1}
        adjustsFontSizeToFit
        testID={idValor}>
        {valor}
      </Text>
      {detalhe ? (
        <Text style={styles.detalhe} testID={`${idValor}-detalhe`}>
          {detalhe}
        </Text>
      ) : null}
    </View>
  );
}

function CardSaldo({resumo, quantidadeCofres}: Props): React.JSX.Element {
  const saldo = partesDoSaldo(resumo.disponivelCentavos);
  const corSaldo = resumo.disponivelCentavos < 0 ? CORES.vermelho : CORES.verde;

  return (
    <LinearGradient
      colors={DEGRADES.cardSaldo}
      {...DIAGONAL}
      style={styles.card}
      testID="card-saldo">
      <Text style={styles.titulo}>SALDO ATUAL</Text>

      <Text
        style={styles.saldo}
        numberOfLines={1}
        adjustsFontSizeToFit
        accessibilityLabel={`Saldo atual: ${formatarCentavos(
          resumo.disponivelCentavos,
        )}`}
        testID="saldo-atual">
        <Text style={styles.moeda}>R$ </Text>
        <Text style={{color: corSaldo}} testID="saldo-inteiros">
          {saldo.sinal}
          {saldo.inteiros}
        </Text>
        <Text style={styles.centavos}>{saldo.decimais}</Text>
      </Text>

      <View style={styles.colunas}>
        <Coluna
          rotulo="Receitas"
          valor={`+${formatarCentavos(resumo.receitasMesCentavos)}`}
          cor={CORES.verde}
          idValor="receitas-mes"
        />
        <Coluna
          rotulo="Despesas"
          valor={`-${formatarCentavos(resumo.despesasMesCentavos)}`}
          cor={CORES.vermelho}
          idValor="despesas-mes"
        />
        <Coluna
          rotulo="Em cofres"
          rotuloAcessivel="Em cofres"
          valor={formatarCentavos(resumo.guardadoCofresCentavos)}
          cor={CORES.azul}
          detalhe={textoCofres(quantidadeCofres)}
          idValor="em-cofres"
        />
      </View>

      <GraficoMensal serie={resumo.serie} />
      <Text style={styles.legenda}>Últimos {resumo.serie.length} meses</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: comAlfa(CORES.verde, 0.12),
    elevation: 2,
    gap: 16,
  },
  titulo: {
    fontFamily: FONTES.regular,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: CORES.textoSecundario,
  },
  saldo: {
    marginTop: -8,
    fontFamily: FONTES.monoNegrito,
    fontSize: 34,
  },
  moeda: {
    color: CORES.texto,
  },
  centavos: {
    fontFamily: FONTES.monoNegrito,
    fontSize: 18,
    color: CORES.textoSecundario,
  },
  colunas: {
    flexDirection: 'row',
    gap: 8,
  },
  coluna: {
    flex: 1,
    gap: 2,
  },
  rotuloColuna: {
    fontFamily: FONTES.regular,
    fontSize: 11,
    color: CORES.textoSecundario,
  },
  valorColuna: {
    fontFamily: FONTES.monoNegrito,
    fontSize: 14,
  },
  detalhe: {
    fontFamily: FONTES.regular,
    fontSize: 11,
    color: CORES.textoSecundario,
  },
  legenda: {
    marginTop: -8,
    alignSelf: 'flex-end',
    fontFamily: FONTES.regular,
    fontSize: 11,
    color: CORES.textoApagado,
  },
});

export default CardSaldo;
