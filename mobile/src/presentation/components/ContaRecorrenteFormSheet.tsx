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
import {Button, HelperText, Icon, Portal, TextInput} from 'react-native-paper';

import {CATEGORIAS_DESPESA} from '../../domain/categorias';
import {formatarDiaCurto, hojeISO, nomeMes} from '../../domain/datas';
import {
  centavosParaDigitado,
  formatarDigitado,
  paraCentavos,
} from '../../domain/dinheiro';
import type {
  ContaRecorrente,
  DadosContaRecorrente,
  FrequenciaConta,
} from '../../domain/entities/ContaRecorrente';
import {
  MAX_DESCRICAO_CONTA,
  mudouAgenda,
  primeiroVencimento,
  validarContaRecorrente,
  type ErrosContaRecorrente,
} from '../../domain/recorrencia';
import {CORES, comAlfa} from '../theme/cores';
import {FONTES} from '../theme/fontes';
import {mensagemDeErro} from '../utils/mensagemDeErro';
import ConfirmarExclusaoDialog from './ConfirmarExclusaoDialog';
import TecladoNumerico from './TecladoNumerico';

interface Props {
  visivel: boolean;
  conta?: ContaRecorrente | null;
  onFechar: () => void;
  onSalvar: (dados: DadosContaRecorrente) => Promise<void>;
  onExcluir: (id: number) => Promise<void>;
}

const FREQUENCIAS: {id: FrequenciaConta; rotulo: string}[] = [
  {id: 'mensal', rotulo: 'Mensal'},
  {id: 'anual', rotulo: 'Anual'},
];

const LEMBRETES = [
  {dias: 0, rotulo: 'No dia'},
  {dias: 1, rotulo: '1 dia antes'},
  {dias: 2, rotulo: '2 dias antes'},
  {dias: 3, rotulo: '3 dias antes'},
  {dias: 5, rotulo: '5 dias antes'},
  {dias: 7, rotulo: '7 dias antes'},
];

const LEMBRETE_PADRAO = 2;

interface PropsSeletor {
  id: string;
  rotulo: string;
  podeVoltar: boolean;
  podeAvancar: boolean;
  onVoltar: () => void;
  onAvancar: () => void;
}

function SeletorSetas({
  id,
  rotulo,
  podeVoltar,
  podeAvancar,
  onVoltar,
  onAvancar,
}: PropsSeletor): React.JSX.Element {
  return (
    <View style={styles.linhaSeletor}>
      <Pressable
        onPress={onVoltar}
        disabled={!podeVoltar}
        accessibilityRole="button"
        accessibilityLabel="Anterior"
        accessibilityState={{disabled: !podeVoltar}}
        testID={`${id}-anterior`}
        style={[styles.seta, !podeVoltar && styles.setaDesabilitada]}>
        <Icon source="chevron-left" size={20} color={CORES.texto} />
      </Pressable>
      <Text style={styles.textoSeletor} testID={id}>
        {rotulo}
      </Text>
      <Pressable
        onPress={onAvancar}
        disabled={!podeAvancar}
        accessibilityRole="button"
        accessibilityLabel="Próximo"
        accessibilityState={{disabled: !podeAvancar}}
        testID={`${id}-proximo`}
        style={[styles.seta, !podeAvancar && styles.setaDesabilitada]}>
        <Icon source="chevron-right" size={20} color={CORES.texto} />
      </Pressable>
    </View>
  );
}

