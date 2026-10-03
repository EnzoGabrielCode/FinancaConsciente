import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {HelperText, Icon} from 'react-native-paper';

import {formatarDataCurta} from '../../domain/datas';
import {
  formatarCentavos,
  formatarDigitado,
  paraCentavos,
} from '../../domain/dinheiro';
import type {
  Cofre,
  MovimentoCofre,
  TipoMovimento,
} from '../../domain/entities/Cofre';
import {CORES, FONTE_MONO, comAlfa} from '../theme/cores';
import {mensagemDeErro} from '../utils/mensagemDeErro';
import TecladoNumerico from './TecladoNumerico';

export const LIMITE_MOVIMENTOS = 5;

interface Props {
  visivel: boolean;
  cofre: Cofre | null;
  tipoInicial?: TipoMovimento;
  disponivelCentavos: number;
  carregarMovimentos: (
    cofreId: number,
    limite: number,
  ) => Promise<MovimentoCofre[]>;
  onFechar: () => void;
  onGuardar: (cofreId: number, valorCentavos: number) => Promise<void>;
  onRetirar: (cofreId: number, valorCentavos: number) => Promise<void>;
}

const corDoMovimento = (tipo: TipoMovimento) =>
  tipo === 'deposito' ? CORES.verde : CORES.laranja;

