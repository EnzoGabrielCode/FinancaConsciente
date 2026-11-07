import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import notifee, {
  AndroidImportance,
  AuthorizationStatus,
} from '@notifee/react-native';

import {NotifeeNotificador} from '../src/data/servicos/NotifeeNotificador';

const criarCanal = notifee.createChannel as unknown as jest.Mock<
  () => Promise<string>
>;
const exibir = notifee.displayNotification as unknown as jest.Mock;
const pedir = notifee.requestPermission as unknown as jest.Mock<
  () => Promise<{authorizationStatus: number}>
>;

describe('NotifeeNotificador', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    criarCanal.mockImplementation(async () => 'orcamentos');
  });

  it('cria o canal uma vez e exibe a notificação nele', async () => {
    const notificador = new NotifeeNotificador();

    await notificador.notificar('Título', 'Corpo');
    await notificador.notificar('Outro', 'Corpo');

    expect(criarCanal).toHaveBeenCalledTimes(1);
    expect(criarCanal).toHaveBeenCalledWith({
      id: 'orcamentos',
      name: 'Alertas de orçamento',
      importance: AndroidImportance.HIGH,
    });
    expect(exibir).toHaveBeenCalledTimes(2);
    expect(exibir).toHaveBeenCalledWith({
      title: 'Título',
      body: 'Corpo',
      android: {
        channelId: 'orcamentos',
        smallIcon: 'ic_launcher',
        pressAction: {id: 'default'},
      },
    });
  });

  it('tenta criar o canal de novo depois de uma falha', async () => {
    const notificador = new NotifeeNotificador();
    criarCanal.mockRejectedValueOnce(new Error('falhou'));

    await expect(notificador.notificar('T', 'C')).rejects.toThrow('falhou');
    await expect(notificador.notificar('T', 'C')).resolves.toBeUndefined();

    expect(criarCanal).toHaveBeenCalledTimes(2);
  });

  it.each([
    [AuthorizationStatus.AUTHORIZED, true],
    [AuthorizationStatus.PROVISIONAL, true],
    [AuthorizationStatus.DENIED, false],
    [AuthorizationStatus.NOT_DETERMINED, false],
  ])('com o status %p a permissão é %p', async (status, esperado) => {
    pedir.mockResolvedValueOnce({authorizationStatus: status});
    await expect(new NotifeeNotificador().pedirPermissao()).resolves.toBe(
      esperado,
    );
  });
});
