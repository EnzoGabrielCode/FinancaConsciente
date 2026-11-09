export interface ArquivoEscolhido {
  nome: string;
  bytes: Uint8Array;
}

export interface SeletorArquivo {
  // null quando a pessoa fecha o seletor sem escolher.
  escolher(): Promise<ArquivoEscolhido | null>;
}
