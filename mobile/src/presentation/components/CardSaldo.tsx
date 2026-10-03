import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {formatarCentavos, formatarPercentual} from '../../domain/dinheiro';
import type {ResumoDashboard} from '../../domain/entities/Dashboard';
import {CORES, FONTE_MONO, comAlfa} from '../theme/cores';
import GraficoMensal from './GraficoMensal';

interface Props {
  resumo: ResumoDashboard;
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

function SeloVariacao({variacao}: {variacao: number}): React.JSX.Element {
  const texto = formatarPercentual(variacao);
  const cor = texto.startsWith('-')
    ? CORES.vermelho
    : texto.startsWith('+')
    ? CORES.verde
    : CORES.textoSecundario;
  const seta = texto.startsWith('-') ? ' ↓' : texto.startsWith('+') ? ' ↑' : '';
  return (
    <Text
      style={[styles.selo, {color: cor, backgroundColor: comAlfa(cor, 0.12)}]}
      accessibilityLabel={`Variação do saldo desde o fim do mês passado: ${texto}`}
      testID="selo-variacao">
      {texto}
      {seta}
    </Text>
  );
}

interface ColunaProps {
  rotulo: string;
  valor: string;
  cor: string;
  detalhe?: string | null;
  idValor: string;
}

function Coluna({
  rotulo,
  valor,
  cor,
  detalhe,
  idValor,
}: ColunaProps): React.JSX.Element {
  return (
    <View
      style={styles.coluna}
      accessible
      accessibilityLabel={`${rotulo} do mês: ${valor}${
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

function CardSaldo({resumo}: Props): React.JSX.Element {
  const saldo = partesDoSaldo(resumo.saldoAtualCentavos);
  const corSaldo = resumo.saldoAtualCentavos < 0 ? CORES.vermelho : CORES.verde;
  const poupadoNegativo = resumo.poupadoMesCentavos < 0;

  return (
    <View style={styles.card} testID="card-saldo">
      <View style={styles.topo}>
        <Text style={styles.titulo}>SALDO ATUAL</Text>
        {resumo.variacaoSaldo !== null && (
          <SeloVariacao variacao={resumo.variacaoSaldo} />
        )}
      </View>

      <Text
        style={styles.saldo}
        numberOfLines={1}
        adjustsFontSizeToFit
        accessibilityLabel={`Saldo atual: ${formatarCentavos(
          resumo.saldoAtualCentavos,
        )}`}
        testID="saldo-atual">
        <Text style={styles.moeda}>R$ </Text>
        <Text style={{color: corSaldo}} testID="saldo-inteiros">
          {saldo.sinal}
          {saldo.inteiros}
        </Text>
        <Text style={styles.centavos}>{saldo.decimais}</Text>
      </Text>

      {resumo.guardadoCofresCentavos > 0 && (
        <Text style={styles.linhaCofres} testID="saldo-disponivel">
          <Text
            style={
              resumo.disponivelCentavos < 0 ? styles.disponivelNegativo : null
            }
            testID="saldo-disponivel-valor">
            {formatarCentavos(resumo.disponivelCentavos)} disponível
          </Text>
          {' · '}
          {formatarCentavos(resumo.guardadoCofresCentavos)} em cofres
        </Text>
      )}

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
          rotulo="Poupado"
          valor={formatarCentavos(resumo.poupadoMesCentavos)}
          cor={poupadoNegativo ? CORES.vermelho : CORES.azul}
          detalhe={
            resumo.taxaPoupanca === null
              ? null
              : `${formatarPercentual(resumo.taxaPoupanca, {
                  casas: 0,
                  sinalPositivo: false,
                })} da renda`
          }
          idValor="poupado-mes"
        />
      </View>

      <GraficoMensal serie={resumo.serie} />
      <Text style={styles.legenda}>Últimos {resumo.serie.length} meses</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CORES.superficie,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: comAlfa(CORES.verde, 0.12),
    elevation: 2,
    gap: 16,
  },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titulo: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: CORES.textoSecundario,
  },
  selo: {
    fontSize: 11,
    fontWeight: 'bold',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  saldo: {
    marginTop: -8,
    fontFamily: FONTE_MONO,
    fontSize: 34,
    fontWeight: 'bold',
  },
  moeda: {
    color: CORES.texto,
  },
  centavos: {
    fontSize: 18,
    color: CORES.textoSecundario,
  },
  linhaCofres: {
    marginTop: -12,
    fontSize: 12,
    color: CORES.textoSecundario,
  },
  disponivelNegativo: {
    color: CORES.vermelho,
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
    fontSize: 11,
    color: CORES.textoSecundario,
  },
  valorColuna: {
    fontFamily: FONTE_MONO,
    fontSize: 14,
    fontWeight: 'bold',
  },
  detalhe: {
    fontSize: 11,
    color: CORES.textoSecundario,
  },
  legenda: {
    marginTop: -8,
    alignSelf: 'flex-end',
    fontSize: 11,
    color: CORES.textoApagado,
  },
});

export default CardSaldo;
