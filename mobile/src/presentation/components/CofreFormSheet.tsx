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
import {anoMesDe, formatarMesCurto, hojeISO} from '../../domain/datas';
import {
  aplicarTecla,
  centavosParaDigitado,
  formatarCentavos,
  paraCentavos,
} from '../../domain/dinheiro';
import type {Cofre, DadosCofre} from '../../domain/entities/Cofre';
import {
  avancarMes,
  fraseDoPlano,
  MAX_ANOS_PRAZO,
  mesesAFrente,
  parcelaDoPlano,
  planoDaMeta,
  type PlanoMeta,
} from '../../domain/metas';
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

const ATALHOS_PRAZO = [
  {meses: 3, rotulo: '3 meses'},
  {meses: 6, rotulo: '6 meses'},
  {meses: 12, rotulo: '1 ano'},
  {meses: 24, rotulo: '2 anos'},
];

function previaDoPlano(plano: PlanoMeta): string {
  const parcela = parcelaDoPlano(plano);
  return parcela
    ? `Guarde ${parcela.valor} por ${parcela.unidade} até ${parcela.ate}`
    : fraseDoPlano(plano);
}

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
  const [prazo, setPrazo] = useState<string | null>(null);
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
    setPrazo(cofre?.prazo ?? null);
    setErros({});
    setErroGeral(null);
    setSalvando(false);
  }, [visivel, cofre]);

  const temNome = nome.trim() !== '';
  const metaCentavos = meta === '' ? null : paraCentavos(meta);
  const temMeta = metaCentavos !== null && metaCentavos > 0;
  const hoje = hojeISO();
  const mesAtual = anoMesDe(hoje);
  const ultimoMes = mesesAFrente(hoje, MAX_ANOS_PRAZO * 12);
  const prazoDesabilitado = !temMeta || salvando;
  const podeVoltarMes =
    !prazoDesabilitado && prazo !== null && prazo > mesAtual;
  const podeAvancarMes =
    !prazoDesabilitado && (prazo === null || prazo < ultimoMes);
  const plano = planoDaMeta(
    {metaCentavos, prazo, saldoCentavos: cofre?.saldoCentavos ?? 0},
    hoje,
  );

  const mudarPrazo = (novoPrazo: string | null) => {
    setPrazo(novoPrazo);
    setErros(({prazo: _, ...resto}) => resto);
  };

  const avancarPrazo = () => {
    const proximo = avancarMes(prazo ?? mesAtual, 1);
    // Um prazo vencido pula direto para o mês atual.
    mudarPrazo(proximo < mesAtual ? mesAtual : proximo);
  };

  const fechar = () => {
    if (!salvando) {
      onFechar();
    }
  };

  const salvar = async () => {
    const resultado = validarCofre(
      {nome, icone, cor, metaCentavos, prazo},
      nomesExistentes.filter(existente => existente !== cofre?.nome),
      hoje,
      cofre?.prazo ?? null,
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
                  const novaMeta = filtrarMeta(texto);
                  setMeta(novaMeta);
                  setErros(({metaCentavos: _, ...resto}) => resto);
                  if (!(paraCentavos(novaMeta) > 0)) {
                    mudarPrazo(null);
                  }
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

            <View style={prazoDesabilitado && styles.secaoDesabilitada}>
              <Text style={styles.rotulo}>PRAZO (OPCIONAL)</Text>
              <View style={styles.linhaPrazo}>
                <Pressable
                  onPress={() => prazo && mudarPrazo(avancarMes(prazo, -1))}
                  disabled={!podeVoltarMes}
                  accessibilityRole="button"
                  accessibilityLabel="Mês anterior"
                  accessibilityState={{disabled: !podeVoltarMes}}
                  testID="cofre-prazo-anterior"
                  style={[
                    styles.setaPrazo,
                    !podeVoltarMes && styles.setaDesabilitada,
                  ]}>
                  <Icon source="chevron-left" size={20} color={CORES.texto} />
                </Pressable>
                <Text style={styles.mesPrazo} testID="cofre-prazo-mes">
                  {prazo ? formatarMesCurto(prazo) : 'Sem prazo'}
                </Text>
                <Pressable
                  onPress={avancarPrazo}
                  disabled={!podeAvancarMes}
                  accessibilityRole="button"
                  accessibilityLabel="Próximo mês"
                  accessibilityState={{disabled: !podeAvancarMes}}
                  testID="cofre-prazo-proximo"
                  style={[
                    styles.setaPrazo,
                    !podeAvancarMes && styles.setaDesabilitada,
                  ]}>
                  <Icon source="chevron-right" size={20} color={CORES.texto} />
                </Pressable>
              </View>
              <View style={styles.atalhosPrazo}>
                {[
                  ...ATALHOS_PRAZO.map(({meses, rotulo}) => ({
                    id: String(meses),
                    rotulo,
                    valor: mesesAFrente(hoje, meses),
                  })),
                  {id: 'sem', rotulo: 'Sem prazo', valor: null},
                ].map(({id, rotulo, valor}) => {
                  const selecionado = temMeta && prazo === valor;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => mudarPrazo(valor)}
                      disabled={prazoDesabilitado}
                      accessibilityRole="button"
                      accessibilityState={{
                        disabled: prazoDesabilitado,
                        selected: selecionado,
                      }}
                      accessibilityLabel={rotulo}
                      testID={`cofre-prazo-atalho-${id}`}
                      style={[
                        styles.atalhoPrazo,
                        selecionado && {
                          backgroundColor: comAlfa(cor, 0.15),
                          borderColor: cor,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.textoAtalho,
                          selecionado && {color: cor},
                        ]}>
                        {rotulo}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {plano && (
                <Text style={styles.previaPrazo} testID="cofre-prazo-previa">
                  {previaDoPlano(plano)}
                </Text>
              )}
              {erros.prazo && (
                <HelperText type="error" testID="cofre-erro-prazo">
                  {erros.prazo}
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
    // Com o paddingBottom 8 do cabeçalho, dá 20 até o rótulo "ÍCONE".
    paddingTop: 12,
    paddingBottom: 24,
    gap: 18,
  },
  rotulo: {
    fontFamily: FONTES.seminegrito,
    fontSize: 11,
    color: CORES.textoSecundario,
    letterSpacing: 0.7,
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
  secaoDesabilitada: {
    opacity: 0.4,
  },
  linhaPrazo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  setaPrazo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.realceForte,
  },
  setaDesabilitada: {
    opacity: 0.35,
  },
  mesPrazo: {
    fontFamily: FONTES.seminegrito,
    fontSize: 15,
    color: CORES.texto,
  },
  atalhosPrazo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  atalhoPrazo: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: CORES.realce,
  },
  textoAtalho: {
    fontFamily: FONTES.medio,
    fontSize: 12,
    color: CORES.textoSecundario,
  },
  previaPrazo: {
    marginTop: 10,
    fontFamily: FONTES.monoMedio,
    fontSize: 12,
    color: CORES.texto,
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
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
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

export default CofreFormSheet;
