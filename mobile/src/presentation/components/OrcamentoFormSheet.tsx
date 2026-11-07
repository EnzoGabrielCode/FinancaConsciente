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
import {Button, HelperText, Icon, Portal} from 'react-native-paper';

import type {Categoria} from '../../domain/categorias';
import {
  centavosParaDigitado,
  formatarDigitado,
  paraCentavos,
} from '../../domain/dinheiro';
import type {DadosOrcamento, Orcamento} from '../../domain/entities/Orcamento';
import {
  categoriaDoOrcamento,
  validarOrcamento,
  type ErrosOrcamento,
} from '../../domain/orcamentos';
import {CORES, comAlfa} from '../theme/cores';
import {FONTES} from '../theme/fontes';
import {mensagemDeErro} from '../utils/mensagemDeErro';
import ConfirmarExclusaoDialog from './ConfirmarExclusaoDialog';
import TecladoNumerico from './TecladoNumerico';

interface Props {
  visivel: boolean;
  orcamento?: Orcamento | null;
  categoriasLivres: Categoria[];
  onFechar: () => void;
  onSalvar: (dados: DadosOrcamento) => Promise<void>;
  onExcluir: (id: number) => Promise<void>;
}

function OrcamentoFormSheet({
  visivel,
  orcamento,
  categoriasLivres,
  onFechar,
  onSalvar,
  onExcluir,
}: Props): React.JSX.Element {
  const [categoria, setCategoria] = useState<string | null>(null);
  const [valor, setValor] = useState('');
  const [erros, setErros] = useState<ErrosOrcamento>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    if (!visivel) {
      return;
    }
    setCategoria(orcamento?.categoria ?? null);
    setValor(orcamento ? centavosParaDigitado(orcamento.limiteCentavos) : '');
    setErros({});
    setErroGeral(null);
    setSalvando(false);
    setConfirmandoExclusao(false);
    setExcluindo(false);
  }, [visivel, orcamento]);

  const ocupado = salvando || excluindo;
  const limiteCentavos = paraCentavos(valor);
  const podeSalvar = categoria !== null && limiteCentavos > 0;
  const desabilitado = !podeSalvar || ocupado;
  const categoriaFixa = orcamento
    ? categoriaDoOrcamento(orcamento.categoria)
    : null;
  const rotuloSalvar = orcamento ? 'Salvar alterações' : 'Salvar';

  const fechar = () => {
    if (!ocupado) {
      onFechar();
    }
  };

  const salvar = async () => {
    const resultado = validarOrcamento({
      categoria: categoria ?? '',
      limiteCentavos,
    });
    if (!resultado.valido) {
      setErros(resultado.erros);
      return;
    }
    setErroGeral(null);
    setSalvando(true);
    try {
      await onSalvar(resultado.dados);
    } catch (erro) {
      setErroGeral(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (!orcamento) {
      return;
    }
    setExcluindo(true);
    try {
      await onExcluir(orcamento.id);
    } catch (erro) {
      setErroGeral(mensagemDeErro(erro));
    } finally {
      setExcluindo(false);
      setConfirmandoExclusao(false);
    }
  };

  return (
    <Modal
      visible={visivel}
      animationType="slide"
      transparent
      onRequestClose={fechar}>
      {/* Host próprio: o diálogo precisa abrir por cima deste Modal. */}
      <Portal.Host>
        <View style={styles.fundo}>
          <Pressable
            style={styles.areaFechar}
            onPress={fechar}
            accessibilityLabel="Fechar"
          />
          <View style={styles.folha} testID="orcamento-form-sheet">
            <View style={styles.alca} />
            <View style={styles.cabecalho}>
              <Text style={styles.titulo} testID="orcamento-form-titulo">
                {orcamento ? 'Editar Orçamento' : 'Novo Orçamento'}
              </Text>
              <Pressable
                style={styles.botaoFechar}
                onPress={fechar}
                disabled={ocupado}
                accessibilityRole="button"
                accessibilityLabel="Fechar"
                testID="orcamento-form-fechar">
                <Icon source="close" size={18} color={CORES.textoSecundario} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.conteudo}>
              <View>
                <Text style={styles.rotulo}>CATEGORIA</Text>
                {categoriaFixa ? (
                  <View
                    style={[
                      styles.categoria,
                      styles.categoriaFixa,
                      {
                        backgroundColor: comAlfa(categoriaFixa.cor, 0.125),
                        borderColor: comAlfa(categoriaFixa.cor, 0.375),
                      },
                    ]}
                    testID="orcamento-categoria-fixa">
                    <Icon
                      source={categoriaFixa.icone}
                      size={18}
                      color={categoriaFixa.cor}
                    />
                    <Text
                      style={[
                        styles.textoCategoria,
                        {color: categoriaFixa.cor},
                      ]}>
                      {categoriaFixa.label}
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.linhaCategorias}
                    accessibilityRole="radiogroup">
                    {categoriasLivres.map(item => {
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
                          testID={`orcamento-categoria-${item.id}`}
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
                            color={
                              selecionada ? item.cor : CORES.textoSecundario
                            }
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
                )}
                {erros.categoria && (
                  <HelperText type="error">{erros.categoria}</HelperText>
                )}
              </View>

              <View>
                <Text style={styles.rotulo}>LIMITE MENSAL</Text>
                <View style={styles.linhaValor}>
                  <Text style={styles.moeda}>R$</Text>
                  <Text
                    style={styles.valor}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    accessibilityLabel={`Limite: ${formatarDigitado(
                      valor,
                    )} reais`}
                    testID="orcamento-valor">
                    {formatarDigitado(valor)}
                  </Text>
                </View>
                {erros.limiteCentavos && (
                  <HelperText type="error" testID="orcamento-erro-limite">
                    {erros.limiteCentavos}
                  </HelperText>
                )}
              </View>

              <TecladoNumerico
                valor={valor}
                onChange={novoValor => {
                  setValor(novoValor);
                  setErros(({limiteCentavos: _, ...resto}) => resto);
                }}
                desabilitado={ocupado}
              />

              {erroGeral && (
                <HelperText type="error" testID="orcamento-form-erro">
                  {erroGeral}
                </HelperText>
              )}

              <Pressable
                onPress={salvar}
                disabled={desabilitado}
                accessibilityRole="button"
                accessibilityState={{disabled: desabilitado, busy: salvando}}
                accessibilityLabel={rotuloSalvar}
                testID="orcamento-form-salvar"
                style={[
                  styles.botaoSalvar,
                  !podeSalvar && styles.botaoSalvarDesabilitado,
                ]}>
                {salvando ? (
                  <ActivityIndicator color={CORES.fundo} />
                ) : (
                  <Text
                    style={[
                      styles.textoSalvar,
                      !podeSalvar && styles.textoSalvarDesabilitado,
                    ]}>
                    {rotuloSalvar}
                  </Text>
                )}
              </Pressable>

              {orcamento && (
                <Button
                  mode="text"
                  textColor={CORES.vermelho}
                  icon="trash-can-outline"
                  onPress={() => setConfirmandoExclusao(true)}
                  disabled={ocupado}
                  testID="orcamento-form-excluir">
                  Excluir orçamento
                </Button>
              )}
            </ScrollView>
          </View>
        </View>

        <ConfirmarExclusaoDialog
          visivel={confirmandoExclusao}
          titulo="Excluir orçamento?"
          mensagem={`O teto de ${
            categoriaFixa?.label ?? ''
          } será removido. Seus lançamentos não mudam.`}
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
    paddingTop: 12,
    paddingBottom: 24,
    gap: 16,
  },
  rotulo: {
    fontFamily: FONTES.seminegrito,
    fontSize: 11,
    color: CORES.textoSecundario,
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  linhaCategorias: {
    gap: 8,
  },
  categoria: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: CORES.realce,
  },
  categoriaFixa: {
    alignSelf: 'flex-start',
  },
  textoCategoria: {
    fontFamily: FONTES.medio,
    fontSize: 13,
    color: CORES.textoSecundario,
  },
  linhaValor: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
  },
  moeda: {
    fontFamily: FONTES.monoMedio,
    fontSize: 18,
    color: CORES.textoSecundario,
  },
  valor: {
    flexShrink: 1,
    fontFamily: FONTES.monoExtraNegrito,
    fontSize: 36,
    color: CORES.verde,
  },
  botaoSalvar: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.verde,
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

export default OrcamentoFormSheet;
