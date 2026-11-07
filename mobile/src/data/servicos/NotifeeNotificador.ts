import notifee, {
  AndroidImportance,
  AuthorizationStatus,
} from '@notifee/react-native';

import type {Notificador} from '../../domain/repositories/Notificador';

const CANAL_ORCAMENTOS = 'orcamentos';

export class NotifeeNotificador implements Notificador {
  private canal: Promise<string> | null = null;

  private garantirCanal(): Promise<string> {
    if (!this.canal) {
      this.canal = notifee
        .createChannel({
          id: CANAL_ORCAMENTOS,
          name: 'Alertas de orçamento',
          importance: AndroidImportance.HIGH,
        })
        .catch(erro => {
          this.canal = null;
          throw erro;
        });
    }
    return this.canal;
  }

  async pedirPermissao(): Promise<boolean> {
    const {authorizationStatus} = await notifee.requestPermission();
    return authorizationStatus >= AuthorizationStatus.AUTHORIZED;
  }

  async notificar(titulo: string, corpo: string): Promise<void> {
    const channelId = await this.garantirCanal();
    await notifee.displayNotification({
      title: titulo,
      body: corpo,
      android: {
        channelId,
        smallIcon: 'ic_launcher',
        pressAction: {id: 'default'},
      },
    });
  }
}
