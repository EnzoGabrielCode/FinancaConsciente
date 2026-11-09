import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Avatar,
  Button,
  Card,
  Icon,
  Snackbar,
  Text,
  useTheme,
} from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {DATABASE_NAME} from '../../data/database/connection';
import {GerenciarCofres} from '../../domain/casosDeUso/GerenciarCofres';
import {GerenciarContasRecorrentes} from '../../domain/casosDeUso/GerenciarContasRecorrentes';
import {GerarRelatorios} from '../../domain/casosDeUso/GerarRelatorios';
import {SugerirCategoria} from '../../domain/casosDeUso/SugerirCategoria';
import {GerenciarOrcamentos} from '../../domain/casosDeUso/GerenciarOrcamentos';
import {hojeISO, saudacao} from '../../domain/datas';
import type {DadosTransacao, Transacao} from '../../domain/entities/Transacao';
import {textoContasLancadas} from '../../domain/recorrencia';
import type {ArmazenamentoComprovantes} from '../../domain/repositories/ArmazenamentoComprovantes';
import type {CofreRepository} from '../../domain/repositories/CofreRepository';
import type {ContaRecorrenteRepository} from '../../domain/repositories/ContaRecorrenteRepository';
import type {ExportadorArquivos} from '../../domain/repositories/ExportadorArquivos';
import type {GeradorPdf} from '../../domain/repositories/GeradorPdf';
import type {Notificador} from '../../domain/repositories/Notificador';
import type {OrcamentoRepository} from '../../domain/repositories/OrcamentoRepository';
import type {TransacaoRepository} from '../../domain/repositories/TransacaoRepository';
import CardSaldo from '../components/CardSaldo';
import CofreMiniCard from '../components/CofreMiniCard';
import ConfirmarExclusaoDialog from '../components/ConfirmarExclusaoDialog';
import NovoLancamentoSheet from '../components/NovoLancamentoSheet';
import TransacaoItem from '../components/TransacaoItem';
import {useCofres} from '../hooks/useCofres';
import {useContasRecorrentes} from '../hooks/useContasRecorrentes';
import {useDatabase} from '../hooks/useDatabase';
import {useOrcamentos} from '../hooks/useOrcamentos';
import {useTransacoes} from '../hooks/useTransacoes';
import type {SeletorImagem} from '../servicos/seletorImagem';
import {CORES} from '../theme/cores';
import {DEGRADES, DIAGONAL} from '../theme/degrades';
import {FONTES} from '../theme/fontes';
import {ESTILO_SNACKBAR, TEMA_SNACKBAR} from '../theme';
import {mensagemDeErro} from '../utils/mensagemDeErro';
import CofresScreen from './CofresScreen';
import OrcamentosScreen from './OrcamentosScreen';
import RelatoriosScreen from './RelatoriosScreen';
import TransacoesScreen from './TransacoesScreen';

function DatabaseIcon(props: {size: number}): React.JSX.Element {
  return <Avatar.Icon {...props} icon="database" />;
}

interface Props {
  repositorio: TransacaoRepository;
  armazenamento: ArmazenamentoComprovantes;
  repositorioCofres: CofreRepository;
  repositorioOrcamentos: OrcamentoRepository;
  repositorioContas: ContaRecorrenteRepository;
  notificador: Notificador;
  exportador: ExportadorArquivos;
  geradorPdf: GeradorPdf;
  seletorImagem?: SeletorImagem;
}

interface EstadoTelaCofres {
  visivel: boolean;
  abrirFormulario: boolean;
}

interface EstadoSheet {
  visivel: boolean;
  transacao: Transacao | null;
}

interface Aba {
  id: string;
  nome: string;
  icone: string;
}

const ABAS_ESQUERDA: Aba[] = [
  {id: 'inicio', nome: 'Início', icone: 'home'},
  {id: 'planejamento', nome: 'Planejamento', icone: 'clipboard-text-outline'},
];

const ABAS_DIREITA: Aba[] = [
  {id: 'desafios', nome: 'Desafios', icone: 'trophy-outline'},
  {id: 'assistente', nome: 'Assistente IA', icone: 'robot-outline'},
];

const ABA_ATIVA = 'inicio';

