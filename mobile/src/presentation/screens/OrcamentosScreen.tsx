import React, {useEffect, useState} from 'react';
import {FlatList, Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {Button, Icon, Portal, Snackbar} from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import type {SugeridorCategoria} from '../../domain/casosDeUso/SugerirCategoria';
import {anoMesDe, hojeISO, nomeMesAno} from '../../domain/datas';
import {formatarCentavos} from '../../domain/dinheiro';
import type {
  ContaRecorrente,
  DadosContaRecorrente,
} from '../../domain/entities/ContaRecorrente';
import type {DadosOrcamento, Orcamento} from '../../domain/entities/Orcamento';
import {situacaoDo} from '../../domain/orcamentos';
import {textoContasLancadas} from '../../domain/recorrencia';
import ContaRecorrenteFormSheet from '../components/ContaRecorrenteFormSheet';
import ContasFixasConteudo from '../components/ContasFixasConteudo';
import OrcamentoCard, {DEGRADE_SITUACAO} from '../components/OrcamentoCard';
import OrcamentoFormSheet from '../components/OrcamentoFormSheet';
import type {UseContasRecorrentes} from '../hooks/useContasRecorrentes';
import type {UseOrcamentos} from '../hooks/useOrcamentos';
import {CORES, comAlfa} from '../theme/cores';
import {DEGRADES, DIAGONAL, HORIZONTAL} from '../theme/degrades';
import {FONTES} from '../theme/fontes';
import {ESTILO_SNACKBAR, TEMA_SNACKBAR} from '../theme';

interface Props {
  visivel: boolean;
  orcamentos: UseOrcamentos;
  contas: UseContasRecorrentes;
  sugeridorCategoria?: SugeridorCategoria;
  onFechar: () => void;
}

type AbaPlanejamento = 'orcamentos' | 'contas';

const ABAS: {id: AbaPlanejamento; rotulo: string}[] = [
  {id: 'orcamentos', rotulo: 'Orçamentos'},
  {id: 'contas', rotulo: 'Contas fixas'},
];

interface EstadoFormConta {
  visivel: boolean;
  conta: ContaRecorrente | null;
}

interface EstadoForm {
  visivel: boolean;
  orcamento: Orcamento | null;
}

export const AVISO_PERMISSAO =
  'Ative as notificações do FinançaConsciente nas configurações para receber os avisos.';

export const textoCategorias = (quantidade: number) =>
  `${quantidade} ${quantidade === 1 ? 'categoria' : 'categorias'}`;

const textoDias = (dias: number) =>
  dias === 1 ? 'Resta 1 dia' : `Restam ${dias} dias`;

function OrcamentosScreen({
  visivel,
  orcamentos,
  contas,
  sugeridorCategoria,
  onFechar,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<EstadoForm>({
    visivel: false,
    orcamento: null,
  });
  const [formConta, setFormConta] = useState<EstadoFormConta>({
    visivel: false,
    conta: null,
  });
  const [aba, setAba] = useState<AbaPlanejamento>('orcamentos');
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!visivel) {
      setForm(atual => ({...atual, visivel: false}));
      setFormConta(atual => ({...atual, visivel: false}));
    }
  }, [visivel]);

  const {progressos, resumo, categoriasLivres} = orcamentos;
  const naoPodeAdicionar =
    aba === 'orcamentos' && categoriasLivres.length === 0;
  const estourouTotal = resumo.disponivel < 0;

  const abrirNovo = () => setForm({visivel: true, orcamento: null});
  const abrirEdicao = (orcamento: Orcamento) =>
    setForm({visivel: true, orcamento});
  const fecharForm = () => setForm(atual => ({...atual, visivel: false}));
  const abrirEdicaoConta = (conta: ContaRecorrente) =>
    setFormConta({visivel: true, conta});
  const fecharFormConta = () =>
    setFormConta(atual => ({...atual, visivel: false}));
  const adicionar = () =>
    aba === 'contas' ? setFormConta({visivel: true, conta: null}) : abrirNovo();

  const salvar = async (dados: DadosOrcamento) => {
    const primeiro = progressos.length === 0;
    await orcamentos.salvar(dados);
    fecharForm();
    setAviso(form.orcamento ? 'Orçamento atualizado' : 'Orçamento criado');
    if (primeiro && !(await orcamentos.pedirPermissao())) {
      setAviso(AVISO_PERMISSAO);
    }
  };

  const excluir = async (id: number) => {
    await orcamentos.excluir(id);
    fecharForm();
    setAviso('Orçamento excluído');
  };

  const salvarConta = async (dados: DadosContaRecorrente) => {
    const primeira = contas.contas.length === 0;
    const emEdicao = formConta.conta;
    const lancadas = await contas.salvar(dados, emEdicao?.id);
    fecharFormConta();
    setAviso(
      lancadas > 0
        ? textoContasLancadas(lancadas)
        : emEdicao
        ? 'Conta atualizada'
        : 'Conta criada',
    );
    if (primeira && !(await contas.pedirPermissao())) {
      setAviso(AVISO_PERMISSAO);
    }
  };

  const excluirConta = async (id: number) => {
    await contas.excluir(id);
    fecharFormConta();
    setAviso('Conta excluída');
  };

  const cabecalhoLista = (
    <View style={styles.cabecalhoLista}>
      {orcamentos.erro && (
        <View style={styles.caixaErro}>
          <Text style={styles.erro} testID="orcamentos-erro">
            Não foi possível carregar os orçamentos: {orcamentos.erro}
          </Text>
          <Button onPress={orcamentos.recarregar}>Tentar novamente</Button>
        </View>
      )}

      {progressos.length > 0 && (
        <>
          <View style={styles.cardResumo} testID="orcamentos-resumo">
            <View style={styles.trilhoResumo}>
              <LinearGradient
                colors={
                  DEGRADE_SITUACAO[
                    situacaoDo(resumo.totalGasto, resumo.totalLimite)
                  ]
                }
                {...HORIZONTAL}
                style={[
                  styles.preenchimentoResumo,
                  {width: `${Math.min(resumo.percentual, 100)}%`},
                ]}
                testID="orcamentos-barra-total"
              />
            </View>
            <View style={styles.colunasResumo}>
              <View style={styles.colunaResumo}>
                <Text style={styles.rotuloResumo}>ORÇAMENTO</Text>
                <Text
                  style={styles.valorResumo}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  testID="orcamentos-total-limite">
                  {formatarCentavos(resumo.totalLimite)}
                </Text>
              </View>
              <View style={styles.colunaResumo}>
                <Text style={styles.rotuloResumo}>GASTO</Text>
                <Text
                  style={[styles.valorResumo, styles.laranja]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  testID="orcamentos-total-gasto">
                  {formatarCentavos(resumo.totalGasto)}
                </Text>
                <Text
                  style={styles.detalheResumo}
                  testID="orcamentos-percentual">
                  {resumo.percentual}% utilizado
                </Text>
              </View>
              <View style={styles.colunaResumo}>
                <Text style={styles.rotuloResumo}>DISPONÍVEL</Text>
                <Text
                  style={[
                    styles.valorResumo,
                    estourouTotal ? styles.vermelho : styles.verde,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  testID="orcamentos-disponivel">
                  {formatarCentavos(resumo.disponivel)}
                </Text>
                <Text
                  style={[
                    styles.detalheResumo,
                    estourouTotal && styles.vermelho,
                  ]}
                  testID="orcamentos-dias">
                  {estourouTotal
                    ? 'Acima do orçamento'
                    : textoDias(resumo.diasRestantes)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.tituloSecao}>
            <Text style={styles.textoSecao}>CATEGORIAS</Text>
            <Text style={styles.quantidade} testID="orcamentos-quantidade">
              {textoCategorias(progressos.length)}
            </Text>
          </View>
        </>
      )}
    </View>
  );

  const vazio =
    orcamentos.carregando || orcamentos.erro ? null : (
      <View style={styles.vazio} testID="orcamentos-vazio">
        <View style={styles.iconeVazio}>
          <Icon source="chart-donut" size={32} color={CORES.verde} />
        </View>
        <Text style={styles.tituloVazio}>Nenhum orçamento ainda</Text>
        <Text style={styles.textoVazio}>
          Defina um teto por categoria e avisamos quando chegar perto.
        </Text>
        <Pressable
          onPress={abrirNovo}
          accessibilityRole="button"
          accessibilityLabel="Criar orçamento"
          testID="orcamentos-criar"
          style={styles.botaoCriar}>
          <Text style={styles.textoCriar}>Criar orçamento</Text>
        </Pressable>
      </View>
    );

  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={onFechar}>
      <Portal.Host>
        <View
          style={[styles.tela, {paddingTop: insets.top + 12}]}
          testID="orcamentos-screen">
          <View style={styles.cabecalho} accessibilityRole="header">
            <Pressable
              onPress={onFechar}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              testID="orcamentos-voltar"
              style={styles.botaoVoltar}>
              <Icon source="arrow-left" size={20} color={CORES.texto} />
            </Pressable>
            <View style={styles.colunaTitulo}>
              <Text style={styles.mes} testID="orcamentos-mes">
                {nomeMesAno(anoMesDe(hojeISO()))}
              </Text>
              <Text style={styles.titulo}>Planejamento</Text>
            </View>
            <Pressable
              onPress={adicionar}
              disabled={naoPodeAdicionar}
              accessibilityRole="button"
              accessibilityLabel={
                aba === 'contas' ? 'Adicionar conta' : 'Adicionar orçamento'
              }
              accessibilityState={{disabled: naoPodeAdicionar}}
              testID="orcamentos-adicionar"
              style={[
                styles.botaoAdicionar,
                naoPodeAdicionar && styles.botaoDesabilitado,
              ]}>
              <Text style={styles.textoAdicionar}>+ Adicionar</Text>
            </Pressable>
          </View>

          <View style={styles.seletor} accessibilityRole="tablist">
            {ABAS.map(({id, rotulo}) => {
              const ativa = aba === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setAba(id)}
                  accessibilityRole="tab"
                  accessibilityState={{selected: ativa}}
                  accessibilityLabel={rotulo}
                  testID={`planejamento-aba-${id}`}
                  style={styles.opcaoSeletor}>
                  {ativa && (
                    <LinearGradient
                      colors={DEGRADES.verde}
                      {...DIAGONAL}
                      style={styles.degradeSeletor}
                    />
                  )}
                  <Text
                    style={[
                      styles.textoSeletor,
                      ativa && styles.textoSeletorAtivo,
                    ]}>
                    {rotulo}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {aba === 'orcamentos' ? (
            <FlatList
              data={progressos}
              keyExtractor={progresso => String(progresso.orcamento.id)}
              contentContainerStyle={[
                styles.lista,
                {paddingBottom: insets.bottom + 24},
              ]}
              ListHeaderComponent={cabecalhoLista}
              ListEmptyComponent={vazio}
              renderItem={({item}) => (
                <OrcamentoCard progresso={item} onPress={abrirEdicao} />
              )}
              testID="orcamentos-lista"
            />
          ) : (
            <ContasFixasConteudo
              contas={contas}
              margemInferior={insets.bottom + 24}
              onEditar={abrirEdicaoConta}
              onAviso={setAviso}
            />
          )}

          <Snackbar
            visible={aviso !== null}
            onDismiss={() => setAviso(null)}
            duration={3000}
            style={styles.snackbar}
            theme={TEMA_SNACKBAR}
            testID="orcamentos-snackbar">
            {aviso ?? ''}
          </Snackbar>
        </View>
      </Portal.Host>

      <OrcamentoFormSheet
        visivel={form.visivel}
        orcamento={form.orcamento}
        categoriasLivres={categoriasLivres}
        onFechar={fecharForm}
        onSalvar={salvar}
        onExcluir={excluir}
      />

      <ContaRecorrenteFormSheet
        visivel={formConta.visivel}
        conta={formConta.conta}
        onFechar={fecharFormConta}
        onSalvar={salvarConta}
        onExcluir={excluirConta}
        sugeridorCategoria={sugeridorCategoria}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: CORES.fundo,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  botaoVoltar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  colunaTitulo: {
    flex: 1,
  },
  mes: {
    fontFamily: FONTES.regular,
    fontSize: 12,
    color: CORES.textoSecundario,
  },
  titulo: {
    fontFamily: FONTES.extraNegrito,
    fontSize: 18,
    letterSpacing: -0.2,
    color: CORES.texto,
  },
  botaoAdicionar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: comAlfa(CORES.verde, 0.25),
    backgroundColor: comAlfa(CORES.verde, 0.12),
  },
  botaoDesabilitado: {
    opacity: 0.4,
  },
  textoAdicionar: {
    fontFamily: FONTES.seminegrito,
    fontSize: 12,
    color: CORES.verde,
  },
  seletor: {
    flexDirection: 'row',
    gap: 4,
    marginHorizontal: 20,
    marginBottom: 4,
    padding: 4,
    borderRadius: 14,
    backgroundColor: CORES.superficie,
  },
  opcaoSeletor: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    overflow: 'hidden',
  },
  degradeSeletor: {
    ...StyleSheet.absoluteFillObject,
  },
  textoSeletor: {
    fontFamily: FONTES.seminegrito,
    fontSize: 13,
    color: CORES.textoSecundario,
  },
  textoSeletorAtivo: {
    color: CORES.fundo,
  },
  lista: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  cabecalhoLista: {
    gap: 16,
  },
  caixaErro: {
    alignItems: 'center',
    gap: 8,
  },
  erro: {
    fontFamily: FONTES.regular,
    fontSize: 13,
    textAlign: 'center',
    color: CORES.vermelho,
  },
  cardResumo: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CORES.borda,
    backgroundColor: CORES.superficie,
    overflow: 'hidden',
  },
  trilhoResumo: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  preenchimentoResumo: {
    height: '100%',
  },
  colunasResumo: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  colunaResumo: {
    flex: 1,
    gap: 4,
  },
  rotuloResumo: {
    fontFamily: FONTES.regular,
    fontSize: 10,
    letterSpacing: 0.7,
    color: CORES.textoSecundario,
  },
  valorResumo: {
    fontFamily: FONTES.monoNegrito,
    fontSize: 14,
    color: CORES.texto,
  },
  detalheResumo: {
    fontFamily: FONTES.regular,
    fontSize: 10,
    color: CORES.textoSecundario,
  },
  laranja: {
    color: CORES.laranja,
  },
  verde: {
    color: CORES.verde,
  },
  vermelho: {
    color: CORES.vermelho,
  },
  tituloSecao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textoSecao: {
    fontFamily: FONTES.seminegrito,
    fontSize: 11,
    letterSpacing: 0.7,
    color: CORES.textoSecundario,
  },
  quantidade: {
    fontFamily: FONTES.regular,
    fontSize: 12,
    color: CORES.textoSecundario,
  },
  vazio: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 48,
  },
  iconeVazio: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: comAlfa(CORES.verde, 0.12),
  },
  tituloVazio: {
    fontFamily: FONTES.negrito,
    fontSize: 16,
    color: CORES.texto,
  },
  textoVazio: {
    fontFamily: FONTES.regular,
    fontSize: 13,
    textAlign: 'center',
    color: CORES.textoSecundario,
  },
  botaoCriar: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: CORES.verde,
  },
  textoCriar: {
    fontFamily: FONTES.extraNegrito,
    fontSize: 14,
    color: CORES.fundo,
  },
  snackbar: ESTILO_SNACKBAR,
});

export default OrcamentosScreen;
