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
import {HelperText, Icon, TextInput} from 'react-native-paper';

import {
  CORES_COFRE,
  ICONES_COFRE,
  MAX_NOME_COFRE,
  validarCofre,
  type ErrosCofre,
} from '../../domain/cofres';
import {
  aplicarTecla,
  centavosParaDigitado,
  formatarCentavos,
  paraCentavos,
} from '../../domain/dinheiro';
import type {Cofre, DadosCofre} from '../../domain/entities/Cofre';
import {CORES, comAlfa} from '../theme/cores';
import {FONTES} from '../theme/fontes';
import {mensagemDeErro} from '../utils/mensagemDeErro';

interface Props {
  visivel: boolean;
  cofre?: Cofre | null;
  nomesExistentes?: string[];
  onFechar: () => void;
  onSalvar: (dados: DadosCofre) => Promise<void>;
}

const [ICONE_PADRAO] = ICONES_COFRE;
const [COR_PADRAO] = CORES_COFRE;

export function filtrarMeta(texto: string): string {
  return Array.from(texto.replace(/\./g, ',')).reduce(aplicarTecla, '');
}

function CofreFormSheet({
  visivel,
  cofre,
  nomesExistentes = [],
  onFechar,
  onSalvar,
}: Props): React.JSX.Element {
  const emEdicao = Boolean(cofre);

  const [icone, setIcone] = useState<string>(ICONE_PADRAO);
  const [cor, setCor] = useState<string>(COR_PADRAO);
  const [nome, setNome] = useState('');
  const [meta, setMeta] = useState('');
  const [erros, setErros] = useState<ErrosCofre>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!visivel) {
      return;
    }
    setIcone(cofre?.icone ?? ICONE_PADRAO);
    setCor(cofre?.cor ?? COR_PADRAO);
    setNome(cofre?.nome ?? '');
    setMeta(
      cofre?.metaCentavos ? centavosParaDigitado(cofre.metaCentavos) : '',
    );
    setErros({});
    setErroGeral(null);
    setSalvando(false);
  }, [visivel, cofre]);

  const temNome = nome.trim() !== '';
  const metaCentavos = meta === '' ? null : paraCentavos(meta);

  const fechar = () => {
    if (!salvando) {
      onFechar();
    }
  };

  const salvar = async () => {
    const resultado = validarCofre(
      {nome, icone, cor, metaCentavos},
      nomesExistentes.filter(existente => existente !== cofre?.nome),
    );
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

  const rotuloSalvar = emEdicao ? 'Salvar alterações' : 'Criar Cofre';
  const desabilitado = !temNome || salvando;

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
        <View style={styles.folha} testID="cofre-form-sheet">
          <View style={styles.alca} />
          <View style={styles.cabecalho}>
            <Text style={styles.titulo} testID="cofre-form-titulo">
              {emEdicao ? 'Editar Cofre' : 'Novo Cofre'}
            </Text>
            <Pressable
              style={styles.botaoFechar}
              onPress={fechar}
              disabled={salvando}
              accessibilityRole="button"
              accessibilityLabel="Fechar"
              testID="cofre-form-fechar">
              <Icon source="close" size={18} color={CORES.textoSecundario} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.conteudo}>
            <View>
              <Text style={styles.rotulo}>ÍCONE</Text>
              <View style={styles.grade} accessibilityRole="radiogroup">
                {ICONES_COFRE.map(opcao => {
                  const selecionado = opcao === icone;
                  return (
                    <Pressable
                      key={opcao}
                      onPress={() => {
                        setIcone(opcao);
                        setErros(({icone: _, ...resto}) => resto);
                      }}
                      disabled={salvando}
                      accessibilityRole="radio"
                      accessibilityState={{checked: selecionado}}
                      accessibilityLabel={`Ícone ${opcao}`}
                      testID={`cofre-icone-${opcao}`}
                      style={[
                        styles.opcaoIcone,
                        selecionado && {
                          backgroundColor: comAlfa(cor, 0.15),
                          borderColor: cor,
                        },
                      ]}>
                      <Text style={styles.emojiOpcao}>{opcao}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {erros.icone && (
                <HelperText type="error">{erros.icone}</HelperText>
              )}
            </View>

            <View>
              <Text style={styles.rotulo}>COR</Text>
              <View style={styles.linhaCores} accessibilityRole="radiogroup">
                {CORES_COFRE.map(opcao => {
                  const selecionada = opcao === cor;
                  return (
                    <Pressable
                      key={opcao}
                      onPress={() => {
                        setCor(opcao);
                        setErros(({cor: _, ...resto}) => resto);
                      }}
                      disabled={salvando}
                      accessibilityRole="radio"
                      accessibilityState={{checked: selecionada}}
                      accessibilityLabel={`Cor ${opcao}`}
                      testID={`cofre-cor-${opcao}`}
                      style={[
                        styles.anel,
                        selecionada && {borderColor: opcao},
                      ]}>
                      <View
                        style={[styles.bolinha, {backgroundColor: opcao}]}
                      />
                    </Pressable>
                  );
                })}
              </View>
              {erros.cor && <HelperText type="error">{erros.cor}</HelperText>}
            </View>

            <View>
              <Text style={styles.rotulo}>NOME DO COFRE</Text>
              <TextInput
                mode="outlined"
                placeholder="Ex: Férias no Caribe"
                value={nome}
                onChangeText={texto => {
                  setNome(texto);
                  setErros(({nome: _, ...resto}) => resto);
                }}
                maxLength={MAX_NOME_COFRE}
                disabled={salvando}
                error={Boolean(erros.nome)}
                outlineStyle={styles.contorno}
                style={styles.campo}
                textColor={CORES.texto}
                placeholderTextColor={CORES.textoApagado}
                outlineColor={CORES.realceForte}
                activeOutlineColor={cor}
                testID="cofre-nome-input"
              />
              {erros.nome && (
                <HelperText type="error" testID="cofre-erro-nome">
                  {erros.nome}
                </HelperText>
              )}
            </View>

            <View>
              <Text style={styles.rotulo}>META (OPCIONAL)</Text>
              <TextInput
                mode="outlined"
                placeholder="0,00"
                value={meta}
                onChangeText={texto => {
                  setMeta(filtrarMeta(texto));
                  setErros(({metaCentavos: _, ...resto}) => resto);
                }}
                keyboardType="decimal-pad"
                disabled={salvando}
                error={Boolean(erros.metaCentavos)}
                left={<TextInput.Affix text="R$" />}
                outlineStyle={styles.contorno}
                style={styles.campo}
                textColor={CORES.texto}
                placeholderTextColor={CORES.textoApagado}
                outlineColor={CORES.realceForte}
                activeOutlineColor={cor}
                testID="cofre-meta-input"
              />
              {erros.metaCentavos && (
                <HelperText type="error" testID="cofre-erro-meta">
                  {erros.metaCentavos}
                </HelperText>
              )}
            </View>

            <View
              style={[styles.previa, {borderColor: comAlfa(cor, 0.2)}]}
              testID="cofre-previa">
              <View
                style={[
                  styles.iconePrevia,
                  {backgroundColor: comAlfa(cor, 0.12)},
                ]}>
                <Text style={styles.emojiPrevia}>{icone}</Text>
              </View>
              <View style={styles.textosPrevia}>
                <Text style={styles.nomePrevia} numberOfLines={1}>
                  {nome.trim() || 'Nome do cofre'}
                </Text>
                <Text style={styles.metaPrevia} testID="cofre-previa-meta">
                  {metaCentavos && metaCentavos > 0
                    ? `Meta: ${formatarCentavos(metaCentavos)}`
                    : 'Sem meta'}
                </Text>
              </View>
            </View>

            {erroGeral && (
              <HelperText type="error" testID="cofre-form-erro">
                {erroGeral}
              </HelperText>
            )}

            <Pressable
              onPress={salvar}
              disabled={desabilitado}
              accessibilityRole="button"
              accessibilityState={{disabled: desabilitado, busy: salvando}}
              accessibilityLabel={rotuloSalvar}
              testID="cofre-form-salvar"
              style={[
                styles.botaoSalvar,
                temNome
                  ? {backgroundColor: cor}
                  : styles.botaoSalvarDesabilitado,
              ]}>
              {salvando ? (
                <ActivityIndicator color={CORES.fundo} />
              ) : (
                <Text
                  style={[
                    styles.textoSalvar,
                    !temNome && styles.textoSalvarDesabilitado,
                  ]}>
                  {rotuloSalvar}
                </Text>
              )}
            </Pressable>
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
    gap: 18,
  },
  rotulo: {
    fontFamily: FONTES.regular,
    fontSize: 12,
    color: CORES.textoApagado,
    letterSpacing: 1,
    marginBottom: 8,
  },
  grade: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  opcaoIcone: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: CORES.realce,
  },
  emojiOpcao: {
    fontFamily: FONTES.regular,
    fontSize: 20,
  },
  linhaCores: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  anel: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  bolinha: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  contorno: {
    borderRadius: 14,
  },
  campo: {
    backgroundColor: CORES.superficie,
  },
  previa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: CORES.realce,
  },
  iconePrevia: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiPrevia: {
    fontFamily: FONTES.regular,
    fontSize: 22,
  },
  textosPrevia: {
    flex: 1,
    gap: 2,
  },
  nomePrevia: {
    fontFamily: FONTES.negrito,
    fontSize: 14,
    color: CORES.texto,
  },
  metaPrevia: {
    fontFamily: FONTES.regular,
    fontSize: 12,
    color: CORES.textoSecundario,
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
    fontFamily: FONTES.negrito,
    fontSize: 16,
    color: CORES.fundo,
  },
  textoSalvarDesabilitado: {
    color: CORES.textoApagado,
  },
});

export default CofreFormSheet;
