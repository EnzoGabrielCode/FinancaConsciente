import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {FlashList, type ListRenderItemInfo} from '@shopify/flash-list';
import {
  ActivityIndicator,
  Button,
  Icon,
  Portal,
  Snackbar,
} from 'react-native-paper';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import type {SugeridorCategoria} from '../../domain/casosDeUso/SugerirCategoria';
import type {DadosTransacao, Transacao} from '../../domain/entities/Transacao';
import type {TransacaoRepository} from '../../domain/repositories/TransacaoRepository';
import {
  agruparPorDia,
  type ItemListaTransacoes,
} from '../../domain/transacoesPorDia';
import ConfirmarExclusaoDialog from '../components/ConfirmarExclusaoDialog';
import NovoLancamentoSheet from '../components/NovoLancamentoSheet';
import TransacaoItem from '../components/TransacaoItem';
import {useTodasTransacoes} from '../hooks/useTodasTransacoes';
import type {UseTransacoes} from '../hooks/useTransacoes';
import type {SeletorImagem} from '../servicos/seletorImagem';
import {CORES} from '../theme/cores';
import {FONTES} from '../theme/fontes';
import {ESTILO_SNACKBAR, TEMA_SNACKBAR} from '../theme';
import {mensagemDeErro} from '../utils/mensagemDeErro';

interface Props {
  visivel: boolean;
  lancamentos: UseTransacoes;
  repositorio: TransacaoRepository;
  seletorImagem?: SeletorImagem;
  sugeridorCategoria?: SugeridorCategoria;
  onAlterado?: () => void;
  onFechar: () => void;
}

interface EstadoSheet {
  visivel: boolean;
  transacao: Transacao | null;
}

const ESPACO_ITENS = 4;
// TransacaoItem: ícone de 40, padding vertical de 24 e borda de 2.
const ALTURA_LINHA = 66 + ESPACO_ITENS;

const chaveDoItem = (item: ItemListaTransacoes) =>
  item.tipo === 'dia' ? `dia-${item.data}` : `transacao-${item.transacao.id}`;

const tipoDoItem = (item: ItemListaTransacoes) => item.tipo;

