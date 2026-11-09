import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';

import {
  ERRO_ARQUIVO_GRANDE,
  ERRO_EXTENSAO,
  MAX_BYTES_EXTRATO,
} from '../../domain/importacao/limites';
import type {
  ArquivoEscolhido,
  SeletorArquivo,
} from '../../domain/repositories/SeletorArquivo';
import {base64ParaBytes} from './base64';

const EXTENSOES = /\.(ofx|csv|txt)$/i;

// fileCopyUri vem de Uri.fromFile: "file://" e o caminho codificado (%20...).
export function caminhoDoArquivo(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''));
}

export class SeletorArquivoDocumentPicker implements SeletorArquivo {
  async escolher(): Promise<ArquivoEscolhido | null> {
    let escolhido;
    try {
      // Todos os tipos: o Android não tem MIME confiável para .ofx.
      escolhido = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.allFiles],
        copyTo: 'cachesDirectory',
      });
    } catch (erro) {
      if (DocumentPicker.isCancel(erro)) {
        return null;
      }
      throw erro;
    }

    const nome = escolhido.name ?? '';
    const copia = escolhido.fileCopyUri;
    try {
      if (!EXTENSOES.test(nome)) {
        throw new Error(ERRO_EXTENSAO);
      }
      if ((escolhido.size ?? 0) > MAX_BYTES_EXTRATO) {
        throw new Error(ERRO_ARQUIVO_GRANDE);
      }
      if (!copia) {
        throw new Error(
          escolhido.copyError ?? 'Não foi possível abrir o arquivo.',
        );
      }
      const base64 = await RNFS.readFile(caminhoDoArquivo(copia), 'base64');
      return {nome, bytes: base64ParaBytes(base64)};
    } finally {
      // O extrato não fica no aparelho além da leitura.
      if (copia) {
        await RNFS.unlink(caminhoDoArquivo(copia)).catch(() => {});
      }
    }
  }
}
