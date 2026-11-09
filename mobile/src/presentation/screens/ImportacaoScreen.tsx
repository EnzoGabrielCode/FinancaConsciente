import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {FlashList, type ListRenderItemInfo} from '@shopify/flash-list';
import {Checkbox, Dialog, Icon, Portal} from 'react-native-paper';
import LinearGradient from 'react-native-linear-gradient';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {
  ROTULO_FORMATO,
  type ImportarExtrato,
  type LeituraExtrato,
} from '../../domain/casosDeUso/ImportarExtrato';
import {buscarCategoria, categoriasDo} from '../../domain/categorias';
import {formatarDataCurta, hojeISO} from '../../domain/datas';
import {formatarCentavos} from '../../domain/dinheiro';
import type {MapeamentoColunas} from '../../domain/importacao/csv';
import type {ItemImportacao} from '../../domain/importacao/prepararImportacao';
import type {SeletorArquivo} from '../../domain/repositories/SeletorArquivo';
import {CORES, comAlfa, corDoTipo} from '../theme/cores';
import {DEGRADES, DIAGONAL} from '../theme/degrades';
import {FONTES} from '../theme/fontes';
import {mensagemDeErro} from '../utils/mensagemDeErro';

interface Props {
  visivel: boolean;
  importador: Pick<ImportarExtrato, 'ler' | 'aplicarMapeamento' | 'importar'>;
  seletorArquivo: SeletorArquivo;
  onFechar: () => void;
  onImportado: (quantidade: number) => void;
}

type Etapa = 'inicio' | 'lendo' | 'mapeamento' | 'previa' | 'importando';
type Campo = 'data' | 'descricao' | 'valor';

const CAMPOS: {id: Campo; rotulo: string}[] = [
  {id: 'data', rotulo: 'Data'},
  {id: 'descricao', rotulo: 'Descrição'},
  {id: 'valor', rotulo: 'Valor'},
];

const ALTURA_ITEM = 72;

const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;

export const textoImportados = (n: number) =>
  `${plural(n, 'lançamento importado', 'lançamentos importados')}`;

export function resumoDaPrevia(itens: ItemImportacao[]): string {
  const contar = (situacao: ItemImportacao['situacao']) =>
    itens.filter(i => i.situacao === situacao).length;
  const partes = [
    plural(itens.length, 'lançamento', 'lançamentos'),
    plural(contar('nova'), 'novo', 'novos'),
  ];
  const jaImportadas = contar('ja-importada');
  const duplicatas = contar('possivel-duplicata');
  if (jaImportadas > 0) {
    partes.push(plural(jaImportadas, 'já importado', 'já importados'));
  }
  if (duplicatas > 0) {
    partes.push(
      plural(duplicatas, 'possível duplicata', 'possíveis duplicatas'),
    );
  }
  return partes.join(' · ');
}

const ETIQUETA: Partial<Record<ItemImportacao['situacao'], string>> = {
  'ja-importada': 'Já importada',
  'possivel-duplicata': 'Possível duplicata',
};