function TransacoesScreen({
  visivel,
  lancamentos,
  repositorio,
  seletorImagem,
  sugeridorCategoria,
  onAlterado,
  onFechar,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const paginas = useTodasTransacoes(repositorio, visivel);
  const {transacoes, carregando, carregandoMais, erro} = paginas;
  const {recarregar, carregarMais} = paginas;
  const [sheet, setSheet] = useState<EstadoSheet>({
    visivel: false,
    transacao: null,
  });
  const [paraExcluir, setParaExcluir] = useState<Transacao | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  useEffect(() => {
    if (!visivel) {
      setSheet(atual => ({...atual, visivel: false}));
      setParaExcluir(null);
    }
  }, [visivel]);

  const itens = useMemo(() => agruparPorDia(transacoes), [transacoes]);

  const abrirEdicao = useCallback(
    (transacao: Transacao) => setSheet({visivel: true, transacao}),
    [],
  );
  const fecharSheet = () => setSheet(atual => ({...atual, visivel: false}));

  const renderizarItem = useCallback(
    ({item}: ListRenderItemInfo<ItemListaTransacoes>) =>
      item.tipo === 'dia' ? (
        <Text
          style={styles.dia}
          accessibilityRole="header"
          testID={`dia-${item.data}`}>
          {item.rotulo}
        </Text>
      ) : (
        <View style={styles.linha}>
          <TransacaoItem
            transacao={item.transacao}
            onPress={abrirEdicao}
            onExcluir={setParaExcluir}
          />
        </View>
      ),
    [abrirEdicao],
  );

  const puxarParaAtualizar = useCallback(async () => {
    setAtualizando(true);
    try {
      await recarregar();
    } finally {
      setAtualizando(false);
    }
  }, [recarregar]);

  const aposAlterar = async () => {
    onAlterado?.();
    await recarregar();
  };

  const salvar = async (dados: DadosTransacao) => {
    if (!sheet.transacao) {
      return;
    }
    await lancamentos.atualizar(sheet.transacao.id, dados);
    await aposAlterar();
    fecharSheet();
    setAviso('Lançamento atualizado');
  };

  const excluirDoSheet = async (id: number) => {
    await lancamentos.excluir(id);
    await aposAlterar();
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
      await aposAlterar();
      setAviso('Lançamento excluído');
    } catch (falha) {
      setAviso(mensagemDeErro(falha));
    } finally {
      setExcluindo(false);
      setParaExcluir(null);
    }
  };

  const rodapeLista = carregandoMais ? (
    <ActivityIndicator
      style={styles.rodape}
      color={CORES.verde}
      accessibilityLabel="Carregando mais lançamentos"
      testID="transacoes-carregando-mais"
    />
  ) : erro ? (
    <View style={styles.rodape}>
      <Text style={styles.erro} testID="transacoes-erro-mais">
        Não foi possível carregar mais lançamentos: {erro}
      </Text>
      <Button onPress={carregarMais}>Tentar novamente</Button>
    </View>
  ) : null;

  const renderizarConteudo = () => {
    if (transacoes.length > 0) {
      return (
        <FlashList
          data={itens}
          renderItem={renderizarItem}
          keyExtractor={chaveDoItem}
          getItemType={tipoDoItem}
          estimatedItemSize={ALTURA_LINHA}
          onEndReached={carregarMais}
          onEndReachedThreshold={0.5}
          ListFooterComponent={rodapeLista}
          contentContainerStyle={{
            ...styles.lista,
            paddingBottom: insets.bottom + 16,
          }}
          refreshControl={
            <RefreshControl
              refreshing={atualizando}
              onRefresh={puxarParaAtualizar}
              colors={[CORES.verde]}
              tintColor={CORES.verde}
              progressBackgroundColor={CORES.superficie}
            />
          }
          testID="transacoes-lista"
        />
      );
    }
    if (carregando) {
      return (
        <ActivityIndicator
          style={styles.carregando}
          color={CORES.verde}
          accessibilityLabel="Carregando lançamentos"
          testID="transacoes-carregando"
        />
      );
    }
    if (erro) {
      return (
        <View style={styles.estado}>
          <Text style={styles.erro} testID="transacoes-erro">
            Não foi possível carregar os lançamentos: {erro}
          </Text>
          <Button onPress={recarregar}>Tentar novamente</Button>
        </View>
      );
    }
    return (
      <View style={styles.estado}>
        <Text style={styles.textoVazio} testID="transacoes-vazio">
          Nenhum lançamento ainda.
        </Text>
      </View>
    );
  };

  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={onFechar}>
      <Portal.Host>
        <View
          style={[styles.tela, {paddingTop: insets.top + 12}]}
          testID="transacoes-screen">
          <View style={styles.cabecalho} accessibilityRole="header">
            <Pressable
              onPress={onFechar}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              testID="transacoes-voltar"
              style={styles.botaoVoltar}>
              <Icon source="arrow-left" size={20} color={CORES.texto} />
            </Pressable>
            <Text style={styles.titulo}>Transações</Text>
            <View style={styles.espacoCabecalho} />
          </View>

          {renderizarConteudo()}

          <Snackbar
            visible={aviso !== null}
            onDismiss={() => setAviso(null)}
            duration={3000}
            style={styles.snackbar}
            theme={TEMA_SNACKBAR}
            testID="transacoes-snackbar">
            {aviso ?? ''}
          </Snackbar>
        </View>

        <ConfirmarExclusaoDialog
          visivel={paraExcluir !== null}
          descricao={paraExcluir?.descricao}
          carregando={excluindo}
          onCancelar={() => setParaExcluir(null)}
          onConfirmar={confirmarExclusao}
        />
      </Portal.Host>

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
  titulo: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONTES.extraNegrito,
    fontSize: 18,
    letterSpacing: -0.2,
    color: CORES.texto,
  },
  espacoCabecalho: {
    width: 38,
  },
  // A FlashList só aceita padding e cor de fundo aqui: o espaço entre os
  // itens fica em styles.linha.
  lista: {
    paddingHorizontal: 20,
  },
  linha: {
    paddingBottom: ESPACO_ITENS,
  },
  dia: {
    fontFamily: FONTES.seminegrito,
    fontSize: 12,
    color: CORES.textoSecundario,
    paddingTop: 12,
    paddingBottom: 8,
  },
  rodape: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  carregando: {
    flex: 1,
  },
  estado: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 48,
  },
  erro: {
    fontFamily: FONTES.regular,
    fontSize: 13,
    textAlign: 'center',
    color: CORES.vermelho,
  },
  textoVazio: {
    fontFamily: FONTES.regular,
    fontSize: 13,
    color: CORES.textoSecundario,
  },
  snackbar: ESTILO_SNACKBAR,
});

export default TransacoesScreen;
