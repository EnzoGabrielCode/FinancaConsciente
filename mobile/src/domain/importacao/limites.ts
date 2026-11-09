export const MAX_BYTES_EXTRATO = 2 * 1024 * 1024;
export const MAX_LINHAS_EXTRATO = 2000;

export const ERRO_ARQUIVO_GRANDE =
  'O arquivo passa de 2 MB. Exporte um período menor no app do banco.';
export const ERRO_MUITAS_LINHAS =
  'O arquivo tem mais de 2.000 lançamentos. Exporte um período menor.';
export const ERRO_ARQUIVO_VAZIO = 'Este arquivo está vazio.';
export const ERRO_SEM_LANCAMENTOS =
  'Não encontramos lançamentos neste arquivo.';
export const ERRO_EXTENSAO = 'Escolha um arquivo .ofx, .csv ou .txt.';