function MovimentarCofreSheet({
  visivel,
  cofre,
  tipoInicial = 'deposito',
  disponivelCentavos,
  carregarMovimentos,
  onFechar,
  onGuardar,
  onRetirar,
}: Props): React.JSX.Element {
  const [tipo, setTipo] = useState<TipoMovimento>(tipoInicial);
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [movimentos, setMovimentos] = useState<MovimentoCofre[]>([]);

  const cofreId = cofre?.id;
  const saldoCofre = cofre?.saldoCentavos;

  useEffect(() => {
    if (!visivel) {
      return;
    }
    setTipo(tipoInicial);
    setValor('');
    setErro(null);
    setSalvando(false);
  }, [visivel, cofreId, tipoInicial]);

  useEffect(() => {
    if (!visivel || cofreId === undefined) {
      setMovimentos([]);
      return;
    }
    let ativo = true;
    carregarMovimentos(cofreId, LIMITE_MOVIMENTOS)
      .then(lista => {
        if (ativo) {
          setMovimentos(lista);
        }
      })
      .catch(() => {
        if (ativo) {
          setMovimentos([]);
        }
      });
    return () => {
      ativo = false;
    };
  }, [visivel, cofreId, saldoCofre, carregarMovimentos]);

  const centavos = paraCentavos(valor);
  const temValor = centavos > 0;
  const cor = corDoMovimento(tipo);
  const guardando = tipo === 'deposito';

  const fechar = () => {
    if (!salvando) {
      onFechar();
    }
  };

  const confirmar = async () => {
    if (!cofre || !temValor) {
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      await (guardando ? onGuardar : onRetirar)(cofre.id, centavos);
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  };

  const rotuloBotao = !temValor
    ? 'Digite um valor'
    : `${guardando ? 'Guardar' : 'Retirar'} ${formatarCentavos(centavos)}`;

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      transparent
      onRequestClose={fechar}>
      <View style={styles.fundo}>
        <Pressable
          style={styles.areaFechar}
          onPress={fechar}
          accessibilityLabel="Fechar"
        />
        <View style={styles.folha} testID="movimentar-cofre-sheet">
          <View style={styles.alca} />
          <View style={styles.cabecalho}>
            <View style={styles.textosCabecalho}>
              <Text
                style={styles.titulo}
                numberOfLines={1}
                testID="movimentar-titulo">
                {cofre ? `${cofre.icone} ${cofre.nome}` : ''}
              </Text>
              <Text style={styles.subtitulo} testID="movimentar-guardado">
                Guardado: {formatarCentavos(cofre?.saldoCentavos ?? 0)}
              </Text>
            </View>
            <Pressable
              style={styles.botaoFechar}
              onPress={fechar}
              disabled={salvando}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              testID="movimentar-fechar">
              <Icon source="close" size={18} color={CORES.textoSecundario} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.conteudo}>
            <View style={styles.seletorTipo} accessibilityRole="tablist">
              {(['deposito', 'retirada'] as const).map(opcao => {
                const selecionado = tipo === opcao;
                const corOpcao = corDoMovimento(opcao);
                return (
                  <Pressable
                    key={opcao}
                    onPress={() => {
                      setTipo(opcao);
                      setErro(null);
                    }}
                    disabled={salvando}
                    accessibilityRole="tab"
                    accessibilityState={{selected: selecionado}}
                    testID={`movimento-${opcao}`}
                    style={[
                      styles.opcaoTipo,
                      selecionado && {backgroundColor: comAlfa(corOpcao, 0.2)},
                    ]}>
                    <Text
                      style={[
                        styles.textoTipo,
                        selecionado && {color: corOpcao},
                      ]}>
                      {opcao === 'deposito' ? '↓ Guardar' : '↑ Retirar'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text
              style={[
                styles.limite,
                guardando && disponivelCentavos < 0 && styles.limiteNegativo,
              ]}
              testID="movimentar-limite">
              {guardando
                ? `Disponível para guardar: ${formatarCentavos(
                    disponivelCentavos,
                  )}`
                : `Pode retirar até ${formatarCentavos(
                    cofre?.saldoCentavos ?? 0,
                  )}`}
            </Text>

            <View style={styles.linhaValor}>
              <Text style={styles.moeda}>R$</Text>
              <Text
                style={[styles.valor, {color: cor}]}
                numberOfLines={1}
                adjustsFontSizeToFit
                accessibilityLabel={`Valor: ${formatarDigitado(valor)} reais`}
                testID="movimentar-valor">
                {formatarDigitado(valor)}
              </Text>
            </View>

            {erro && (
              <HelperText type="error" testID="movimentar-erro">
                {erro}
              </HelperText>
            )}

            <TecladoNumerico
              valor={valor}
              onChange={novo => {
                setValor(novo);
                setErro(null);
              }}
              desabilitado={salvando}
            />

            <Pressable
              onPress={confirmar}
              disabled={!temValor || salvando}
              accessibilityRole="button"
              accessibilityState={{
                disabled: !temValor || salvando,
                busy: salvando,
              }}
              accessibilityLabel={rotuloBotao}
              testID="movimentar-confirmar"
              style={[
                styles.botao,
                temValor ? {backgroundColor: cor} : styles.botaoDesabilitado,
              ]}>
              {salvando ? (
                <ActivityIndicator color={CORES.fundo} />
              ) : (
                <Text
                  style={[
                    styles.textoBotao,
                    !temValor && styles.textoBotaoDesabilitado,
                  ]}>
                  {rotuloBotao}
                </Text>
              )}
            </Pressable>

            {movimentos.length > 0 && (
              <View style={styles.movimentos} testID="movimentos-recentes">
                <Text style={styles.rotuloSecao}>Últimos movimentos</Text>
                {movimentos.map(movimento => {
                  const deposito = movimento.tipo === 'deposito';
                  return (
                    <View
                      key={movimento.id}
                      style={styles.movimento}
                      testID={`movimento-${movimento.id}`}>
                      <Text style={styles.textoMovimento}>
                        {deposito ? 'Guardado' : 'Retirado'}
                        <Text style={styles.dataMovimento}>
                          {'  '}
                          {formatarDataCurta(movimento.data)}
                        </Text>
                      </Text>
                      <Text
                        style={[
                          styles.valorMovimento,
                          {color: corDoMovimento(movimento.tipo)},
                        ]}
                        testID={`movimento-valor-${movimento.id}`}>
                        {deposito ? '+' : '-'}
                        {formatarCentavos(movimento.valorCentavos)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  areaFechar: {
    flex: 1,
  },
  folha: {
    maxHeight: '94%',
    backgroundColor: CORES.superficie,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  alca: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  textosCabecalho: {
    flex: 1,
    gap: 2,
  },
  titulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CORES.texto,
  },
  subtitulo: {
    fontSize: 12,
    color: CORES.textoSecundario,
  },
  botaoFechar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.realceForte,
  },
  conteudo: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 16,
  },
  seletorTipo: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    backgroundColor: CORES.realce,
  },
  opcaoTipo: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  textoTipo: {
    fontSize: 14,
    fontWeight: '600',
    color: CORES.textoSecundario,
  },
  limite: {
    fontSize: 12,
    color: CORES.textoSecundario,
  },
  limiteNegativo: {
    color: CORES.vermelho,
  },
  linhaValor: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  moeda: {
    fontSize: 14,
    color: CORES.textoSecundario,
  },
  valor: {
    flexShrink: 1,
    fontFamily: FONTE_MONO,
    fontSize: 44,
    fontWeight: 'bold',
  },
  botao: {
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoDesabilitado: {
    backgroundColor: CORES.realceForte,
  },
  textoBotao: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CORES.fundo,
  },
  textoBotaoDesabilitado: {
    color: CORES.textoApagado,
  },
  movimentos: {
    gap: 8,
  },
  rotuloSecao: {
    fontSize: 14,
    color: CORES.textoSecundario,
  },
  movimento: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: CORES.realce,
  },
  textoMovimento: {
    fontSize: 13,
    color: CORES.texto,
  },
  dataMovimento: {
    fontSize: 11,
    color: CORES.textoApagado,
  },
  valorMovimento: {
    fontFamily: FONTE_MONO,
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default MovimentarCofreSheet;
