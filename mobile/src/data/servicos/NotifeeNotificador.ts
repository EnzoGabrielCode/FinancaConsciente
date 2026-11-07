import notifee, {
  AndroidImportance,
  AuthorizationStatus,
  TriggerType,
  type NotificationAndroid,
} from '@notifee/react-native';

import type {Notificador} from '../../domain/repositories/Notificador';

const CANAIS = {
  orcamentos: 'Alertas de orçamento',
  contas: 'Lembretes de contas',
};

type Canal = keyof typeof CANAIS;

export class NotifeeNotificador implements Notificador {
  private canais = new Map<Canal, Promise<string>>();

  private garantirCanal(id: Canal): Promise<string> {
    const existente = this.canais.get(id);
    if (existente) {
      return existente;
    }
    const canal = notifee
      .createChannel({
        id,
        name: CANAIS[id],
        importance: AndroidImportance.HIGH,
      })
      .catch(erro => {
        this.canais.delete(id);
        throw erro;
      });
    this.canais.set(id, canal);
    return canal;
  }

  private async opcoesAndroid(canal: Canal): Promise<NotificationAndroid> {
    return {
      channelId: await this.garantirCanal(canal),
      smallIcon: 'ic_launcher',
      pressAction: {id: 'default'},
    };
  }

  async pedirPermissao(): Promise<boolean> {
    const {authorizationStatus} = await notifee.requestPermission();
    return authorizationStatus >= AuthorizationStatus.AUTHORIZED;
  }

  async notificar(titulo: string, corpo: string): Promise<void> {
    await notifee.displayNotification({
      title: titulo,
      body: corpo,
      android: await this.opcoesAndroid('orcamentos'),
    });
  }

  // Sem alarmManager: dispensa a permissão de alarme exato, ao custo de o
  // Android poder atrasar um pouco o horário.
  async agendar(
    id: string,
    quando: Date,
    titulo: string,
    corpo: string,
  ): Promise<void> {
    await notifee.createTriggerNotification(
      {
        id,
        title: titulo,
        body: corpo,
        android: await this.opcoesAndroid('contas'),
      },
      {type: TriggerType.TIMESTAMP, timestamp: quando.getTime()},
    );
  }

  async cancelarComPrefixo(prefixo: string): Promise<void> {
    const ids = await notifee.getTriggerNotificationIds();
    const daConta = ids.filter(id => id.startsWith(prefixo));
    // Sem ids a Notifee cancelaria todos os agendamentos.
    if (daConta.length > 0) {
      await notifee.cancelTriggerNotifications(daConta);
    }
  }
}
