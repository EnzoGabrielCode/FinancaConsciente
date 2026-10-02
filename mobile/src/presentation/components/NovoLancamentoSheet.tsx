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
import {
  Button,
  Chip,
  HelperText,
  Icon,
  Portal,
  Snackbar,
  TextInput,
} from 'react-native-paper';

import {categoriasDo} from '../../domain/categorias';
import {hojeISO} from '../../domain/datas';
import {
  aplicarTecla,
  centavosParaDigitado,
  formatarDigitado,
  paraCentavos,
  type Tecla,
} from '../../domain/dinheiro';
import type {
  DadosTransacao,
  Recorrencia,
  TipoTransacao,
  Transacao,
} from '../../domain/entities/Transacao';
import {
  MAX_DESCRICAO,
  validarTransacao,
  type ErrosTransacao,
} from '../../domain/validacao/validarTransacao';
import {CORES, FONTE_MONO, comAlfa, corDoTipo} from '../theme/cores';
import {mensagemDeErro} from '../utils/mensagemDeErro';
import ConfirmarExclusaoDialog from './ConfirmarExclusaoDialog';

interface Props {
  visivel: boolean;
  transacao?: Transacao | null;
  onFechar: () => void;
  onSalvar: (dados: DadosTransacao) => Promise<void>;
  onExcluir?: (id: number) => Promise<void>;
}

const TECLAS: Tecla[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [',', '0', '⌫'],
];

const ROTULO_TECLA: Partial<Record<Tecla, string>> = {
  ',': 'Vírgula',
  '⌫': 'Apagar',
};

