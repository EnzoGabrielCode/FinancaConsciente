// Uma linha reconhecida, com a posição na imagem (em pixels).
export interface TrechoReconhecido {
  texto: string;
  topo: number;
  altura: number;
  esquerda: number;
}

export interface ReconhecedorTexto {
  reconhecer(uri: string): Promise<TrechoReconhecido[]>;
}
