import React, {useEffect, useState} from 'react';
import {FlatList, Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {Icon, Portal, Snackbar} from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {formatarCentavos, formatarPercentual} from '../../domain/dinheiro';
import type {
  Cofre,
  DadosCofre,
  TipoMovimento,
} from '../../domain/entities/Cofre';
import CofreCard from '../components/CofreCard';
import CofreFormSheet from '../components/CofreFormSheet';
import ConfirmarExclusaoDialog from '../components/ConfirmarExclusaoDialog';
import MovimentarCofreSheet from '../components/MovimentarCofreSheet';
import type {UseCofres} from '../hooks/useCofres';
import {CORES} from '../theme/cores';
import {DEGRADES, DIAGONAL, HORIZONTAL} from '../theme/degrades';
import {FONTES} from '../theme/fontes';
import {ESTILO_SNACKBAR, TEMA_SNACKBAR} from '../theme';
import {mensagemDeErro} from '../utils/mensagemDeErro';

interface Props {
  visivel: boolean;
  cofres: UseCofres;
  abrirFormulario?: boolean;
  onFechar: () => void;
}

interface EstadoForm {
  visivel: boolean;
  cofre: Cofre | null;
}

interface EstadoMovimento {
  cofreId: number | null;
  tipo: TipoMovimento;
}

const TAMANHO_FAB = 56;

export const textoQuantidade = (quantidade: number) =>
  `${quantidade} ${quantidade === 1 ? 'cofre' : 'cofres'}`;

function CofresScreen({
  visivel,
  cofres,
  abrirFormulario = false,
  onFechar,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<EstadoForm>({visivel: false, cofre: null});
  const [movimento, setMovimento] = useState<EstadoMovimento>({
    cofreId: null,
    tipo: 'deposito',
  });
  const [paraExcluir, setParaExcluir] = useState<Cofre | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (visivel) {
      setForm({visivel: abrirFormulario, cofre: null});
    } else {
      setForm({visivel: false, cofre: null});
      setMovimento(atual => ({...atual, cofreId: null}));
      setParaExcluir(null);
    }
  }, [visivel, abrirFormulario]);

  const {resumo, disponivelCentavos} = cofres;
  const cofreMovimentando =
    cofres.cofres.find(cofre => cofre.id === movimento.cofreId) ?? null;

  const abrirMovimento = (tipo: TipoMovimento) => (cofre: Cofre) =>
    setMovimento({cofreId: cofre.id, tipo});
  const fecharMovimento = () =>
    setMovimento(atual => ({...atual, cofreId: null}));
  const fecharForm = () => setForm(atual => ({...atual, visivel: false}));

  const salvarCofre = async (dados: DadosCofre) => {
    if (form.cofre) {
      await cofres.atualizar(form.cofre.id, dados);
    } else {
      await cofres.criar(dados);
    }
    setAviso(form.cofre ? 'Cofre atualizado' : 'Cofre criado');
    fecharForm();
  };

  const movimentar =
    (tipo: TipoMovimento) => async (cofreId: number, valorCentavos: number) => {
      const nome = cofres.cofres.find(c => c.id === cofreId)?.nome ?? '';
      if (tipo === 'deposito') {
        await cofres.guardar(cofreId, valorCentavos);
      } else {
        await cofres.retirar(cofreId, valorCentavos);
      }
      fecharMovimento();
      setAviso(
        tipo === 'deposito'
          ? `${formatarCentavos(valorCentavos)} guardado em ${nome}`
          : `${formatarCentavos(valorCentavos)} retirado de ${nome}`,
      );
    };

  const confirmarExclusao = async () => {
    if (!paraExcluir) {
      return;
    }
    setExcluindo(true);
    try {
      await cofres.excluir(paraExcluir.id);
      setAviso(
        paraExcluir.saldoCentavos > 0
          ? `Cofre excluído · ${formatarCentavos(
              paraExcluir.saldoCentavos,
            )} voltaram para o disponível`
          : 'Cofre excluído',
      );
    } catch (erro) {
      setAviso(mensagemDeErro(erro));
    } finally {
      setExcluindo(false);
      setParaExcluir(null);
    }
  };

  const cabecalhoLista = (
    <View style={styles.cabecalhoLista}>
      <LinearGradient
        colors={DEGRADES.cardTotal}
        {...DIAGONAL}
        style={styles.cardTotal}
        testID="cofres-total">
        <View style={styles.linhaTotal}>
          <View style={styles.colunaTotal}>
            <Text style={styles.rotuloTotal}>TOTAL GUARDADO</Text>
            <Text
              style={styles.valorTotal}
              numberOfLines={1}
              adjustsFontSizeToFit
              accessibilityLabel={`Total guardado: ${formatarCentavos(
                resumo.totalGuardadoCentavos,
              )}`}
              testID="cofres-total-valor">
              <Text style={styles.moedaTotal}>R$ </Text>
              <Text style={styles.numeroTotal}>
                {formatarCentavos(resumo.totalGuardadoCentavos).replace(
                  'R$ ',
                  '',
                )}
              </Text>
            </Text>
            <Text style={styles.detalheTotal} testID="cofres-total-detalhe">
              {resumo.totalMetasCentavos > 0
                ? `de ${formatarCentavos(
                    resumo.totalMetasCentavos,
                  )} em metas · `
                : ''}
              {textoQuantidade(resumo.quantidade)}
            </Text>
          </View>
          {resumo.progressoGeral !== null && (
            <View style={styles.progressoGeral} testID="cofres-progresso-geral">
              <Text style={styles.percentualGeral}>
                {formatarPercentual(resumo.progressoGeral, {
                  casas: 0,
                  sinalPositivo: false,
                })}
              </Text>
              <Text style={styles.rotuloGeral}>geral</Text>
            </View>
          )}
        </View>
        {resumo.progressoGeral !== null && (
          <View style={styles.trilhoGeral}>
            <LinearGradient
              colors={DEGRADES.progresso}
              {...HORIZONTAL}
              style={[
                styles.preenchimentoGeral,
                {width: `${resumo.progressoGeral * 100}%`},
              ]}
            />
          </View>
        )}
        <Text style={styles.disponivel} testID="cofres-disponivel">
          Disponível:{' '}
          <Text
            style={[
              styles.valorDisponivel,
              disponivelCentavos < 0 && styles.negativo,
            ]}>
            {formatarCentavos(disponivelCentavos)}
          </Text>
        </Text>
      </LinearGradient>

      {cofres.erro && (
        <Text style={styles.erro} testID="cofres-erro">
          Não foi possível carregar os cofres: {cofres.erro}
        </Text>
      )}

      {cofres.cofres.length > 0 && (
        <Text style={styles.quantidade} testID="cofres-quantidade">
          {textoQuantidade(cofres.cofres.length)}
        </Text>
      )}
    </View>
  );

  const vazio = cofres.carregando ? null : (
    <View style={styles.vazio} testID="cofres-vazio">
      <Text style={styles.emojiVazio}>🏦</Text>
      <Text style={styles.tituloVazio}>Nenhum cofre ainda</Text>
      <Text style={styles.textoVazio}>
        Crie seu primeiro cofre no botão + abaixo.
      </Text>
    </View>
  );

  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={onFechar}>
      <Portal.Host>
        <View
          style={[styles.tela, {paddingTop: insets.top + 12}]}
          testID="cofres-screen">
          <View style={styles.cabecalho} accessibilityRole="header">
            <Pressable
              onPress={onFechar}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              testID="cofres-voltar"
              style={styles.botaoVoltar}>
              <Icon source="arrow-left" size={20} color={CORES.texto} />
            </Pressable>
            <Text style={styles.titulo}>Cofres Virtuais</Text>
            <View style={styles.espacoCabecalho} />
          </View>

          <FlatList
            data={cofres.cofres}
            keyExtractor={cofre => String(cofre.id)}
            numColumns={2}
            columnWrapperStyle={styles.linhaGrade}
            contentContainerStyle={[
              styles.lista,
              {paddingBottom: insets.bottom + TAMANHO_FAB + 32},
            ]}
            ListHeaderComponent={cabecalhoLista}
            ListEmptyComponent={vazio}
            renderItem={({item}) => (
              <CofreCard
                cofre={item}
                onPress={abrirMovimento('deposito')}
                onGuardar={abrirMovimento('deposito')}
                onRetirar={abrirMovimento('retirada')}
                onEditar={cofre => setForm({visivel: true, cofre})}
                onExcluir={setParaExcluir}
              />
            )}
            testID="cofres-lista"
          />

          <Pressable
            onPress={() => setForm({visivel: true, cofre: null})}
            accessibilityRole="button"
            accessibilityLabel="Novo cofre"
            testID="cofres-novo"
            style={({pressed}) => [
              styles.fab,
              {bottom: insets.bottom + 24},
              pressed && styles.fabPressionado,
            ]}>
            <LinearGradient
              colors={DEGRADES.verde}
              {...DIAGONAL}
              style={styles.degradeFab}
            />
            <Icon source="plus" size={28} color={CORES.fundo} />
          </Pressable>

          <Snackbar
            visible={aviso !== null}
            onDismiss={() => setAviso(null)}
            duration={3000}
            style={styles.snackbar}
            theme={TEMA_SNACKBAR}
            testID="cofres-snackbar">
            {aviso ?? ''}
          </Snackbar>
        </View>

        <ConfirmarExclusaoDialog
          visivel={paraExcluir !== null}
          titulo={`Excluir "${paraExcluir?.nome ?? ''}"?`}
          mensagem={`Os ${formatarCentavos(
            paraExcluir?.saldoCentavos ?? 0,
          )} guardados voltam para o saldo disponível.`}
          carregando={excluindo}
          onCancelar={() => setParaExcluir(null)}
          onConfirmar={confirmarExclusao}
        />
      </Portal.Host>

      <CofreFormSheet
        visivel={form.visivel}
        cofre={form.cofre}
        nomesExistentes={cofres.cofres.map(cofre => cofre.nome)}
        onFechar={fecharForm}
        onSalvar={salvarCofre}
      />

      <MovimentarCofreSheet
        visivel={cofreMovimentando !== null}
        cofre={cofreMovimentando}
        tipoInicial={movimento.tipo}
        disponivelCentavos={disponivelCentavos}
        carregarMovimentos={cofres.listarMovimentos}
        onFechar={fecharMovimento}
        onGuardar={movimentar('deposito')}
        onRetirar={movimentar('retirada')}
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
    fontFamily: FONTES.negrito,
    fontSize: 18,
    color: CORES.texto,
  },
  espacoCabecalho: {
    width: 38,
  },
  lista: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  linhaGrade: {
    gap: 12,
  },
  cabecalhoLista: {
    gap: 16,
    marginBottom: 4,
  },
  cardTotal: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(57,255,132,0.18)',
    gap: 12,
  },
  linhaTotal: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  colunaTotal: {
    flex: 1,
    gap: 4,
  },
  rotuloTotal: {
    fontFamily: FONTES.regular,
    fontSize: 12,
    letterSpacing: 1.2,
    color: CORES.textoSecundario,
  },
  valorTotal: {
    fontFamily: FONTES.monoNegrito,
    fontSize: 32,
  },
  moedaTotal: {
    color: CORES.texto,
  },
  numeroTotal: {
    color: CORES.verde,
  },
  detalheTotal: {
    fontFamily: FONTES.regular,
    fontSize: 12,
    color: CORES.textoSecundario,
  },
  progressoGeral: {
    alignItems: 'flex-end',
  },
  percentualGeral: {
    fontFamily: FONTES.monoNegrito,
    fontSize: 20,
    color: CORES.verde,
  },
  rotuloGeral: {
    fontFamily: FONTES.regular,
    fontSize: 11,
    color: CORES.textoSecundario,
  },
  trilhoGeral: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  preenchimentoGeral: {
    height: '100%',
    borderRadius: 999,
  },
  disponivel: {
    fontFamily: FONTES.regular,
    fontSize: 13,
    color: CORES.textoSecundario,
  },
  valorDisponivel: {
    fontFamily: FONTES.monoNegrito,
    color: CORES.texto,
  },
  negativo: {
    color: CORES.vermelho,
  },
  erro: {
    fontFamily: FONTES.regular,
    fontSize: 13,
    color: CORES.vermelho,
  },
  quantidade: {
    fontFamily: FONTES.negrito,
    fontSize: 15,
    color: CORES.texto,
  },
  vazio: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 48,
  },
  emojiVazio: {
    fontFamily: FONTES.regular,
    fontSize: 44,
  },
  tituloVazio: {
    fontFamily: FONTES.negrito,
    fontSize: 16,
    color: CORES.texto,
  },
  textoVazio: {
    fontFamily: FONTES.regular,
    fontSize: 13,
    color: CORES.textoSecundario,
  },
  fab: {
    position: 'absolute',
    right: 20,
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

export default CofresScreen;