function NovoLancamentoSheet({
  visivel,
  transacao,
  onFechar,
  onSalvar,
  onExcluir,
}: Props): React.JSX.Element {
  const emEdicao = Boolean(transacao);

  const [tipo, setTipo] = useState<TipoTransacao>('receita');
  const [valor, setValor] = useState('');
  const [recorrencia, setRecorrencia] = useState<Recorrencia>('variavel');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');
  const [erros, setErros] = useState<ErrosTransacao>({});
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);

  useEffect(() => {
    if (!visivel) {
      return;
    }
    setTipo(transacao?.tipo ?? 'receita');
    setValor(transacao ? centavosParaDigitado(transacao.valorCentavos) : '');
    setRecorrencia(transacao?.recorrencia ?? 'variavel');
    setCategoria(transacao?.categoria ?? null);
    setDescricao(transacao?.descricao ?? '');
    setErros({});
    setSalvando(false);
    setConfirmandoExclusao(false);
    setExcluindo(false);
    setMensagemErro(null);
  }, [visivel, transacao]);

  const ocupado = salvando || excluindo;
  const corTipo = corDoTipo(tipo);
  const centavos = paraCentavos(valor);
  const temValor = centavos > 0;
  const categorias = categoriasDo(tipo);

  const trocarTipo = (novo: TipoTransacao) => {
    setTipo(novo);
    if (categoria && !categoriasDo(novo).some(c => c.id === categoria)) {
      setCategoria(null);
    }
    setErros({});
  };

  const pressionarTecla = (tecla: Tecla) => {
    setValor(atual => aplicarTecla(atual, tecla));
    setErros(({valorCentavos: _, ...resto}) => resto);
  };

  const fechar = () => {
    if (!ocupado) {
      onFechar();
    }
  };

  const salvar = async () => {
    const resultado = validarTransacao({
      tipo,
      valorCentavos: centavos,
      categoria: categoria ?? '',
      descricao,
      data: transacao?.data ?? hojeISO(),
      recorrencia: tipo === 'receita' ? recorrencia : 'variavel',
      comprovanteUri: transacao?.comprovanteUri ?? null,
    });
    if (!resultado.valido) {
      setErros(resultado.erros);
      return;
    }
    setSalvando(true);
    try {
      await onSalvar(resultado.dados);
    } catch (erro) {
      setMensagemErro(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!transacao || !onExcluir) {
      return;
    }
    setExcluindo(true);
    try {
      await onExcluir(transacao.id);
    } catch (erro) {
      setConfirmandoExclusao(false);
      setMensagemErro(mensagemDeErro(erro));
    } finally {
      setExcluindo(false);
    }
  };

  const rotuloSalvar = !temValor
    ? 'Digite um valor'
    : emEdicao
    ? 'Salvar alterações'
    : tipo === 'receita'
    ? 'Salvar Receita'
    : 'Salvar Despesa';

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      transparent
      onRequestClose={fechar}>
      <Portal.Host>
        <View style={styles.fundo}>
          <Pressable
            style={styles.areaFechar}
            onPress={fechar}
            accessibilityLabel="Fechar"
          />
          <View style={styles.folha} testID="novo-lancamento-sheet">
            <View style={styles.alca} />
            <View style={styles.cabecalho}>
              <Text style={styles.titulo} testID="sheet-titulo">
                {emEdicao ? 'Editar Lançamento' : 'Novo Lançamento'}
              </Text>
              <Pressable
                style={styles.botaoFechar}
                onPress={fechar}
                disabled={ocupado}
                accessibilityRole="button"
                accessibilityLabel="Fechar"
                testID="botao-fechar">
                <Icon source="close" size={18} color={CORES.textoSecundario} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.conteudo}>
              <View style={styles.seletorTipo} accessibilityRole="tablist">
                {(['despesa', 'receita'] as const).map(opcao => {
                  const selecionado = tipo === opcao;
                  const cor = corDoTipo(opcao);
                  return (
                    <Pressable
                      key={opcao}
                      onPress={() => trocarTipo(opcao)}
                      disabled={ocupado}
                      accessibilityRole="tab"
                      accessibilityState={{selected: selecionado}}
                      testID={`tipo-${opcao}`}
                      style={[
                        styles.opcaoTipo,
                        selecionado && {backgroundColor: comAlfa(cor, 0.2)},
                      ]}>
                      <Text
                        style={[styles.textoTipo, selecionado && {color: cor}]}>
                        {opcao === 'despesa' ? '↓ Despesa' : '↑ Receita'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View>
                <Text style={styles.rotulo}>VALOR</Text>
                <View style={styles.linhaValor}>
                  <Text style={styles.moeda}>R$</Text>
                  <Text
                    style={[styles.valor, {color: corTipo}]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    accessibilityLabel={`Valor: ${formatarDigitado(
                      valor,
                    )} reais`}
                    testID="valor-display">
                    {formatarDigitado(valor)}
                  </Text>
                </View>
                {erros.valorCentavos && (
                  <HelperText type="error">{erros.valorCentavos}</HelperText>
                )}
              </View>

              {tipo === 'receita' && (
                <View style={styles.linhaChips}>
                  <Chip
                    selected={recorrencia === 'fixa'}
                    onPress={() => setRecorrencia('fixa')}
                    disabled={ocupado}
                    showSelectedCheck
                    testID="recorrencia-fixa">
                    Fixa (todo mês)
                  </Chip>
                  <Chip
                    selected={recorrencia === 'variavel'}
                    onPress={() => setRecorrencia('variavel')}
                    disabled={ocupado}
                    showSelectedCheck
                    testID="recorrencia-variavel">
                    Variável
                  </Chip>
                </View>
              )}

              <View>
                <Text style={styles.rotuloSecao}>Categoria</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.linhaCategorias}>
                  {categorias.map(item => {
                    const selecionada = categoria === item.id;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => {
                          setCategoria(item.id);
                          setErros(({categoria: _, ...resto}) => resto);
                        }}
                        disabled={ocupado}
                        accessibilityRole="radio"
                        accessibilityState={{checked: selecionada}}
                        accessibilityLabel={item.label}
                        testID={`categoria-${item.id}`}
                        style={[
                          styles.categoria,
                          selecionada && {
                            backgroundColor: comAlfa(item.cor, 0.12),
                            borderColor: comAlfa(item.cor, 0.12),
                          },
                        ]}>
                        <Icon
                          source={item.icone}
                          size={18}
                          color={selecionada ? item.cor : CORES.textoSecundario}
                        />
                        <Text
                          style={[
                            styles.textoCategoria,
                            selecionada && {color: item.cor},
                          ]}>
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                {erros.categoria && (
                  <HelperText type="error">{erros.categoria}</HelperText>
                )}
              </View>

              <View>
                <TextInput
                  mode="outlined"
                  label="Descrição (opcional)"
                  value={descricao}
                  onChangeText={texto => {
                    setDescricao(texto);
                    setErros(({descricao: _, ...resto}) => resto);
                  }}
                  maxLength={MAX_DESCRICAO}
                  disabled={ocupado}
                  error={Boolean(erros.descricao)}
                  outlineStyle={styles.contornoDescricao}
                  style={styles.descricao}
                  textColor={CORES.texto}
                  outlineColor={CORES.realceForte}
                  activeOutlineColor={corTipo}
                  theme={{
                    colors: {
                      onSurfaceVariant: CORES.textoSecundario,
                      background: CORES.superficie,
                    },
                  }}
                  testID="descricao-input"
                />
                {erros.descricao && (
                  <HelperText type="error">{erros.descricao}</HelperText>
                )}
              </View>

              <View style={styles.teclado}>
                {TECLAS.map(linha => (
                  <View key={linha.join('')} style={styles.linhaTeclado}>
                    {linha.map(tecla => {
                      const apagar = tecla === '⌫';
                      return (
                        <Pressable
                          key={tecla}
                          onPress={() => pressionarTecla(tecla)}
                          disabled={ocupado}
                          accessibilityRole="button"
                          accessibilityLabel={ROTULO_TECLA[tecla] ?? tecla}
                          testID={`tecla-${tecla}`}
                          style={({pressed}) => [
                            styles.tecla,
                            apagar && styles.teclaApagar,
                            pressed && styles.teclaPressionada,
                          ]}>
                          {apagar ? (
                            <Icon
                              source="backspace-outline"
                              size={22}
                              color={CORES.vermelho}
                            />
                          ) : (
                            <Text style={styles.textoTecla}>{tecla}</Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>

              <Pressable
                onPress={salvar}
                disabled={!temValor || ocupado}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: !temValor || ocupado,
                  busy: salvando,
                }}
                accessibilityLabel={rotuloSalvar}
                testID="botao-salvar"
                style={[
                  styles.botaoSalvar,
                  temValor
                    ? {backgroundColor: corTipo}
                    : styles.botaoSalvarDesabilitado,
                ]}>
                {salvando ? (
                  <ActivityIndicator color={CORES.fundo} />
                ) : (
                  <Text
                    style={[
                      styles.textoSalvar,
                      !temValor && styles.textoSalvarDesabilitado,
                    ]}>
                    {rotuloSalvar}
                  </Text>
                )}
              </Pressable>

              {emEdicao && onExcluir && (
                <Button
                  mode="text"
                  textColor={CORES.vermelho}
                  icon="trash-can-outline"
                  onPress={() => setConfirmandoExclusao(true)}
                  disabled={ocupado}
                  testID="botao-excluir">
                  Excluir
                </Button>
              )}
            </ScrollView>

            <Snackbar
              visible={mensagemErro !== null}
              onDismiss={() => setMensagemErro(null)}
              action={{label: 'OK', onPress: () => setMensagemErro(null)}}
              testID="sheet-snackbar">
              {mensagemErro ?? ''}
            </Snackbar>
          </View>
        </View>
        <ConfirmarExclusaoDialog
          visivel={confirmandoExclusao}
          descricao={transacao?.descricao}
          carregando={excluindo}
          onCancelar={() => setConfirmandoExclusao(false)}
          onConfirmar={excluir}
        />
      </Portal.Host>
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  titulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CORES.texto,
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
  rotulo: {
    fontSize: 12,
    color: CORES.textoApagado,
    letterSpacing: 1,
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
  linhaChips: {
    flexDirection: 'row',
    gap: 8,
  },
  rotuloSecao: {
    fontSize: 14,
    color: CORES.textoSecundario,
    marginBottom: 8,
  },
  linhaCategorias: {
    gap: 8,
  },
  categoria: {
    minWidth: 72,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: CORES.realce,
  },
  textoCategoria: {
    fontSize: 10,
    color: CORES.textoSecundario,
  },
  contornoDescricao: {
    borderRadius: 14,
  },
  descricao: {
    backgroundColor: CORES.superficie,
  },
  teclado: {
    gap: 8,
  },
  linhaTeclado: {
    flexDirection: 'row',
    gap: 8,
  },
  tecla: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.realce,
  },
  teclaApagar: {
    backgroundColor: comAlfa(CORES.vermelho, 0.1),
  },
  teclaPressionada: {
    opacity: 0.6,
  },
  textoTecla: {
    fontFamily: FONTE_MONO,
    fontSize: 20,
    color: CORES.texto,
  },
  botaoSalvar: {
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoSalvarDesabilitado: {
    backgroundColor: CORES.realceForte,
  },
  textoSalvar: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CORES.fundo,
  },
  textoSalvarDesabilitado: {
    color: CORES.textoApagado,
  },
});

export default NovoLancamentoSheet;
