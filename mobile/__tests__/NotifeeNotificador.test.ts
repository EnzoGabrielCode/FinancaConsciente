import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  TriggerType,
} from '@notifee/react-native';

import {NotifeeNotificador} from '../src/data/servicos/NotifeeNotificador';

const criarCanal = notifee.createChannel as unknown as jest.Mock<
  () => Promise<string>
>;
const exibir = notifee.displayNotification as unknown as jest.Mock;
const agendarTrigger =
  notifee.createTriggerNotification as unknown as jest.Mock;
const idsAgendados = notifee.getTriggerNotificationIds as unknown as jest.Mock<
  () => Promise<string[]>
>;
const cancelar = notifee.cancelTriggerNotifications as unknown as jest.Mock;
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

  describe('lembretes agendados', () => {
    const quando = new Date(2026, 11, 8, 9);

    it('agenda com id fixo no canal de contas, sem alarmManager', async () => {
      await new NotifeeNotificador().agendar(
        'conta-1-2026-12-10-antes',
        quando,
        'Internet vence em 2 dias',
        'R$ 99,90 · dia 10 de dez.',
      );

      expect(criarCanal).toHaveBeenCalledWith({
        id: 'contas',
        name: 'Lembretes de contas',
        importance: AndroidImportance.HIGH,
      });
      criarCanal.mockImplementation(async () => 'contas');
      expect(agendarTrigger).toHaveBeenCalledTimes(1);
      const [notificacao, gatilho] = agendarTrigger.mock.calls[0] as [
        {id: string; title: string; body: string; android: object},
        object,
      ];
      expect(notificacao).toMatchObject({
        id: 'conta-1-2026-12-10-antes',
        title: 'Internet vence em 2 dias',
        body: 'R$ 99,90 · dia 10 de dez.',
      });
      expect(gatilho).toEqual({
        type: TriggerType.TIMESTAMP,
        timestamp: quando.getTime(),
      });
    });

    it('usa um canal próprio para cada tipo de aviso', async () => {
      criarCanal.mockImplementation(
        (async (canal: {id: string}) => canal.id) as never,
      );
      const notificador = new NotifeeNotificador();

      await notificador.agendar('a', quando, 'T', 'C');
      await notificador.agendar('b', quando, 'T', 'C');
      await notificador.notificar('T', 'C');

      expect(criarCanal).toHaveBeenCalledTimes(2);
      expect(
        (agendarTrigger.mock.calls[0][0] as {android: {channelId: string}})
          .android.channelId,
      ).toBe('contas');
      expect(
        (exibir.mock.calls[0][0] as {android: {channelId: string}}).android
          .channelId,
      ).toBe('orcamentos');
    });

    it('cancela só os ids com o prefixo, sem confundir conta 1 e 11', async () => {
      idsAgendados.mockResolvedValueOnce([
        'conta-1-2026-12-10-antes',
        'conta-1-2026-12-10-dia',
        'conta-11-2026-12-10-dia',
      ]);

      await new NotifeeNotificador().cancelarComPrefixo('conta-1-');

      expect(cancelar).toHaveBeenCalledWith([
        'conta-1-2026-12-10-antes',
        'conta-1-2026-12-10-dia',
      ]);
    });

    it('sem nada para cancelar não chama a Notifee', async () => {
      idsAgendados.mockResolvedValueOnce(['conta-2-2026-12-10-dia']);

      await new NotifeeNotificador().cancelarComPrefixo('conta-1-');

      expect(cancelar).not.toHaveBeenCalled();
    });
  });
});
