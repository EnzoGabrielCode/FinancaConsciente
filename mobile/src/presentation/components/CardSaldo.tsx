import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {formatarCentavos, formatarPercentual} from '../../domain/dinheiro';
import type {ResumoDashboard} from '../../domain/entities/Dashboard';
import {CORES, FONTE_MONO, comAlfa} from '../theme/cores';
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
  const disponivel = partesDoSaldo(resumo.disponivelCentavos);
  const corDisponivel =
    resumo.disponivelCentavos < 0 ? CORES.vermelho : CORES.verde;
  const saldoTotal = formatarCentavos(resumo.saldoAtualCentavos);

  return (
    <View style={styles.card} testID="card-saldo">
      <Text style={styles.titulo}>DISPONÍVEL</Text>

      <View style={styles.blocoDisponivel}>
        <Text
          style={styles.disponivel}
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityLabel={`Disponível: ${formatarCentavos(
            resumo.disponivelCentavos,
          )}`}
          testID="disponivel">
          <Text style={styles.moeda}>R$ </Text>
          <Text style={{color: corDisponivel}} testID="disponivel-inteiros">
            {disponivel.sinal}
            {disponivel.inteiros}
          </Text>
          <Text style={styles.centavos}>{disponivel.decimais}</Text>
        </Text>

        <View style={styles.linhaSaldoTotal}>
          <Text
            style={styles.saldoTotal}
            accessibilityLabel={`Saldo total: ${saldoTotal}`}
            testID="saldo-total">
            Saldo total {saldoTotal}
          </Text>
          {resumo.variacaoSaldo !== null && (
            <SeloVariacao variacao={resumo.variacaoSaldo} />
          )}
        </View>
      </View>

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
  blocoDisponivel: {
    marginTop: -8,
    gap: 4,
  },
  disponivel: {
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
  linhaSaldoTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saldoTotal: {
    fontSize: 12,
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
