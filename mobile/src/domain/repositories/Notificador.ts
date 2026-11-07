export interface Notificador {
  pedirPermissao(): Promise<boolean>;
  notificar(titulo: string, corpo: string): Promise<void>;
}
