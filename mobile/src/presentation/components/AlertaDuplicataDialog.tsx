import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Button, Dialog, Icon, Portal} from 'react-native-paper';

import {buscarCategoria, categoriasDo} from '../../domain/categorias';
import {formatarDataCurta, hojeISO} from '../../domain/datas';
import {formatarCentavos} from '../../domain/dinheiro';
import {horaLocal} from '../../domain/duplicatas';
import type {
  MotivoDuplicata,
  PossivelDuplicata,
} from '../../domain/entities/Duplicata';
import {CORES} from '../theme/cores';
import {FONTES} from '../theme/fontes';

export const MAX_ITENS_DUPLICATA = 3;

const FRASE_MOTIVO: Record<MotivoDuplicata, string> = {
  'mesma-categoria': 'Mesmo valor, mesma categoria e mesmo dia.',
  'lancada-agora': 'Lançada há poucos minutos com o mesmo valor.',
};

interface Props {
  visivel: boolean;
  duplicatas: PossivelDuplicata[];
  valorCentavos: number;
  data: string;
  salvando?: boolean;
  onRevisar: () => void;
  onSalvarMesmoAssim: () => void;
}

function ItemDuplicata({
  duplicata,
}: {
  duplicata: PossivelDuplicata;
}): React.JSX.Element {
  const {transacao, criadoEm} = duplicata;
  const categoria =
    buscarCategoria(transacao.tipo, transacao.categoria) ??
    categoriasDo(transacao.tipo).find(c => c.id === 'outros')!;
  const hora = horaLocal(criadoEm);
  return (
    <View style={styles.item} testID={`duplicata-item-${transacao.id}`}>
      <Icon source={categoria.icone} size={18} color={categoria.cor} />
      <View style={styles.textosItem}>
        <Text style={styles.categoria} numberOfLines={1}>
          {categoria.label}
        </Text>
        <Text style={styles.descricao} numberOfLines={1}>
          {transacao.descricao}
        </Text>
      </View>
      {hora ? <Text style={styles.hora}>às {hora}</Text> : null}
    </View>
  );
}

function AlertaDuplicataDialog({
  visivel,
  duplicatas,
  valorCentavos,
  data,
  salvando = false,
  onRevisar,
  onSalvarMesmoAssim,
}: Props): React.JSX.Element {
  const [primeira] = duplicatas;
  const visiveis = duplicatas.slice(0, MAX_ITENS_DUPLICATA);
  const restantes = duplicatas.length - visiveis.length;
  const quando = data === hojeISO() ? 'hoje' : `em ${formatarDataCurta(data)}`;

  return (
    <Portal>
      <Dialog
        visible={visivel}
        onDismiss={salvando ? undefined : onRevisar}
        dismissable={!salvando}
        style={styles.dialogo}
        testID="alerta-duplicata">
        <Dialog.Icon icon="content-copy" size={28} color={CORES.laranja} />
        <Dialog.Title style={styles.titulo} testID="alerta-duplicata-titulo">
          Despesa repetida?
        </Dialog.Title>
        <Dialog.Content style={styles.conteudo}>
          <Text style={styles.texto} testID="alerta-duplicata-texto">
            Você já lançou {formatarCentavos(valorCentavos)} {quando}:
          </Text>
          {visiveis.map(duplicata => (
            <ItemDuplicata key={duplicata.transacao.id} duplicata={duplicata} />
          ))}
          {restantes > 0 && (
            <Text style={styles.mais} testID="alerta-duplicata-mais">
              e mais {restantes}
            </Text>
          )}
          {primeira && (
            <Text style={styles.motivo} testID="alerta-duplicata-motivo">
              {FRASE_MOTIVO[primeira.motivo]}
            </Text>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button
            mode="text"
            onPress={onRevisar}
            disabled={salvando}
            textColor={CORES.textoSecundario}
            testID="alerta-duplicata-revisar">
            Voltar e revisar
          </Button>
          <Button
            mode="contained"
            onPress={onSalvarMesmoAssim}
            loading={salvando}
            disabled={salvando}
            buttonColor={CORES.laranja}
            textColor={CORES.fundo}
            testID="alerta-duplicata-salvar">
            Salvar mesmo assim
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialogo: {
    backgroundColor: CORES.superficie2,
  },
  titulo: {
    textAlign: 'center',
    fontFamily: FONTES.negrito,
  },
  conteudo: {
    gap: 8,
  },
  texto: {
    fontFamily: FONTES.regular,
    fontSize: 14,
    color: CORES.textoSecundario,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: CORES.realce,
  },
  textosItem: {
    flex: 1,
  },
  categoria: {
    fontFamily: FONTES.seminegrito,
    fontSize: 13,
    color: CORES.texto,
  },
  descricao: {
    fontFamily: FONTES.regular,
    fontSize: 12,
    color: CORES.textoSecundario,
  },
  hora: {
    fontFamily: FONTES.regular,
    fontSize: 12,
    color: CORES.textoSecundario,
  },
  mais: {
    fontFamily: FONTES.regular,
    fontSize: 12,
    color: CORES.textoSecundario,
  },
  motivo: {
    fontFamily: FONTES.regular,
    fontSize: 13,
    color: CORES.textoSecundario,
  },
});

export default AlertaDuplicataDialog;
