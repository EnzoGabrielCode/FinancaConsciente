import React, {useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  Button,
  Chip,
  HelperText,
  Icon,
  Menu,
  Portal,
  Snackbar,
  TextInput,
} from 'react-native-paper';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {categoriasDo} from '../../domain/categorias';
import {validarImagemComprovante} from '../../domain/comprovante';
import {hojeISO} from '../../domain/datas';
import {
  centavosParaDigitado,
  formatarDigitado,
  paraCentavos,
} from '../../domain/dinheiro';
import type {PossivelDuplicata} from '../../domain/entities/Duplicata';
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
import {
  seletorImagemPadrao,
  type SeletorImagem,
} from '../servicos/seletorImagem';
import {CORES, comAlfa, corDoTipo} from '../theme/cores';
import {DEGRADES, DIAGONAL} from '../theme/degrades';
import {FONTES} from '../theme/fontes';
import {mensagemDeErro} from '../utils/mensagemDeErro';
import AlertaDuplicataDialog from './AlertaDuplicataDialog';
import ConfirmarExclusaoDialog from './ConfirmarExclusaoDialog';
import TecladoNumerico from './TecladoNumerico';

interface Props {
  visivel: boolean;
  transacao?: Transacao | null;
  onFechar: () => void;
  onSalvar: (dados: DadosTransacao) => Promise<void>;
  onExcluir?: (id: number) => Promise<void>;
  onVerificarDuplicatas?: (
    dados: DadosTransacao,
  ) => Promise<PossivelDuplicata[]>;
  seletorImagem?: SeletorImagem;
}

interface AlertaDuplicata {
  dados: DadosTransacao;
  duplicatas: PossivelDuplicata[];
}

type OrigemMenu = 'camera' | 'trocar';

