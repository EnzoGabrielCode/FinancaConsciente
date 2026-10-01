import React from 'react';
import {Button, Dialog, Portal, Text} from 'react-native-paper';

import {CORES} from '../theme/cores';

interface Props {
  visivel: boolean;
  descricao?: string;
  carregando?: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
}

function ConfirmarExclusaoDialog({
  visivel,
  descricao,
  carregando = false,
  onCancelar,
  onConfirmar,
}: Props): React.JSX.Element {
  return (
    <Portal>
      <Dialog
        visible={visivel}
        onDismiss={carregando ? undefined : onCancelar}
        testID="dialogo-exclusao">
        <Dialog.Title>Excluir lançamento?</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium">
            {descricao
              ? `"${descricao}" será apagado`
              : 'O lançamento será apagado'}{' '}
            deste aparelho. Essa ação não pode ser desfeita.
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onCancelar} disabled={carregando}>
            Cancelar
          </Button>
          <Button
            onPress={onConfirmar}
            loading={carregando}
            disabled={carregando}
            textColor={CORES.vermelho}
            testID="confirmar-exclusao">
            Excluir
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

export default ConfirmarExclusaoDialog;
