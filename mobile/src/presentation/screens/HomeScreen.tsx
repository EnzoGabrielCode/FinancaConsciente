import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {
  ActivityIndicator,
  Appbar,
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
import {formatarCentavos} from '../../domain/dinheiro';
import type {DadosTransacao, Transacao} from '../../domain/entities/Transacao';
import type {TransacaoRepository} from '../../domain/repositories/TransacaoRepository';
import ConfirmarExclusaoDialog from '../components/ConfirmarExclusaoDialog';
import NovoLancamentoSheet from '../components/NovoLancamentoSheet';
import TransacaoItem from '../components/TransacaoItem';
import {useDatabase} from '../hooks/useDatabase';
import {useTransacoes} from '../hooks/useTransacoes';
import {CORES, FONTE_MONO} from '../theme/cores';
import {mensagemDeErro} from '../utils/mensagemDeErro';

function DatabaseIcon(props: {size: number}): React.JSX.Element {
  return <Avatar.Icon {...props} icon="database" />;
}

function ReceitasIcon(props: {size: number}): React.JSX.Element {
  return <Avatar.Icon {...props} icon="trending-up" />;
}

interface Props {
  repositorio: TransacaoRepository;
}

interface EstadoSheet {
  visivel: boolean;
  transacao: Transacao | null;
}

function HomeScreen({repositorio}: Props): React.JSX.Element {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const database = useDatabase();
  const lancamentos = useTransacoes(repositorio);

  const [sheet, setSheet] = useState<EstadoSheet>({
    visivel: false,
    transacao: null,
  });
  const [paraExcluir, setParaExcluir] = useState<Transacao | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

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
      setAviso('Lançamento excluído');
    } catch (erro) {
      setAviso(mensagemDeErro(erro));
    } finally {
      setExcluindo(false);
      setParaExcluir(null);
    }
  };

  return (
    <View style={[styles.tela, {backgroundColor: theme.colors.background}]}>
      <Appbar.Header elevated>
        <Appbar.Content title="FinançaConsciente" />
      </Appbar.Header>

      <View style={styles.corpo}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text variant="headlineSmall">Bem-vindo(a)!</Text>
          <Text
            variant="bodyMedium"
            style={{color: theme.colors.onSurfaceVariant}}>
            Seus dados financeiros ficam salvos no aparelho e funcionam mesmo
            sem internet.
          </Text>

          <Card mode="contained" testID="database-card">
            <Card.Title
              title="Banco de dados local"
              subtitle={DATABASE_NAME}
              left={DatabaseIcon}
            />
            <Card.Content>
              {database.status === 'carregando' && (
                <ActivityIndicator accessibilityLabel="Abrindo banco de dados" />
              )}
              {database.status === 'pronto' && (
                <Text variant="bodyLarge" testID="database-status">
                  Banco pronto (schema v{database.schemaVersion})
                </Text>
              )}
              {database.status === 'erro' && (
                <Text
                  variant="bodyLarge"
                  style={{color: theme.colors.error}}
                  testID="database-status">
                  Não foi possível abrir o banco: {database.message}
                </Text>
              )}
            </Card.Content>
            {database.status === 'erro' && (
              <Card.Actions>
                <Button onPress={database.retry}>Tentar novamente</Button>
              </Card.Actions>
            )}
          </Card>

          <Card mode="contained" testID="receitas-card">
            <Card.Title title="Receitas do mês" left={ReceitasIcon} />
            <Card.Content>
              <Text
                variant="headlineMedium"
                style={[styles.total, {color: theme.colors.primary}]}
                testID="total-receitas">
                {formatarCentavos(lancamentos.totalReceitasMes)}
              </Text>
            </Card.Content>
          </Card>

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
      />

      <ConfirmarExclusaoDialog
        visivel={paraExcluir !== null}
        descricao={paraExcluir?.descricao}
        carregando={excluindo}
        onCancelar={() => setParaExcluir(null)}
        onConfirmar={confirmarExclusao}
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
  content: {
    padding: 16,
    gap: 16,
  },
  total: {
    fontFamily: FONTE_MONO,
    fontWeight: 'bold',
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
