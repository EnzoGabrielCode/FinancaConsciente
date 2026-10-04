export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof Error) {
    return erro.message;
  }
  if (
    typeof erro === 'object' &&
    erro !== null &&
    'message' in erro &&
    typeof erro.message === 'string'
  ) {
    return erro.message;
  }
  return String(erro);
}