function ContaRecorrenteFormSheet({
  visivel,
  conta,
  onFechar,
  onSalvar,
  onExcluir,
}: Props): React.JSX.Element {
  const hoje = hojeISO();
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [frequencia, setFrequencia] = useState<FrequenciaConta>('mensal');
  const [dia, setDia] = useState(1);
  const [mes, setMes] = useState(1);
  const [lembrete, setLembrete] = useState(LEMBRETE_PADRAO);
  const [erros, setErros] = useState<ErrosContaRecorrente>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    if (!visivel) {
      return;
    }
    const agora = hojeISO();
    setDescricao(conta?.descricao ?? '');
    setValor(conta ? centavosParaDigitado(conta.valorCentavos) : '');
    setCategoria(conta?.categoria ?? null);
    setFrequencia(conta?.frequencia ?? 'mensal');
    setDia(conta?.dia ?? Number(agora.slice(8)));
    setMes(conta?.mes ?? Number(agora.slice(5, 7)));
    setLembrete(conta?.lembrarDiasAntes ?? LEMBRETE_PADRAO);
    setErros({});
    setErroGeral(null);
    setSalvando(false);
    setConfirmandoExclusao(false);
    setExcluindo(false);
  }, [visivel, conta]);

  const ocupado = salvando || excluindo;
  const valorCentavos = paraCentavos(valor);
  const podeSalvar =
    descricao.trim() !== '' && valorCentavos > 0 && categoria !== null;
  const desabilitado = !podeSalvar || ocupado;
  const anual = frequencia === 'anual';
  const agenda = {frequencia, dia, mes: anual ? mes : null};
  const mantemProxima = conta && !mudouAgenda(conta, agenda);
  const previa = mantemProxima
    ? `Próximo lançamento: ${formatarDiaCurto(conta.proxima)}`
    : `Primeiro lançamento: ${formatarDiaCurto(
        primeiroVencimento(agenda, hoje),
      )}`;
  const rotuloSalvar = conta ? 'Salvar alterações' : 'Salvar';

  const fechar = () => {
    if (!ocupado) {
      onFechar();
    }
  };

  const salvar = async () => {
    const resultado = validarContaRecorrente({
      ...agenda,
      descricao,
      valorCentavos,
      categoria: categoria ?? '',
      lembrarDiasAntes: lembrete,
      // Editar uma conta pausada não pode reativá-la.
      ativa: conta?.ativa ?? true,
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
    if (!conta) {
      return;
    }
    setExcluindo(true);
    try {
      await onExcluir(conta.id);
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
          <View style={styles.folha} testID="conta-form-sheet">
            <View style={styles.alca} />
            <View style={styles.cabecalho}>
              <Text style={styles.titulo} testID="conta-form-titulo">
                {conta ? 'Editar Conta' : 'Nova Conta'}
              </Text>
              <Pressable
                style={styles.botaoFechar}
                onPress={fechar}
                disabled={ocupado}
                accessibilityRole="button"
                accessibilityLabel="Fechar"
                testID="conta-form-fechar">
                <Icon source="close" size={18} color={CORES.textoSecundario} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.conteudo}>
              <View>
                <Text style={styles.rotulo}>DESCRIÇÃO</Text>
                <TextInput
                  mode="outlined"
                  placeholder="Ex: Internet"
                  value={descricao}
                  onChangeText={texto => {
                    setDescricao(texto);
                    setErros(({descricao: _, ...resto}) => resto);
                  }}
                  maxLength={MAX_DESCRICAO_CONTA}
                  disabled={ocupado}
                  error={Boolean(erros.descricao)}
                  outlineStyle={styles.contorno}
                  style={styles.campo}
                  textColor={CORES.texto}
                  placeholderTextColor={CORES.textoApagado}
                  outlineColor={CORES.realceForte}
                  activeOutlineColor={CORES.verde}
                  testID="conta-descricao-input"
                />
                {erros.descricao && (
                  <HelperText type="error">{erros.descricao}</HelperText>
                )}
              </View>

              <View>
                <Text style={styles.rotulo}>VALOR</Text>
                <View style={styles.linhaValor}>
                  <Text style={styles.moeda}>R$</Text>
                  <Text
                    style={styles.valor}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    accessibilityLabel={`Valor: ${formatarDigitado(
                      valor,
                    )} reais`}
                    testID="conta-valor">
                    {formatarDigitado(valor)}
                  </Text>
                </View>
                {erros.valorCentavos && (
                  <HelperText type="error" testID="conta-erro-valor">
                    {erros.valorCentavos}
                  </HelperText>
                )}
              </View>

              <TecladoNumerico
                valor={valor}
                onChange={novoValor => {
                  setValor(novoValor);
                  setErros(({valorCentavos: _, ...resto}) => resto);
                }}
                desabilitado={ocupado}
              />

              <View>
                <Text style={styles.rotulo}>CATEGORIA</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.linhaChips}
                  accessibilityRole="radiogroup">
                  {CATEGORIAS_DESPESA.map(item => {
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
                        testID={`conta-categoria-${item.id}`}
                        style={[
                          styles.chip,
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
                            styles.textoChip,
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
                <Text style={styles.rotulo}>FREQUÊNCIA</Text>
                <View style={styles.gradeChips} accessibilityRole="radiogroup">
                  {FREQUENCIAS.map(({id, rotulo}) => {
                    const selecionada = frequencia === id;
                    return (
                      <Pressable
                        key={id}
                        onPress={() => setFrequencia(id)}
                        disabled={ocupado}
                        accessibilityRole="radio"
                        accessibilityState={{checked: selecionada}}
                        accessibilityLabel={rotulo}
                        testID={`conta-frequencia-${id}`}
                        style={[
                          styles.chip,
                          selecionada && styles.chipSelecionado,
                        ]}>
                        <Text
                          style={[
                            styles.textoChip,
                            selecionada && styles.textoChipSelecionado,
                          ]}>
                          {rotulo}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View>
                <Text style={styles.rotulo}>VENCIMENTO</Text>
                <View style={styles.seletores}>
                  <SeletorSetas
                    id="conta-dia"
                    rotulo={
                      dia > 28
                        ? `Dia ${dia} (ou o último dia do mês)`
                        : `Dia ${dia}`
                    }
                    podeVoltar={!ocupado && dia > 1}
                    podeAvancar={!ocupado && dia < 31}
                    onVoltar={() => setDia(dia - 1)}
                    onAvancar={() => setDia(dia + 1)}
                  />
                  {anual && (
                    <SeletorSetas
                      id="conta-mes"
                      rotulo={nomeMes(mes)}
                      podeVoltar={!ocupado && mes > 1}
                      podeAvancar={!ocupado && mes < 12}
                      onVoltar={() => setMes(mes - 1)}
                      onAvancar={() => setMes(mes + 1)}
                    />
                  )}
                </View>
              </View>

              <View>
                <Text style={styles.rotulo}>LEMBRETE</Text>
                <View style={styles.gradeChips} accessibilityRole="radiogroup">
                  {LEMBRETES.map(({dias, rotulo}) => {
                    const selecionado = lembrete === dias;
                    return (
                      <Pressable
                        key={dias}
                        onPress={() => setLembrete(dias)}
                        disabled={ocupado}
                        accessibilityRole="radio"
                        accessibilityState={{checked: selecionado}}
                        accessibilityLabel={rotulo}
                        testID={`conta-lembrete-${dias}`}
                        style={[
                          styles.chip,
                          selecionado && styles.chipSelecionado,
                        ]}>
                        <Text
                          style={[
                            styles.textoChip,
                            selecionado && styles.textoChipSelecionado,
                          ]}>
                          {rotulo}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Text style={styles.previa} testID="conta-previa">
                {previa}
              </Text>

              {erroGeral && (
                <HelperText type="error" testID="conta-form-erro">
                  {erroGeral}
                </HelperText>
              )}

              <Pressable
                onPress={salvar}
                disabled={desabilitado}
                accessibilityRole="button"
                accessibilityState={{disabled: desabilitado, busy: salvando}}
                accessibilityLabel={rotuloSalvar}
                testID="conta-form-salvar"
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

              {conta && (
                <Button
                  mode="text"
                  textColor={CORES.vermelho}
                  icon="trash-can-outline"
                  onPress={() => setConfirmandoExclusao(true)}
                  disabled={ocupado}
                  testID="conta-form-excluir">
                  Excluir conta
                </Button>
              )}
            </ScrollView>
          </View>
        </View>

        <ConfirmarExclusaoDialog
          visivel={confirmandoExclusao}
          titulo="Excluir conta?"
          mensagem="As despesas já lançadas continuam no seu histórico. Só os próximos lançamentos e lembretes deixam de acontecer."
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
  contorno: {
    borderRadius: 14,
  },
  campo: {
    backgroundColor: CORES.superficie,
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
  linhaChips: {
    gap: 8,
  },
  gradeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
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
  chipSelecionado: {
    backgroundColor: comAlfa(CORES.verde, 0.125),
    borderColor: comAlfa(CORES.verde, 0.375),
  },
  textoChip: {
    fontFamily: FONTES.medio,
    fontSize: 13,
    color: CORES.textoSecundario,
  },
  textoChipSelecionado: {
    color: CORES.verde,
  },
  seletores: {
    gap: 8,
  },
  linhaSeletor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  seta: {
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
  textoSeletor: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONTES.seminegrito,
    fontSize: 14,
    color: CORES.texto,
  },
  previa: {
    fontFamily: FONTES.monoMedio,
    fontSize: 12,
    textAlign: 'center',
    color: CORES.texto,
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

export default ContaRecorrenteFormSheet;
