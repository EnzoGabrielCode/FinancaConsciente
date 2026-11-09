import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Icon, Menu, Portal, Snackbar} from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import type {
  GerarRelatorios,
  Patrimonio,
} from '../../domain/casosDeUso/GerarRelatorios';
import {
  CATEGORIAS_DESPESA,
  CATEGORIAS_RECEITA,
  type Categoria,
} from '../../domain/categorias';
import {formatarDataCurta, formatarMesCurto, hojeISO} from '../../domain/datas';
import {formatarCentavos, formatarPercentual} from '../../domain/dinheiro';
import type {
  FiltroRelatorio,
  Relatorio,
  TipoFiltro,
} from '../../domain/entities/Relatorio';
import {
  periodoPredefinido,
  validarFiltro,
  type PeriodoPredefinido,
} from '../../domain/relatorios';
import GraficoPatrimonio from '../components/GraficoPatrimonio';
import {seletorDataPadrao, type SeletorData} from '../servicos/seletorData';
import {CORES, comAlfa} from '../theme/cores';
import {DEGRADES, DIAGONAL} from '../theme/degrades';
import {FONTES} from '../theme/fontes';
import {ESTILO_SNACKBAR, TEMA_SNACKBAR} from '../theme';
import {mensagemDeErro} from '../utils/mensagemDeErro';

interface Props {
  visivel: boolean;
  gerar: Pick<
    GerarRelatorios,
    'carregar' | 'patrimonio' | 'exportarCsv' | 'exportarPdf'
  >;
  seletorData?: SeletorData;
  onFechar: () => void;
}

type Aba = 'extrato' | 'patrimonio';
type Periodo = PeriodoPredefinido | 'personalizado';
type Formato = 'pdf' | 'csv';

const ABAS: {id: Aba; rotulo: string}[] = [
  {id: 'extrato', rotulo: 'Extrato'},
  {id: 'patrimonio', rotulo: 'Patrimônio'},
];

const PERIODOS: {id: Periodo; rotulo: string}[] = [
  {id: 'este-mes', rotulo: 'Este mês'},
  {id: 'mes-passado', rotulo: 'Mês passado'},
  {id: '3-meses', rotulo: '3 meses'},
  {id: 'este-ano', rotulo: 'Este ano'},
  {id: 'personalizado', rotulo: 'Personalizado'},
];

const TIPOS: {id: TipoFiltro; rotulo: string}[] = [
  {id: 'todos', rotulo: 'Todos'},
  {id: 'despesa', rotulo: 'Despesas'},
  {id: 'receita', rotulo: 'Receitas'},
];

export function categoriasDoFiltro(tipo: TipoFiltro): Categoria[] {
  if (tipo === 'despesa') {
    return CATEGORIAS_DESPESA;
  }
  if (tipo === 'receita') {
    return CATEGORIAS_RECEITA;
  }
  // "Outros" existe nos dois tipos: aparece uma vez só.
  return [
    ...CATEGORIAS_DESPESA,
    ...CATEGORIAS_RECEITA.filter(
      receita => !CATEGORIAS_DESPESA.some(d => d.id === receita.id),
    ),
  ];
}

const textoLancamentos = (quantidade: number) =>
  `${quantidade} ${quantidade === 1 ? 'lançamento' : 'lançamentos'}`;

interface PropsChip {
  rotulo: string;
  selecionado: boolean;
  onPress: () => void;
  testID: string;
  icone?: string;
}

function ChipFiltro({
  rotulo,
  selecionado,
  onPress,
  testID,
  icone,
}: PropsChip): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{checked: selecionado}}
      accessibilityLabel={rotulo}
      testID={testID}
      style={[styles.chip, selecionado && styles.chipSelecionado]}>
      {icone && (
        <Icon
          source={icone}
          size={14}
          color={selecionado ? CORES.verde : CORES.textoSecundario}
        />
      )}
      <Text style={[styles.textoChip, selecionado && styles.textoChipAtivo]}>
        {rotulo}
      </Text>
    </Pressable>
  );
}

