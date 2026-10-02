export interface ArmazenamentoComprovantes {
  /** Copia a foto para a pasta do app e devolve a URI definitiva. */
  guardar(uriTemporaria: string): Promise<string>;
  /** Apaga o arquivo; não lança erro se ele não existir. */
  apagar(uri: string): Promise<void>;
  /** Diz se a URI já está na pasta de comprovantes do app. */
  ehDefinitivo(uri: string): boolean;
}
