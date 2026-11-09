export interface ExportadorArquivos {
  salvarTexto(nome: string, conteudo: string): Promise<string>;
  salvarBase64(nome: string, base64: string): Promise<string>;
  compartilhar(caminho: string, mime: string, titulo: string): Promise<void>;
}

export const NOME_CANCELAMENTO = 'CompartilhamentoCancelado';

// A pessoa fechou o menu de compartilhar: não é falha, não mostra erro.
export function cancelamentoDeCompartilhar(): Error {
  const erro = new Error('Compartilhamento cancelado.');
  erro.name = NOME_CANCELAMENTO;
  return erro;
}

export const ehCancelamento = (erro: unknown): boolean =>
  erro instanceof Error && erro.name === NOME_CANCELAMENTO;