function RelatoriosScreen({
  visivel,
  gerar,
  seletorData = seletorDataPadrao,
  onFechar,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const hoje = hojeISO();
  const [aba, setAba] = useState<Aba>('extrato');
  const [periodo, setPeriodo] = useState<Periodo>('este-mes');
  const [personalizado, setPersonalizado] = useState(() =>
    periodoPredefinido('este-mes', hojeISO()),
  );
  const [tipo, setTipo] = useState<TipoFiltro>('todos');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [menuCategoria, setMenuCategoria] = useState(false);
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [patrimonio, setPatrimonio] = useState<Patrimonio | null>(null);
  const [gerando, setGerando] = useState<Formato | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const ultimaCarga = useRef(0);

  const intervalo =
    periodo === 'personalizado'
      ? personalizado
      : periodoPredefinido(periodo, hoje);
  const filtro: FiltroRelatorio = useMemo(
    () => ({de: intervalo.de, ate: intervalo.ate, tipo, categoria}),
    [intervalo.de, intervalo.ate, tipo, categoria],
  );
  const erroFiltro = validarFiltro(filtro);
  const opcoesCategoria = categoriasDoFiltro(tipo);
  const rotuloCategoria =
    opcoesCategoria.find(c => c.id === categoria)?.label ?? 'Todas';

  useEffect(() => {
    if (!visivel || aba !== 'extrato' || validarFiltro(filtro)) {
      return;
    }
    const carga = ++ultimaCarga.current;
    setCarregando(true);
    gerar
      .carregar(filtro)
      .then(novo => {
        if (carga === ultimaCarga.current) {
          setRelatorio(novo);
        }
      })
      .catch(erro => {
        if (carga === ultimaCarga.current) {
          setRelatorio(null);
          setAviso(mensagemDeErro(erro));
        }
      })
      .finally(() => {
        if (carga === ultimaCarga.current) {
          setCarregando(false);
        }
      });
  }, [visivel, aba, filtro, gerar]);

  useEffect(() => {
    if (!visivel || aba !== 'patrimonio') {
      return;
    }
    let ativo = true;
    gerar
      .patrimonio(hojeISO())
      .then(novo => ativo && setPatrimonio(novo))
      .catch(erro => ativo && setAviso(mensagemDeErro(erro)));
    return () => {
      ativo = false;
    };
  }, [visivel, aba, gerar]);

  const escolherPeriodo = (novo: Periodo) => {
    if (novo === 'personalizado' && periodo !== 'personalizado') {
      setPersonalizado(intervalo);
    }
    setPeriodo(novo);
  };

  const escolherTipo = (novo: TipoFiltro) => {
    setTipo(novo);
    if (categoria && !categoriasDoFiltro(novo).some(c => c.id === categoria)) {
      setCategoria(null);
    }
  };

  const escolherData = async (campo: 'de' | 'ate') => {
    try {
      const escolhida = await seletorData.escolher(personalizado[campo], hoje);
      if (escolhida) {
        setPersonalizado(atual => ({...atual, [campo]: escolhida}));
      }
    } catch (erro) {
      setAviso(mensagemDeErro(erro));
    }
  };

  const exportar = async (formato: Formato) => {
    if (!relatorio) {
      return;
    }
    setGerando(formato);
    try {
      if (formato === 'pdf') {
        await gerar.exportarPdf(relatorio);
      } else {
        await gerar.exportarCsv(relatorio);
      }
    } catch (erro) {
      setAviso(mensagemDeErro(erro));
    } finally {
      setGerando(null);
    }
  };

  const semLancamentos = relatorio !== null && relatorio.quantidade === 0;
  const exportacaoBloqueada =
    gerando !== null ||
    carregando ||
    erroFiltro !== null ||
    relatorio === null ||
    semLancamentos;

  const extrato = (
    <ScrollView
      contentContainerStyle={[
        styles.conteudo,
        {paddingBottom: insets.bottom + 24},
      ]}
      testID="relatorios-extrato">
      <View>
        <Text style={styles.rotulo}>PERÍODO</Text>
        <View style={styles.linhaChips}>
          {PERIODOS.map(opcao => (
            <ChipFiltro
              key={opcao.id}
              rotulo={opcao.rotulo}
              selecionado={periodo === opcao.id}
              onPress={() => escolherPeriodo(opcao.id)}
              testID={`periodo-${opcao.id}`}
            />
          ))}
        </View>
        {periodo === 'personalizado' && (
          <View style={styles.linhaDatas}>
            {(['de', 'ate'] as const).map(campo => (
              <Pressable
                key={campo}
                onPress={() => escolherData(campo)}
                accessibilityRole="button"
                accessibilityLabel={`${
                  campo === 'de' ? 'De' : 'Até'
                } ${formatarDataCurta(personalizado[campo])}`}
                testID={`periodo-${campo}`}
                style={styles.botaoData}>
                <Text style={styles.rotuloData}>
                  {campo === 'de' ? 'De' : 'Até'}
                </Text>
                <Text style={styles.valorData}>
                  {formatarDataCurta(personalizado[campo])}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        {erroFiltro && (
          <Text style={styles.erro} testID="relatorios-erro-filtro">
            {erroFiltro}
          </Text>
        )}
      </View>

      <View>
        <Text style={styles.rotulo}>TIPO E CATEGORIA</Text>
        <View style={styles.linhaChips}>
          {TIPOS.map(opcao => (
            <ChipFiltro
              key={opcao.id}
              rotulo={opcao.rotulo}
              selecionado={tipo === opcao.id}
              onPress={() => escolherTipo(opcao.id)}
              testID={`tipo-${opcao.id}`}
            />
          ))}
          <Menu
            visible={menuCategoria}
            onDismiss={() => setMenuCategoria(false)}
            contentStyle={styles.menu}
            anchor={
              <ChipFiltro
                rotulo={rotuloCategoria}
                selecionado={categoria !== null}
                onPress={() => setMenuCategoria(true)}
                testID="filtro-categoria"
                icone="tag-outline"
              />
            }>
            <Menu.Item
              title="Todas"
              onPress={() => {
                setCategoria(null);
                setMenuCategoria(false);
              }}
              testID="categoria-todas"
            />
            {opcoesCategoria.map(opcao => (
              <Menu.Item
                key={opcao.id}
                title={opcao.label}
                leadingIcon={opcao.icone}
                onPress={() => {
                  setCategoria(opcao.id);
                  setMenuCategoria(false);
                }}
                testID={`categoria-${opcao.id}`}
              />
            ))}
          </Menu>
        </View>
      </View>

      {carregando && !relatorio && (
        <ActivityIndicator
          color={CORES.verde}
          accessibilityLabel="Carregando relatório"
          testID="relatorios-carregando"
        />
      )}

      {relatorio && !erroFiltro && (
        <>
          <View style={styles.card} testID="relatorios-resumo">
            <View style={styles.linhaResumo}>
              <View style={styles.colunaResumo}>
                <Text style={styles.rotuloResumo}>RECEITAS</Text>
                <Text
                  style={[styles.valorResumo, styles.verde]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  testID="relatorios-receitas">
                  {formatarCentavos(relatorio.totalReceitas)}
                </Text>
              </View>
              <View style={styles.colunaResumo}>
                <Text style={styles.rotuloResumo}>DESPESAS</Text>
                <Text
                  style={[styles.valorResumo, styles.vermelho]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  testID="relatorios-despesas">
                  {formatarCentavos(relatorio.totalDespesas)}
                </Text>
              </View>
              <View style={styles.colunaResumo}>
                <Text style={styles.rotuloResumo}>RESULTADO</Text>
                <Text
                  style={[
                    styles.valorResumo,
                    relatorio.resultado < 0 && styles.vermelho,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  testID="relatorios-resultado">
                  {formatarCentavos(relatorio.resultado)}
                </Text>
              </View>
            </View>
            <Text style={styles.detalhe} testID="relatorios-quantidade">
              {textoLancamentos(relatorio.quantidade)}
            </Text>
          </View>

          {semLancamentos ? (
            <Text style={styles.vazio} testID="relatorios-vazio">
              Nenhum lançamento neste período
            </Text>
          ) : (
            relatorio.porCategoria.length > 0 && (
              <View style={styles.card} testID="relatorios-categorias">
                <Text style={styles.tituloCard}>Gastos por categoria</Text>
                {relatorio.porCategoria.map(gasto => {
                  const info = CATEGORIAS_DESPESA.find(
                    c => c.id === gasto.categoria,
                  );
                  const cor = info?.cor ?? CORES.textoSecundario;
                  return (
                    <View
                      key={gasto.categoria}
                      style={styles.gasto}
                      accessible
                      accessibilityLabel={`${
                        info?.label ?? gasto.categoria
                      }: ${formatarCentavos(
                        gasto.totalCentavos,
                      )}, ${formatarPercentual(gasto.percentual, {
                        casas: 0,
                        sinalPositivo: false,
                      })} das despesas`}
                      testID={`gasto-${gasto.categoria}`}>
                      <View style={styles.linhaGasto}>
                        <Text style={styles.nomeGasto}>
                          {info?.label ?? gasto.categoria}
                        </Text>
                        <Text style={styles.valorGasto}>
                          {formatarCentavos(gasto.totalCentavos)} ·{' '}
                          {formatarPercentual(gasto.percentual, {
                            casas: 0,
                            sinalPositivo: false,
                          })}
                        </Text>
                      </View>
                      <View style={styles.trilho}>
                        <View
                          style={[
                            styles.preenchimento,
                            {
                              width: `${gasto.percentual * 100}%`,
                              backgroundColor: cor,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            )
          )}
        </>
      )}

      <Pressable
        onPress={() => exportar('pdf')}
        disabled={exportacaoBloqueada}
        accessibilityRole="button"
        accessibilityLabel="Exportar PDF"
        accessibilityState={{
          disabled: exportacaoBloqueada,
          busy: gerando === 'pdf',
        }}
        testID="exportar-pdf"
        style={[
          styles.botaoPrincipal,
          exportacaoBloqueada && styles.botaoDesabilitado,
        ]}>
        <LinearGradient
          colors={DEGRADES.verde}
          {...DIAGONAL}
          style={styles.degradeBotao}
        />
        <Icon source="file-pdf-box" size={20} color={CORES.fundo} />
        <Text style={styles.textoBotaoPrincipal}>
          {gerando === 'pdf' ? 'Gerando...' : 'Exportar PDF'}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => exportar('csv')}
        disabled={exportacaoBloqueada}
        accessibilityRole="button"
        accessibilityLabel="Exportar CSV"
        accessibilityState={{
          disabled: exportacaoBloqueada,
          busy: gerando === 'csv',
        }}
        testID="exportar-csv"
        style={[
          styles.botaoContorno,
          exportacaoBloqueada && styles.botaoDesabilitado,
        ]}>
        <Icon source="file-delimited-outline" size={20} color={CORES.verde} />
        <Text style={styles.textoBotaoContorno}>
          {gerando === 'csv' ? 'Gerando...' : 'Exportar CSV'}
        </Text>
      </Pressable>
    </ScrollView>
  );

  const resumo = patrimonio?.resumo;
  const variacao = resumo?.variacaoCentavos ?? 0;
  const corVariacao =
    variacao > 0
      ? CORES.verde
      : variacao < 0
      ? CORES.vermelho
      : CORES.textoSecundario;

  const abaPatrimonio = (
    <ScrollView
      contentContainerStyle={[
        styles.conteudo,
        {paddingBottom: insets.bottom + 24},
      ]}
      testID="relatorios-patrimonio">
      {!patrimonio || !resumo ? (
        <ActivityIndicator
          color={CORES.verde}
          accessibilityLabel="Carregando patrimônio"
        />
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.rotuloResumo}>PATRIMÔNIO LÍQUIDO</Text>
            <Text
              style={[
                styles.patrimonioAtual,
                resumo.atual < 0 && styles.vermelho,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              testID="patrimonio-atual">
              {formatarCentavos(resumo.atual)}
            </Text>
            <Text
              style={[styles.variacao, {color: corVariacao}]}
              testID="patrimonio-variacao">
              {variacao > 0 ? '▲ +' : variacao < 0 ? '▼ ' : ''}
              {formatarCentavos(variacao)}
              {resumo.variacaoPercentual !== null
                ? ` (${formatarPercentual(resumo.variacaoPercentual)})`
                : ''}{' '}
              desde {formatarMesCurto(patrimonio.serie[0].anoMes)}
            </Text>
            <Text style={styles.detalhe}>
              Saldo acumulado dos lançamentos, já com o que está nos cofres.
            </Text>
          </View>
          <View style={styles.card}>
            <GraficoPatrimonio serie={patrimonio.serie} />
          </View>
        </>
      )}
    </ScrollView>
  );

  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={onFechar}>
      <Portal.Host>
        <View
          style={[styles.tela, {paddingTop: insets.top + 12}]}
          testID="relatorios-screen">
          <View style={styles.cabecalho} accessibilityRole="header">
            <Pressable
              onPress={onFechar}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              testID="relatorios-voltar"
              style={styles.botaoVoltar}>
              <Icon source="arrow-left" size={20} color={CORES.texto} />
            </Pressable>
            <Text style={styles.titulo}>Relatórios</Text>
            <View style={styles.espacoCabecalho} />
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
                  testID={`relatorios-aba-${id}`}
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

          {aba === 'extrato' ? extrato : abaPatrimonio}

          <Snackbar
            visible={aviso !== null}
            onDismiss={() => setAviso(null)}
            duration={4000}
            style={styles.snackbar}
            theme={TEMA_SNACKBAR}
            testID="relatorios-snackbar">
            {aviso ?? ''}
          </Snackbar>
        </View>
      </Portal.Host>
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
  conteudo: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
  },
  rotulo: {
    fontFamily: FONTES.seminegrito,
    fontSize: 11,
    letterSpacing: 0.7,
    color: CORES.textoSecundario,
    marginBottom: 8,
  },
  linhaChips: {
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
  textoChipAtivo: {
    color: CORES.verde,
  },
  menu: {
    backgroundColor: CORES.superficie2,
  },
  linhaDatas: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  botaoData: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CORES.realceForte,
    backgroundColor: CORES.superficie,
  },
  rotuloData: {
    fontFamily: FONTES.regular,
    fontSize: 11,
    color: CORES.textoSecundario,
  },
  valorData: {
    fontFamily: FONTES.monoMedio,
    fontSize: 14,
    color: CORES.texto,
  },
  erro: {
    marginTop: 8,
    fontFamily: FONTES.regular,
    fontSize: 12,
    color: CORES.vermelho,
  },
  card: {
    gap: 8,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CORES.borda,
    backgroundColor: CORES.superficie,
  },
  linhaResumo: {
    flexDirection: 'row',
    gap: 12,
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
  verde: {
    color: CORES.verde,
  },
  vermelho: {
    color: CORES.vermelho,
  },
  detalhe: {
    fontFamily: FONTES.regular,
    fontSize: 12,
    color: CORES.textoSecundario,
  },
  vazio: {
    paddingVertical: 24,
    textAlign: 'center',
    fontFamily: FONTES.regular,
    fontSize: 13,
    color: CORES.textoSecundario,
  },
  tituloCard: {
    fontFamily: FONTES.negrito,
    fontSize: 14,
    color: CORES.texto,
  },
  gasto: {
    gap: 6,
  },
  linhaGasto: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  nomeGasto: {
    fontFamily: FONTES.medio,
    fontSize: 13,
    color: CORES.texto,
  },
  valorGasto: {
    fontFamily: FONTES.monoMedio,
    fontSize: 12,
    color: CORES.textoSecundario,
  },
  trilho: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  preenchimento: {
    height: '100%',
    borderRadius: 999,
  },
  botaoPrincipal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: CORES.verde,
  },
  degradeBotao: {
    ...StyleSheet.absoluteFillObject,
  },
  textoBotaoPrincipal: {
    fontFamily: FONTES.extraNegrito,
    fontSize: 15,
    color: CORES.fundo,
  },
  botaoContorno: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: comAlfa(CORES.verde, 0.5),
  },
  textoBotaoContorno: {
    fontFamily: FONTES.extraNegrito,
    fontSize: 15,
    color: CORES.verde,
  },
  botaoDesabilitado: {
    opacity: 0.4,
  },
  patrimonioAtual: {
    fontFamily: FONTES.monoExtraNegrito,
    fontSize: 32,
    letterSpacing: -1,
    color: CORES.texto,
  },
  variacao: {
    fontFamily: FONTES.monoMedio,
    fontSize: 13,
  },
  snackbar: ESTILO_SNACKBAR,
});

export default RelatoriosScreen;
