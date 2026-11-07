export interface Notificador {
  pedirPermissao(): Promise<boolean>;
  notificar(titulo: string, corpo: string): Promise<void>;
  agendar(
    id: string,
    quando: Date,
    titulo: string,
    corpo: string,
  ): Promise<void>;
  cancelarComPrefixo(prefixo: string): Promise<void>;
}