function NovoLancamentoSheet({
  visivel,
  transacao,
  onFechar,
  onSalvar,
  onExcluir,
  onVerificarDuplicatas,
  seletorImagem = seletorImagemPadrao,
}: Props): React.JSX.Element {
  const emEdicao = Boolean(transacao);
  const insets = useSafeAreaInsets();

  const [tipo, setTipo] = useState<TipoTransacao>('despesa');
  const [valor, setValor] = useState('');
  const [recorrencia, setRecorrencia] = useState<Recorrencia>('variavel');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');
  const [erros, setErros] = useState<ErrosTransacao>({});
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [comprovanteUri, setComprovanteUri] = useState<string | null>(null);
  const [miniaturaFalhou, setMiniaturaFalhou] = useState(false);
  const [menuAberto, setMenuAberto] = useState<OrigemMenu | null>(null);
  const [visualizando, setVisualizando] = useState(false);
  const [alerta, setAlerta] = useState<AlertaDuplicata | null>(null);

  useEffect(() => {
    if (!visivel) {
      return;
    }
    setTipo(transacao?.tipo ?? 'despesa');
    setValor(transacao ? centavosParaDigitado(transacao.valorCentavos) : '');
    setRecorrencia(transacao?.recorrencia ?? 'variavel');
    setCategoria(transacao?.categoria ?? null);
    setDescricao(transacao?.descricao ?? '');
    setErros({});
    setSalvando(false);
    setConfirmandoExclusao(false);
    setExcluindo(false);
    setMensagemErro(null);
    setComprovanteUri(transacao?.comprovanteUri ?? null);
    setMiniaturaFalhou(false);
    setMenuAberto(null);
    setVisualizando(false);
    setAlerta(null);
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
    if (novo === 'receita') {
      setComprovanteUri(null);
    }
    setErros({});
  };

  const anexarComprovante = async (origem: 'camera' | 'galeria') => {
    setMenuAberto(null);
    try {
      const imagem =
        origem === 'camera'
          ? await seletorImagem.tirarFoto()
          : await seletorImagem.escolherDaGaleria();
      if (!imagem) {
        return;
      }
      const erro = validarImagemComprovante(imagem);
      if (erro) {
        setMensagemErro(erro);
        return;
      }
      setComprovanteUri(imagem.uri);
      setMiniaturaFalhou(false);
    } catch (erro) {
      setMensagemErro(mensagemDeErro(erro));
    }
  };

  const removerComprovante = () => {
    setComprovanteUri(null);
    setMiniaturaFalhou(false);
  };

  const itensMenuComprovante = (
    <>
      <Menu.Item
        leadingIcon="camera"
        title="Tirar foto"
        onPress={() => anexarComprovante('camera')}
        testID="menu-tirar-foto"
      />
      <Menu.Item
        leadingIcon="image"
        title="Escolher da galeria"
        onPress={() => anexarComprovante('galeria')}
        testID="menu-galeria"
      />
    </>
  );

  const digitarValor = (novoValor: string) => {
    setValor(novoValor);
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
      comprovanteUri: tipo === 'despesa' ? comprovanteUri : null,
    });
    if (!resultado.valido) {
      setErros(resultado.erros);
      return;
    }
    const dados = resultado.dados;
    setSalvando(true);
    if (!emEdicao && onVerificarDuplicatas) {
      const duplicatas = await buscarDuplicatas(dados);
      if (duplicatas.length > 0) {
        setAlerta({dados, duplicatas});
        setSalvando(false);
        return;
      }
    }
    await persistir(dados);
  };

  const buscarDuplicatas = async (
    dados: DadosTransacao,
  ): Promise<PossivelDuplicata[]> => {
    try {
      return (await onVerificarDuplicatas?.(dados)) ?? [];
    } catch {
      // O alerta é só uma ajuda: se a verificação falhar, o lançamento segue.
      return [];
    }
  };

  const persistir = async (dados: DadosTransacao) => {
    setSalvando(true);
    try {
      await onSalvar(dados);
    } catch (erro) {
      setMensagemErro(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  const salvarMesmoAssim = () => {
    if (!alerta) {
      return;
    }
    setAlerta(null);
    persistir(alerta.dados);
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
                <View style={styles.linhaValorAcoes}>
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
                  {tipo === 'despesa' && (
                    <Menu
                      visible={menuAberto === 'camera'}
                      onDismiss={() => setMenuAberto(null)}
                      anchor={
                        <Pressable
                          onPress={() => setMenuAberto('camera')}
                          disabled={ocupado}
                          accessibilityRole="button"
                          accessibilityLabel="Anexar comprovante"
                          testID="botao-camera"
                          style={styles.botaoCamera}>
                          <Icon source="camera" size={18} color={CORES.azul} />
                        </Pressable>
                      }>
                      {itensMenuComprovante}
                    </Menu>
                  )}
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
                            backgroundColor: comAlfa(item.cor, 0.125),
                            borderColor: comAlfa(item.cor, 0.375),
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

              {tipo === 'despesa' && comprovanteUri && (
                <View testID="comprovante-anexado">
                  <Text style={styles.rotuloSecao}>Comprovante</Text>
                  <View style={styles.linhaComprovante}>
                    {miniaturaFalhou ? (
                      <View
                        style={[styles.miniatura, styles.miniaturaQuebrada]}
                        testID="comprovante-quebrado">
                        <Icon
                          source="image-broken-variant"
                          size={22}
                          color={CORES.textoSecundario}
                        />
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => setVisualizando(true)}
                        accessibilityRole="imagebutton"
                        accessibilityLabel="Ver comprovante"
                        testID="comprovante-miniatura">
                        <Image
                          source={{uri: comprovanteUri}}
                          style={styles.miniatura}
                          onError={() => setMiniaturaFalhou(true)}
                          testID="comprovante-imagem"
                        />
                      </Pressable>
                    )}
                    <Text style={styles.textoComprovante} numberOfLines={2}>
                      {miniaturaFalhou ? 'Comprovante não encontrado' : ''}
                    </Text>
                    <Menu
                      visible={menuAberto === 'trocar'}
                      onDismiss={() => setMenuAberto(null)}
                      anchor={
                        <Button
                          mode="text"
                          textColor={CORES.azul}
                          onPress={() => setMenuAberto('trocar')}
                          disabled={ocupado}
                          testID="comprovante-trocar">
                          Trocar
                        </Button>
                      }>
                      {itensMenuComprovante}
                    </Menu>
                    <Button
                      mode="text"
                      textColor={CORES.vermelho}
                      onPress={removerComprovante}
                      disabled={ocupado}
                      testID="comprovante-remover">
                      Remover
                    </Button>
                  </View>
                </View>
              )}

              <TecladoNumerico
                valor={valor}
                onChange={digitarValor}
                desabilitado={ocupado}
              />

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
                    ? [
                        styles.botaoSalvarAtivo,
                        // Fundo sólido sob o degradê para o Android desenhar a sombra.
                        {backgroundColor: corTipo, shadowColor: corTipo},
                      ]
                    : styles.botaoSalvarDesabilitado,
                ]}>
                {temValor && (
                  <LinearGradient
                    colors={
                      tipo === 'receita' ? DEGRADES.verde : DEGRADES.vermelho
                    }
                    {...DIAGONAL}
                    style={styles.degradeBotao}
                  />
                )}
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
        <AlertaDuplicataDialog
          visivel={alerta !== null}
          duplicatas={alerta?.duplicatas ?? []}
          valorCentavos={alerta?.dados.valorCentavos ?? 0}
          data={alerta?.dados.data ?? hojeISO()}
          salvando={salvando}
          onRevisar={() => setAlerta(null)}
          onSalvarMesmoAssim={salvarMesmoAssim}
        />
      </Portal.Host>

      <Modal
        visible={visualizando && comprovanteUri !== null}
        animationType="fade"
        onRequestClose={() => setVisualizando(false)}>
        <View style={styles.visualizador} testID="visualizador-comprovante">
          {comprovanteUri && (
            <Image
              source={{uri: comprovanteUri}}
              style={styles.imagemCheia}
              resizeMode="contain"
              accessibilityLabel="Foto do comprovante"
            />
          )}
          <Pressable
            style={[
              styles.botaoFechar,
              styles.fecharVisualizador,
              {top: insets.top + 16},
            ]}
            onPress={() => setVisualizando(false)}
            accessibilityRole="button"
            accessibilityLabel="Fechar comprovante"
            testID="fechar-visualizador">
            <Icon source="close" size={18} color={CORES.textoSecundario} />
          </Pressable>
        </View>
      </Modal>
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
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    elevation: 16,
  },
  alca: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
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
    fontFamily: FONTES.negrito,
    fontSize: 18,
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
    padding: 3,
    borderRadius: 12,
    backgroundColor: CORES.realce,
  },
  opcaoTipo: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  textoTipo: {
    fontFamily: FONTES.seminegrito,
    fontSize: 13,
    color: CORES.textoApagado,
  },
  rotulo: {
    fontFamily: FONTES.regular,
    fontSize: 12,
    color: CORES.textoApagado,
    letterSpacing: 1,
  },
  linhaValorAcoes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  linhaValor: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  botaoCamera: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(100,181,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(100,181,246,0.25)',
  },
  moeda: {
    fontFamily: FONTES.monoMedio,
    fontSize: 14,
    color: CORES.textoSecundario,
  },
  valor: {
    flexShrink: 1,
    fontFamily: FONTES.monoExtraNegrito,
    fontSize: 44,
    letterSpacing: -0.9,
  },
  linhaChips: {
    flexDirection: 'row',
    gap: 8,
  },
  rotuloSecao: {
    fontFamily: FONTES.regular,
    fontSize: 12,
    letterSpacing: 0.5,
    color: CORES.textoSecundario,
    marginBottom: 10,
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
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: CORES.realce,
  },
  textoCategoria: {
    fontFamily: FONTES.medio,
    fontSize: 10,
    color: CORES.textoSecundario,
  },
  contornoDescricao: {
    borderRadius: 14,
  },
  descricao: {
    backgroundColor: CORES.superficie,
  },
  linhaComprovante: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniatura: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: CORES.realce,
  },
  miniaturaQuebrada: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoComprovante: {
    flex: 1,
    fontFamily: FONTES.regular,
    fontSize: 12,
    color: CORES.textoSecundario,
  },
  visualizador: {
    flex: 1,
    backgroundColor: '#000',
  },
  imagemCheia: {
    flex: 1,
    width: '100%',
  },
  fecharVisualizador: {
    position: 'absolute',
    right: 16,
  },
  botaoSalvar: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoSalvarAtivo: {
    elevation: 6,
  },
  degradeBotao: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    overflow: 'hidden',
  },
  botaoSalvarDesabilitado: {
    backgroundColor: CORES.realceForte,
  },
  textoSalvar: {
    fontFamily: FONTES.extraNegrito,
    fontSize: 15,
    color: CORES.fundo,
  },
  textoSalvarDesabilitado: {
    color: CORES.textoApagado,
  },
});

export default NovoLancamentoSheet;