function HomeScreen({
  repositorio,
  armazenamento,
  repositorioCofres,
  repositorioOrcamentos,
  repositorioContas,
  notificador,
  exportador,
  geradorPdf,
  seletorImagem,
}: Props): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const database = useDatabase();
  const gerenciarOrcamentos = useMemo(
    () =>
      new GerenciarOrcamentos(repositorioOrcamentos, repositorio, notificador),
    [repositorioOrcamentos, repositorio, notificador],
  );
  const verificarAlerta = useCallback(
    async (categoria: string, data: string) => {
      await gerenciarOrcamentos.verificarAlerta(categoria, data, hojeISO());
    },
    [gerenciarOrcamentos],
  );
  const sugeridorCategoria = useMemo(
    () => new SugerirCategoria(repositorio),
    [repositorio],
  );
  // Cada despesa salva entra no histórico: o próximo preparar() aprende com ela.
  const aoSalvarDespesa = useCallback(
    async (categoria: string, data: string) => {
      sugeridorCategoria.invalidar();
      await verificarAlerta(categoria, data);
    },
    [sugeridorCategoria, verificarAlerta],
  );
  const lancamentos = useTransacoes(
    repositorio,
    armazenamento,
    repositorioCofres,
    aoSalvarDespesa,
  );
  const orcamentos = useOrcamentos(gerenciarOrcamentos, lancamentos.transacoes);
  const gerenciarCofres = useMemo(
    () => new GerenciarCofres(repositorioCofres, repositorio),
    [repositorioCofres, repositorio],
  );
  const cofres = useCofres(
    gerenciarCofres,
    repositorioCofres,
    lancamentos.recarregar,
  );
  const gerenciarContas = useMemo(
    () =>
      new GerenciarContasRecorrentes(
        repositorioContas,
        repositorio,
        notificador,
        aoSalvarDespesa,
      ),
    [repositorioContas, repositorio, notificador, aoSalvarDespesa],
  );
  const recarregarLancamentos = lancamentos.recarregar;
  const recarregarCofres = cofres.recarregar;
  const aoAlterarContas = useCallback(async () => {
    await Promise.all([recarregarLancamentos(), recarregarCofres()]);
  }, [recarregarLancamentos, recarregarCofres]);
  const contas = useContasRecorrentes(
    gerenciarContas,
    lancamentos.transacoes,
    aoAlterarContas,
  );
  const [telaCofres, setTelaCofres] = useState<EstadoTelaCofres>({
    visivel: false,
    abrirFormulario: false,
  });
  const [telaTransacoes, setTelaTransacoes] = useState(false);
  const [telaOrcamentos, setTelaOrcamentos] = useState(false);
  const [telaRelatorios, setTelaRelatorios] = useState(false);
  const gerarRelatorios = useMemo(
    () => new GerarRelatorios(repositorio, exportador, geradorPdf),
    [repositorio, exportador, geradorPdf],
  );

  const [sheet, setSheet] = useState<EstadoSheet>({
    visivel: false,
    transacao: null,
  });
  const [paraExcluir, setParaExcluir] = useState<Transacao | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const sincronizando = useRef(false);

  const sincronizarContas = useCallback(async () => {
    if (sincronizando.current) {
      return;
    }
    sincronizando.current = true;
    const hoje = hojeISO();
    try {
      const lancadas = await gerenciarContas.lancarVencidas(hoje);
      await gerenciarContas.reagendarTodas(hoje);
      await aoAlterarContas();
      if (lancadas > 0) {
        setAviso(textoContasLancadas(lancadas));
      }
    } catch {
      // Sem banco o card de erro já aparece; tenta de novo ao voltar ao app.
    } finally {
      sincronizando.current = false;
    }
  }, [gerenciarContas, aoAlterarContas]);

  useEffect(() => {
    sincronizarContas();
    const assinatura = AppState.addEventListener('change', estadoApp => {
      if (estadoApp === 'active') {
        sincronizarContas();
      }
    });
    return () => assinatura.remove();
  }, [sincronizarContas]);

  const puxarParaAtualizar = async () => {
    setAtualizando(true);
    try {
      await Promise.all([lancamentos.recarregar(), cofres.recarregar()]);
    } finally {
      setAtualizando(false);
    }
  };

  const abrirNovo = () => setSheet({visivel: true, transacao: null});
  const abrirEdicao = (transacao: Transacao) =>
    setSheet({visivel: true, transacao});
  const fecharSheet = () => setSheet(atual => ({...atual, visivel: false}));

  const salvar = async (dados: DadosTransacao) => {
    const emEdicao = sheet.transacao;
    if (emEdicao) {
      await lancamentos.atualizar(emEdicao.id, dados);
    } else {
      await lancamentos.criar(dados);
    }
    cofres.recarregar();
    fecharSheet();
    setAviso(
      emEdicao
        ? 'Lançamento atualizado'
        : dados.tipo === 'receita'
        ? 'Receita salva'
        : 'Despesa salva',
    );
  };

  const excluirDoSheet = async (id: number) => {
    await lancamentos.excluir(id);
    cofres.recarregar();
    fecharSheet();
    setAviso('Lançamento excluído');
  };

  const confirmarExclusao = async () => {
    if (!paraExcluir) {
      return;
    }
    setExcluindo(true);
    try {
      await lancamentos.excluir(paraExcluir.id);
      cofres.recarregar();
      setAviso('Lançamento excluído');
    } catch (erro) {
      setAviso(mensagemDeErro(erro));
    } finally {
      setExcluindo(false);
      setParaExcluir(null);
    }
  };

  const abrirCofres = (abrirFormulario = false) =>
    setTelaCofres({visivel: true, abrirFormulario});

  const tocarAba = (aba: Aba) =>
    aba.id === 'planejamento'
      ? setTelaOrcamentos(true)
      : setAviso('Disponível em breve');

  const renderizarAba = (aba: Aba) => {
    const ativa = aba.id === ABA_ATIVA;
    const cor = ativa ? CORES.verde : CORES.textoApagado;
    return (
      <Pressable
        key={aba.id}
        onPress={ativa ? undefined : () => tocarAba(aba)}
        accessibilityRole="tab"
        accessibilityState={{selected: ativa}}
        accessibilityLabel={aba.nome}
        testID={`aba-${aba.id}`}
        style={styles.aba}>
        <Icon source={aba.icone} size={22} color={cor} />
        <Text
          style={[styles.textoAba, {color: cor}, ativa && styles.textoAbaAtiva]}
          numberOfLines={1}>
          {aba.nome}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.tela, {backgroundColor: CORES.fundo}]}>
      <View
        style={[styles.cabecalho, {paddingTop: insets.top + 20}]}
        accessibilityRole="header">
        <View style={styles.textosCabecalho}>
          <Text style={styles.saudacao} testID="saudacao">
            {saudacao()}
          </Text>
          <Text style={styles.marca}>FinançaConsciente</Text>
        </View>
        <Pressable
          onPress={() => setTelaRelatorios(true)}
          accessibilityRole="button"
          accessibilityLabel="Relatórios"
          hitSlop={8}
          testID="botao-relatorios"
          style={styles.botaoCabecalho}>
          <Icon source="chart-box-outline" size={22} color={CORES.texto} />
        </Pressable>
      </View>

      <View style={styles.corpo}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={atualizando}
              onRefresh={puxarParaAtualizar}
              colors={[CORES.verde]}
              tintColor={CORES.verde}
              progressBackgroundColor={CORES.superficie}
            />
          }
          testID="home-scroll">
          {database.status === 'erro' && (
            <Card mode="contained" testID="database-card">
              <Card.Title
                title="Banco de dados local"
                subtitle={DATABASE_NAME}
                left={DatabaseIcon}
              />
              <Card.Content>
                <Text
                  variant="bodyLarge"
                  style={{color: theme.colors.error}}
                  testID="database-status">
                  Não foi possível abrir o banco: {database.message}
                </Text>
              </Card.Content>
              <Card.Actions>
                <Button onPress={database.retry}>Tentar novamente</Button>
              </Card.Actions>
            </Card>
          )}

          {lancamentos.resumo ? (
            <CardSaldo
              resumo={lancamentos.resumo}
              quantidadeCofres={cofres.cofres.length}
            />
          ) : (
            lancamentos.carregando && (
              <ActivityIndicator
                style={styles.carregandoResumo}
                color={CORES.verde}
                accessibilityLabel="Carregando resumo"
                testID="carregando-resumo"
              />
            )
          )}

          <View style={styles.secaoCofres} testID="secao-cofres">
            <View style={styles.tituloSecao}>
              <Text style={styles.textoTituloSecao}>Cofres Virtuais</Text>
              <Pressable
                onPress={() => abrirCofres()}
                accessibilityRole="button"
                accessibilityLabel="Ver todos os cofres"
                hitSlop={8}
                testID="cofres-ver-todos">
                <Text style={styles.verTodos}>Ver todos</Text>
              </Pressable>
            </View>
            {!cofres.carregando && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.linhaCofres}
                testID="cofres-mini-lista">
                {cofres.cofres.length > 0 ? (
                  cofres.cofres.map(cofre => (
                    <CofreMiniCard
                      key={cofre.id}
                      cofre={cofre}
                      onPress={() => abrirCofres()}
                    />
                  ))
                ) : (
                  <Pressable
                    onPress={() => abrirCofres(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Criar cofre"
                    testID="cofre-criar-atalho"
                    style={({pressed}) => [
                      styles.cofreVazio,
                      pressed && styles.fabPressionado,
                    ]}>
                    <Icon
                      source="plus"
                      size={20}
                      color={CORES.textoSecundario}
                    />
                    <Text style={styles.textoCofreVazio}>Criar cofre</Text>
                  </Pressable>
                )}
              </ScrollView>
            )}
          </View>

          <View style={styles.secaoTransacoes} testID="secao-transacoes">
            <View style={styles.tituloSecao}>
              <Text style={styles.textoTituloSecao}>Últimas Transações</Text>
              {lancamentos.transacoes.length > 0 && (
                <Pressable
                  onPress={() => setTelaTransacoes(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Ver todas as transações"
                  hitSlop={8}
                  testID="botao-ver-todas">
                  <Text style={styles.verTodos}>Ver todas</Text>
                </Pressable>
              )}
            </View>
            {lancamentos.carregando && (
              <ActivityIndicator accessibilityLabel="Carregando lançamentos" />
            )}
            {!lancamentos.carregando && lancamentos.erro && (
              <View style={styles.erroLista}>
                <Text style={{color: theme.colors.error}} testID="lista-erro">
                  Não foi possível carregar os lançamentos: {lancamentos.erro}
                </Text>
                <Button onPress={lancamentos.recarregar}>
                  Tentar novamente
                </Button>
              </View>
            )}
            {!lancamentos.carregando &&
              !lancamentos.erro &&
              lancamentos.transacoes.length === 0 && (
                <Text
                  variant="bodyMedium"
                  style={{color: theme.colors.onSurfaceVariant}}
                  testID="lista-vazia">
                  Nenhum lançamento ainda. Toque no + para começar.
                </Text>
              )}
            {lancamentos.transacoes.length > 0 && (
              <View style={styles.lista}>
                {lancamentos.transacoes.map(transacao => (
                  <TransacaoItem
                    key={transacao.id}
                    transacao={transacao}
                    onPress={abrirEdicao}
                    onExcluir={setParaExcluir}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        <Snackbar
          visible={aviso !== null}
          onDismiss={() => setAviso(null)}
          duration={3000}
          style={styles.snackbar}
          theme={TEMA_SNACKBAR}
          testID="home-snackbar">
          {aviso ?? ''}
        </Snackbar>
      </View>

      <View
        style={[styles.barra, {paddingBottom: 20 + insets.bottom}]}
        accessibilityRole="tablist">
        {ABAS_ESQUERDA.map(renderizarAba)}
        <Pressable
          onPress={abrirNovo}
          accessibilityRole="button"
          accessibilityLabel="Novo lançamento"
          testID="botao-novo-lancamento"
          style={({pressed}) => [styles.fab, pressed && styles.fabPressionado]}>
          <LinearGradient
            colors={DEGRADES.verde}
            {...DIAGONAL}
            style={styles.degradeFab}
          />
          <Icon source="plus" size={28} color={CORES.fundo} />
        </Pressable>
        {ABAS_DIREITA.map(renderizarAba)}
      </View>

      <NovoLancamentoSheet
        visivel={sheet.visivel}
        transacao={sheet.transacao}
        onFechar={fecharSheet}
        onSalvar={salvar}
        onExcluir={excluirDoSheet}
        onVerificarDuplicatas={lancamentos.verificarDuplicatas}
        seletorImagem={seletorImagem}
        sugeridorCategoria={sugeridorCategoria}
      />

      <ConfirmarExclusaoDialog
        visivel={paraExcluir !== null}
        descricao={paraExcluir?.descricao}
        carregando={excluindo}
        onCancelar={() => setParaExcluir(null)}
        onConfirmar={confirmarExclusao}
      />

      <CofresScreen
        visivel={telaCofres.visivel}
        abrirFormulario={telaCofres.abrirFormulario}
        cofres={cofres}
        onFechar={() => setTelaCofres({visivel: false, abrirFormulario: false})}
      />

      <TransacoesScreen
        visivel={telaTransacoes}
        lancamentos={lancamentos}
        repositorio={repositorio}
        seletorImagem={seletorImagem}
        sugeridorCategoria={sugeridorCategoria}
        onAlterado={cofres.recarregar}
        onFechar={() => setTelaTransacoes(false)}
      />

      <RelatoriosScreen
        visivel={telaRelatorios}
        gerar={gerarRelatorios}
        onFechar={() => setTelaRelatorios(false)}
      />

      <OrcamentosScreen
        visivel={telaOrcamentos}
        orcamentos={orcamentos}
        contas={contas}
        sugeridorCategoria={sugeridorCategoria}
        onFechar={() => setTelaOrcamentos(false)}
      />
    </View>
  );
}

const TAMANHO_FAB = 56;

const styles = StyleSheet.create({
  tela: {
    flex: 1,
  },
  corpo: {
    flex: 1,
  },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  textosCabecalho: {
    flex: 1,
  },
  botaoCabecalho: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  saudacao: {
    fontFamily: FONTES.regular,
    fontSize: 13,
    letterSpacing: 0.3,
    color: CORES.textoSecundario,
  },
  marca: {
    fontFamily: FONTES.negrito,
    fontSize: 20,
    color: CORES.texto,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 24,
  },
  carregandoResumo: {
    height: 200,
  },
  secaoCofres: {
    gap: 12,
  },
  secaoTransacoes: {
    gap: 14,
  },
  tituloSecao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textoTituloSecao: {
    fontFamily: FONTES.negrito,
    fontSize: 15,
    color: CORES.texto,
  },
  verTodos: {
    fontFamily: FONTES.seminegrito,
    fontSize: 12,
    color: CORES.verde,
  },
  linhaCofres: {
    gap: 10,
  },
  cofreVazio: {
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  textoCofreVazio: {
    fontFamily: FONTES.regular,
    fontSize: 12,
    color: CORES.textoSecundario,
  },
  erroLista: {
    gap: 8,
    alignItems: 'flex-start',
  },
  lista: {
    gap: 4,
  },
  barra: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 8,
    paddingHorizontal: 16,
    backgroundColor: CORES.barra,
    borderTopWidth: 1,
    borderTopColor: CORES.borda,
  },
  aba: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  textoAba: {
    fontFamily: FONTES.regular,
    fontSize: 10,
  },
  textoAbaAtiva: {
    fontFamily: FONTES.seminegrito,
  },
  fab: {
    marginTop: -20,
    marginHorizontal: 8,
    width: TAMANHO_FAB,
    height: TAMANHO_FAB,
    borderRadius: TAMANHO_FAB / 2,
    alignItems: 'center',
    justifyContent: 'center',
    // O fundo sólido fica sob o degradê; sem ele o Android não desenha a sombra.
    backgroundColor: CORES.verde,
    elevation: 8,
    shadowColor: CORES.verde,
  },
  degradeFab: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TAMANHO_FAB / 2,
    overflow: 'hidden',
  },
  fabPressionado: {
    opacity: 0.85,
  },
  snackbar: ESTILO_SNACKBAR,
});

export default HomeScreen;