function ImportacaoScreen({
  visivel,
  importador,
  seletorArquivo,
  onFechar,
  onImportado,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const [etapa, setEtapa] = useState<Etapa>('inicio');
  const [erro, setErro] = useState<string | null>(null);
  const [leitura, setLeitura] = useState<LeituraExtrato | null>(null);
  const [itens, setItens] = useState<ItemImportacao[]>([]);
  const [mapeamento, setMapeamento] = useState<Record<Campo, number | null>>({
    data: null,
    descricao: null,
    valor: null,
  });
  const [cartao, setCartao] = useState(false);
  const [mostrarErros, setMostrarErros] = useState(false);
  const [escolhendoCategoria, setEscolhendoCategoria] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (!visivel) {
      setEtapa('inicio');
      setErro(null);
      setLeitura(null);
      setItens([]);
      setMapeamento({data: null, descricao: null, valor: null});
      setCartao(false);
      setMostrarErros(false);
      setEscolhendoCategoria(null);
    }
  }, [visivel]);

  const mostrarPrevia = (nova: LeituraExtrato) => {
    setLeitura(nova);
    setItens(nova.itens);
    setEtapa('previa');
  };

  const escolherArquivo = async () => {
    setErro(null);
    try {
      const arquivo = await seletorArquivo.escolher();
      if (!arquivo) {
        return;
      }
      setEtapa('lendo');
      const lida = await importador.ler(arquivo.nome, arquivo.bytes);
      if (lida.precisaMapeamento) {
        setLeitura(lida);
        setEtapa('mapeamento');
      } else {
        mostrarPrevia(lida);
      }
    } catch (falha) {
      setErro(mensagemDeErro(falha));
      setEtapa('inicio');
    }
  };

  const mapeamentoCompleto =
    mapeamento.data !== null &&
    mapeamento.descricao !== null &&
    mapeamento.valor !== null &&
    new Set([mapeamento.data, mapeamento.descricao, mapeamento.valor]).size ===
      3;

  const continuarMapeamento = async () => {
    if (!leitura || !mapeamentoCompleto) {
      return;
    }
    setErro(null);
    setEtapa('lendo');
    try {
      const colunas: MapeamentoColunas = {
        data: mapeamento.data!,
        descricao: mapeamento.descricao!,
        valor: mapeamento.valor!,
        identificador: null,
      };
      mostrarPrevia(
        await importador.aplicarMapeamento(leitura, colunas, cartao),
      );
    } catch (falha) {
      setErro(mensagemDeErro(falha));
      setEtapa('mapeamento');
    }
  };

  const alternar = useCallback((indice: number) => {
    setItens(atual =>
      atual.map((item, i) =>
        i === indice ? {...item, selecionado: !item.selecionado} : item,
      ),
    );
  }, []);

  const marcarTodos = (selecionado: boolean) =>
    setItens(atual => atual.map(item => ({...item, selecionado})));

  const escolherCategoria = (categoria: string) => {
    const indice = escolhendoCategoria;
    setEscolhendoCategoria(null);
    if (indice === null) {
      return;
    }
    setItens(atual =>
      atual.map((item, i) =>
        i === indice ? {...item, categoria, sugerida: false} : item,
      ),
    );
  };

  const selecionados = itens.filter(item => item.selecionado).length;

  const importar = async () => {
    setErro(null);
    setEtapa('importando');
    try {
      const quantidade = await importador.importar(itens, hojeISO());
      onImportado(quantidade);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
      setEtapa('previa');
    }
  };

  const renderizarItem = useCallback(
    ({item, index}: ListRenderItemInfo<ItemImportacao>) => {
      const categoria = buscarCategoria(item.tipo, item.categoria);
      const etiqueta = ETIQUETA[item.situacao];
      const receita = item.tipo === 'receita';
      return (
        <View style={styles.item} testID={`importacao-item-${index}`}>
          <Pressable
            onPress={() => alternar(index)}
            accessibilityRole="checkbox"
            accessibilityState={{checked: item.selecionado}}
            accessibilityLabel={`${item.linha.descricao}, ${formatarCentavos(
              item.valorCentavos,
            )}, ${formatarDataCurta(item.linha.data)}${
              etiqueta ? `, ${etiqueta.toLowerCase()}` : ''
            }`}
            testID={`importacao-marcar-${index}`}
            style={styles.marcar}>
            <Checkbox.Android
              status={item.selecionado ? 'checked' : 'unchecked'}
              color={CORES.verde}
              uncheckedColor={CORES.textoSecundario}
            />
          </Pressable>
          <View style={styles.textosItem}>
            <View style={styles.linhaItem}>
              <Text style={styles.descricao} numberOfLines={1}>
                {item.linha.descricao}
              </Text>
              <Text
                style={[styles.valor, {color: corDoTipo(item.tipo)}]}
                testID={`importacao-valor-${index}`}>
                {receita ? '+' : '-'}
                {formatarCentavos(item.valorCentavos)}
              </Text>
            </View>
            <View style={styles.linhaItem}>
              <Text style={styles.data}>
                {formatarDataCurta(item.linha.data)}
              </Text>
              <Pressable
                onPress={() => setEscolhendoCategoria(index)}
                accessibilityRole="button"
                accessibilityLabel={`Categoria: ${
                  categoria?.label ?? item.categoria
                }${item.sugerida ? ', sugerida automaticamente' : ''}`}
                testID={`importacao-categoria-${index}`}
                style={[
                  styles.chipCategoria,
                  categoria && {
                    borderColor: comAlfa(categoria.cor, 0.4),
                  },
                ]}>
                {categoria && (
                  <Icon
                    source={categoria.icone}
                    size={12}
                    color={categoria.cor}
                  />
                )}
                <Text style={styles.textoCategoria}>
                  {categoria?.label ?? item.categoria}
                </Text>
                {item.sugerida && (
                  <Text
                    style={styles.seloSugerida}
                    testID={`importacao-sugerida-${index}`}>
                    ✨ Sugerida
                  </Text>
                )}
              </Pressable>
              {etiqueta && (
                <Text
                  style={styles.etiqueta}
                  testID={`importacao-etiqueta-${index}`}>
                  {etiqueta}
                </Text>
              )}
            </View>
          </View>
        </View>
      );
    },
    [alternar],
  );

  const conteudoInicio = (
    <View style={styles.centro} testID="importacao-inicio">
      <View style={styles.iconeInicio}>
        <Icon source="file-import-outline" size={32} color={CORES.verde} />
      </View>
      <Text style={styles.explicacao}>
        No app do seu banco, exporte o extrato em OFX ou CSV e escolha o arquivo
        aqui.
      </Text>
      {erro && (
        <Text style={styles.erro} testID="importacao-erro">
          {erro}
        </Text>
      )}
      {etapa === 'lendo' ? (
        <View style={styles.lendo} testID="importacao-lendo">
          <ActivityIndicator color={CORES.verde} />
          <Text style={styles.explicacao}>Lendo arquivo...</Text>
        </View>
      ) : (
        <Pressable
          onPress={escolherArquivo}
          accessibilityRole="button"
          accessibilityLabel="Escolher arquivo"
          testID="importacao-escolher"
          style={styles.botaoPrincipal}>
          <LinearGradient
            colors={DEGRADES.verde}
            {...DIAGONAL}
            style={styles.degrade}
          />
          <Text style={styles.textoBotaoPrincipal}>Escolher arquivo</Text>
        </Pressable>
      )}
    </View>
  );

  const conteudoMapeamento = leitura && (
    <ScrollView
      contentContainerStyle={styles.conteudo}
      testID="importacao-mapeamento">
      <Text style={styles.explicacao}>
        Não reconhecemos as colunas de {leitura.nome}. Diga onde está cada
        informação:
      </Text>
      {CAMPOS.map(({id, rotulo}) => (
        <View key={id}>
          <Text style={styles.rotulo}>{rotulo.toUpperCase()}</Text>
          <View style={styles.linhaChips}>
            {leitura.cabecalho.map((coluna, indice) => {
              const selecionada = mapeamento[id] === indice;
              return (
                <Pressable
                  key={`${coluna}-${indice}`}
                  onPress={() =>
                    setMapeamento(atual => ({...atual, [id]: indice}))
                  }
                  accessibilityRole="radio"
                  accessibilityState={{checked: selecionada}}
                  accessibilityLabel={`${rotulo}: coluna ${coluna}`}
                  testID={`mapear-${id}-${indice}`}
                  style={[styles.chip, selecionada && styles.chipSelecionado]}>
                  <Text
                    style={[
                      styles.textoChip,
                      selecionada && styles.textoChipAtivo,
                    ]}>
                    {coluna}
                  </Text>
                  <Text style={styles.exemplo} numberOfLines={1}>
                    {leitura.exemplo[indice] ?? ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      <View style={styles.linhaSwitch}>
        <Text style={styles.textoSwitch}>
          Fatura de cartão (valores positivos são despesas)
        </Text>
        <Switch
          value={cartao}
          onValueChange={setCartao}
          trackColor={{
            false: CORES.superficie3,
            true: comAlfa(CORES.verde, 0.4),
          }}
          thumbColor={cartao ? CORES.verde : CORES.textoSecundario}
          accessibilityLabel="Fatura de cartão"
          testID="mapear-cartao"
        />
      </View>
      {erro && (
        <Text style={styles.erro} testID="importacao-erro">
          {erro}
        </Text>
      )}
      <Pressable
        onPress={continuarMapeamento}
        disabled={!mapeamentoCompleto}
        accessibilityRole="button"
        accessibilityLabel="Continuar"
        accessibilityState={{disabled: !mapeamentoCompleto}}
        testID="mapear-continuar"
        style={[
          styles.botaoPrincipal,
          !mapeamentoCompleto && styles.desabilitado,
        ]}>
        <LinearGradient
          colors={DEGRADES.verde}
          {...DIAGONAL}
          style={styles.degrade}
        />
        <Text style={styles.textoBotaoPrincipal}>Continuar</Text>
      </Pressable>
    </ScrollView>
  );

  const importando = etapa === 'importando';
  const conteudoPrevia = leitura && (
    <View style={styles.previa} testID="importacao-previa">
      <View style={styles.topoPrevia}>
        <Text style={styles.arquivo} numberOfLines={1}>
          {leitura.nome} · {ROTULO_FORMATO[leitura.formato]}
        </Text>
        <Text style={styles.resumo} testID="importacao-resumo">
          {resumoDaPrevia(itens)}
        </Text>
        <View style={styles.linhaAcoes}>
          <Pressable
            onPress={() => marcarTodos(true)}
            disabled={importando}
            accessibilityRole="button"
            testID="importacao-marcar-todos">
            <Text style={styles.link}>Marcar todos</Text>
          </Pressable>
          <Pressable
            onPress={() => marcarTodos(false)}
            disabled={importando}
            accessibilityRole="button"
            testID="importacao-desmarcar-todos">
            <Text style={styles.link}>Desmarcar todos</Text>
          </Pressable>
        </View>
        {leitura.errosDeLinha.length > 0 && (
          <Pressable
            onPress={() => setMostrarErros(atual => !atual)}
            accessibilityRole="button"
            accessibilityState={{expanded: mostrarErros}}
            testID="importacao-erros"
            style={styles.avisoErros}>
            <Text style={styles.textoAviso}>
              {plural(
                leitura.errosDeLinha.length,
                'linha ignorada',
                'linhas ignoradas',
              )}{' '}
              {mostrarErros ? '▲' : '▼'}
            </Text>
            {mostrarErros &&
              leitura.errosDeLinha.map(({linha, motivo}) => (
                <Text key={linha} style={styles.textoAviso}>
                  Linha {linha}: {motivo}
                </Text>
              ))}
          </Pressable>
        )}
        {erro && (
          <Text style={styles.erro} testID="importacao-erro">
            {erro}
          </Text>
        )}
      </View>
      <FlashList
        data={itens}
        renderItem={renderizarItem}
        keyExtractor={(item, indice) => `${item.linha.idExterno}-${indice}`}
        estimatedItemSize={ALTURA_ITEM}
        contentContainerStyle={styles.lista}
        testID="importacao-lista"
      />
      <View style={[styles.rodape, {paddingBottom: insets.bottom + 16}]}>
        <Pressable
          onPress={importar}
          disabled={selecionados === 0 || importando}
          accessibilityRole="button"
          accessibilityState={{
            disabled: selecionados === 0 || importando,
            busy: importando,
          }}
          testID="importacao-importar"
          style={[
            styles.botaoPrincipal,
            (selecionados === 0 || importando) && styles.desabilitado,
          ]}>
          <LinearGradient
            colors={DEGRADES.verde}
            {...DIAGONAL}
            style={styles.degrade}
          />
          {importando ? (
            <ActivityIndicator color={CORES.fundo} />
          ) : (
            <Text style={styles.textoBotaoPrincipal}>
              Importar {plural(selecionados, 'lançamento', 'lançamentos')}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );

  const itemEscolhendo =
    escolhendoCategoria === null ? null : itens[escolhendoCategoria];

  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={onFechar}>
      <Portal.Host>
        <View
          style={[styles.tela, {paddingTop: insets.top + 12}]}
          testID="importacao-screen">
          <View style={styles.cabecalho} accessibilityRole="header">
            <Pressable
              onPress={onFechar}
              disabled={importando}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              testID="importacao-voltar"
              style={styles.botaoVoltar}>
              <Icon source="arrow-left" size={20} color={CORES.texto} />
            </Pressable>
            <Text style={styles.titulo}>Importar extrato</Text>
            <View style={styles.espacoCabecalho} />
          </View>

          {etapa === 'mapeamento'
            ? conteudoMapeamento
            : etapa === 'previa' || etapa === 'importando'
            ? conteudoPrevia
            : conteudoInicio}
        </View>

        <Portal>
          <Dialog
            visible={itemEscolhendo !== null}
            onDismiss={() => setEscolhendoCategoria(null)}
            style={styles.dialogo}
            testID="importacao-dialogo-categoria">
            <Dialog.Title style={styles.tituloDialogo}>Categoria</Dialog.Title>
            <Dialog.Content style={styles.opcoes}>
              {itemEscolhendo &&
                categoriasDo(itemEscolhendo.tipo).map(opcao => (
                  <Pressable
                    key={opcao.id}
                    onPress={() => escolherCategoria(opcao.id)}
                    accessibilityRole="radio"
                    accessibilityState={{
                      checked: itemEscolhendo.categoria === opcao.id,
                    }}
                    accessibilityLabel={opcao.label}
                    testID={`importacao-opcao-${opcao.id}`}
                    style={styles.opcao}>
                    <Icon source={opcao.icone} size={18} color={opcao.cor} />
                    <Text style={styles.textoOpcao}>{opcao.label}</Text>
                  </Pressable>
                ))}
            </Dialog.Content>
          </Dialog>
        </Portal>
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
  centro: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  iconeInicio: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: comAlfa(CORES.verde, 0.12),
  },
  explicacao: {
    fontFamily: FONTES.regular,
    fontSize: 14,
    textAlign: 'center',
    color: CORES.textoSecundario,
  },
  lendo: {
    alignItems: 'center',
    gap: 8,
  },
  erro: {
    fontFamily: FONTES.regular,
    fontSize: 13,
    textAlign: 'center',
    color: CORES.vermelho,
  },
  conteudo: {
    paddingHorizontal: 20,
    paddingBottom: 24,
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
    maxWidth: 160,
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
  exemplo: {
    fontFamily: FONTES.mono,
    fontSize: 10,
    color: CORES.textoApagado,
  },
  linhaSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  textoSwitch: {
    flex: 1,
    fontFamily: FONTES.regular,
    fontSize: 13,
    color: CORES.texto,
  },
  previa: {
    flex: 1,
  },
  topoPrevia: {
    gap: 6,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  arquivo: {
    fontFamily: FONTES.seminegrito,
    fontSize: 13,
    color: CORES.texto,
  },
  resumo: {
    fontFamily: FONTES.regular,
    fontSize: 12,
    color: CORES.textoSecundario,
  },
  linhaAcoes: {
    flexDirection: 'row',
    gap: 16,
  },
  link: {
    fontFamily: FONTES.seminegrito,
    fontSize: 12,
    color: CORES.verde,
  },
  avisoErros: {
    gap: 2,
    padding: 10,
    borderRadius: 12,
    backgroundColor: comAlfa(CORES.laranja, 0.1),
  },
  textoAviso: {
    fontFamily: FONTES.regular,
    fontSize: 12,
    color: CORES.laranja,
  },
  lista: {
    paddingHorizontal: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ALTURA_ITEM,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: CORES.borda,
  },
  marcar: {
    paddingHorizontal: 4,
  },
  textosItem: {
    flex: 1,
    gap: 4,
    paddingRight: 8,
  },
  linhaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  descricao: {
    flex: 1,
    fontFamily: FONTES.medio,
    fontSize: 14,
    color: CORES.texto,
  },
  valor: {
    fontFamily: FONTES.monoNegrito,
    fontSize: 13,
  },
  data: {
    fontFamily: FONTES.mono,
    fontSize: 11,
    color: CORES.textoApagado,
  },
  chipCategoria: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: CORES.realceForte,
  },
  textoCategoria: {
    fontFamily: FONTES.regular,
    fontSize: 11,
    color: CORES.textoSecundario,
  },
  seloSugerida: {
    fontFamily: FONTES.seminegrito,
    fontSize: 10,
    color: CORES.verde,
  },
  etiqueta: {
    fontFamily: FONTES.negrito,
    fontSize: 9,
    color: CORES.laranja,
    backgroundColor: comAlfa(CORES.laranja, 0.12),
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  rodape: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: CORES.borda,
    backgroundColor: CORES.fundo,
  },
  botaoPrincipal: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: CORES.verde,
  },
  degrade: {
    ...StyleSheet.absoluteFillObject,
  },
  textoBotaoPrincipal: {
    fontFamily: FONTES.extraNegrito,
    fontSize: 15,
    color: CORES.fundo,
  },
  desabilitado: {
    opacity: 0.4,
  },
  dialogo: {
    backgroundColor: CORES.superficie2,
  },
  tituloDialogo: {
    fontFamily: FONTES.negrito,
  },
  opcoes: {
    gap: 4,
  },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  textoOpcao: {
    fontFamily: FONTES.medio,
    fontSize: 14,
    color: CORES.texto,
  },
});

export default ImportacaoScreen;
