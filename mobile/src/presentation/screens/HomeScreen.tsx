import React, {useMemo, useState} from 'react';
import {
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
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {DATABASE_NAME} from '../../data/database/connection';
import {GerenciarCofres} from '../../domain/casosDeUso/GerenciarCofres';
import {saudacao} from '../../domain/datas';
import type {DadosTransacao, Transacao} from '../../domain/entities/Transacao';
import type {ArmazenamentoComprovantes} from '../../domain/repositories/ArmazenamentoComprovantes';
import type {CofreRepository} from '../../domain/repositories/CofreRepository';
import type {TransacaoRepository} from '../../domain/repositories/TransacaoRepository';
import CardSaldo from '../components/CardSaldo';
import CofreMiniCard from '../components/CofreMiniCard';
import ConfirmarExclusaoDialog from '../components/ConfirmarExclusaoDialog';
import NovoLancamentoSheet from '../components/NovoLancamentoSheet';
import TransacaoItem from '../components/TransacaoItem';
import {useCofres} from '../hooks/useCofres';
import {useDatabase} from '../hooks/useDatabase';
import {useTransacoes} from '../hooks/useTransacoes';
import type {SeletorImagem} from '../servicos/seletorImagem';
import {CORES} from '../theme/cores';
import {mensagemDeErro} from '../utils/mensagemDeErro';
import CofresScreen from './CofresScreen';

function DatabaseIcon(props: {size: number}): React.JSX.Element {
  return <Avatar.Icon {...props} icon="database" />;
}

interface Props {
  repositorio: TransacaoRepository;
  armazenamento: ArmazenamentoComprovantes;
  repositorioCofres: CofreRepository;
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

function HomeScreen({
  repositorio,
  armazenamento,
  repositorioCofres,
  seletorImagem,
}: Props): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const database = useDatabase();
  const lancamentos = useTransacoes(
    repositorio,
    armazenamento,
    repositorioCofres,
  );
  const gerenciarCofres = useMemo(
    () => new GerenciarCofres(repositorioCofres, repositorio),
    [repositorioCofres, repositorio],
  );
  const cofres = useCofres(
    gerenciarCofres,
    repositorioCofres,
    lancamentos.recarregar,
  );
  const [telaCofres, setTelaCofres] = useState<EstadoTelaCofres>({
    visivel: false,
    abrirFormulario: false,
  });

  const [sheet, setSheet] = useState<EstadoSheet>({
    visivel: false,
    transacao: null,
  });
  const [paraExcluir, setParaExcluir] = useState<Transacao | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);

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

  return (
    <View style={[styles.tela, {backgroundColor: theme.colors.background}]}>
      <View
        style={[styles.cabecalho, {paddingTop: insets.top + 16}]}
        accessibilityRole="header">
        <Text style={styles.saudacao} testID="saudacao">
          {saudacao()}
        </Text>
        <Text style={styles.marca}>FinançaConsciente</Text>
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

          <Text variant="titleMedium">Últimas Transações</Text>
          {lancamentos.carregando && (
            <ActivityIndicator accessibilityLabel="Carregando lançamentos" />
          )}
          {!lancamentos.carregando && lancamentos.erro && (
            <View style={styles.erroLista}>
              <Text style={{color: theme.colors.error}} testID="lista-erro">
                Não foi possível carregar os lançamentos: {lancamentos.erro}
              </Text>
              <Button onPress={lancamentos.recarregar}>Tentar novamente</Button>
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
        </ScrollView>

        <Snackbar
          visible={aviso !== null}
          onDismiss={() => setAviso(null)}
          duration={3000}
          testID="home-snackbar">
          {aviso ?? ''}
        </Snackbar>
      </View>

      <View style={styles.rodape} pointerEvents="box-none">
        <View
          style={[styles.barra, {paddingBottom: insets.bottom}]}
          accessibilityRole="tablist">
          <View
            style={styles.aba}
            accessibilityRole="tab"
            accessibilityState={{selected: true}}
            accessibilityLabel="Início">
            <Icon source="home" size={24} color={CORES.verde} />
            <Text style={styles.textoAba}>Início</Text>
          </View>
          <View style={styles.aba} />
          <View style={styles.aba} />
        </View>
        <Pressable
          onPress={abrirNovo}
          accessibilityRole="button"
          accessibilityLabel="Novo lançamento"
          testID="botao-novo-lancamento"
          style={({pressed}) => [styles.fab, pressed && styles.fabPressionado]}>
          <Icon source="plus" size={28} color={CORES.fundo} />
        </Pressable>
      </View>

      <NovoLancamentoSheet
        visivel={sheet.visivel}
        transacao={sheet.transacao}
        onFechar={fecharSheet}
        onSalvar={salvar}
        onExcluir={excluirDoSheet}
        seletorImagem={seletorImagem}
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
    </View>
  );
}

const TAMANHO_FAB = 56;
const ELEVACAO_FAB = 20;

const styles = StyleSheet.create({
  tela: {
    flex: 1,
  },
  corpo: {
    flex: 1,
  },
  cabecalho: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  saudacao: {
    fontSize: 13,
    color: CORES.textoSecundario,
  },
  marca: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CORES.texto,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  carregandoResumo: {
    height: 200,
  },
  secaoCofres: {
    gap: 12,
  },
  tituloSecao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textoTituloSecao: {
    fontSize: 15,
    fontWeight: 'bold',
    color: CORES.texto,
  },
  verTodos: {
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
    fontSize: 12,
    color: CORES.textoSecundario,
  },
  erroLista: {
    gap: 8,
    alignItems: 'flex-start',
  },
  lista: {
    gap: 8,
  },
  rodape: {
    paddingTop: ELEVACAO_FAB,
  },
  barra: {
    flexDirection: 'row',
    backgroundColor: CORES.barra,
    borderTopWidth: 1,
    borderTopColor: CORES.borda,
  },
  aba: {
    flex: 1,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  textoAba: {
    fontSize: 11,
    fontWeight: '600',
    color: CORES.verde,
  },
  fab: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -TAMANHO_FAB / 2,
    width: TAMANHO_FAB,
    height: TAMANHO_FAB,
    borderRadius: TAMANHO_FAB / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CORES.verde,
    elevation: 6,
  },
  fabPressionado: {
    opacity: 0.85,
  },
});

export default HomeScreen;
