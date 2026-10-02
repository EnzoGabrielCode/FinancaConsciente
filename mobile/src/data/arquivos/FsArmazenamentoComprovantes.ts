import RNFS from 'react-native-fs';

import type {ArmazenamentoComprovantes} from '../../domain/repositories/ArmazenamentoComprovantes';

const PREFIXO_ARQUIVO = 'file://';

function semPrefixo(uri: string): string {
  return uri.startsWith(PREFIXO_ARQUIVO)
    ? uri.slice(PREFIXO_ARQUIVO.length)
    : uri;
}

function extensaoDe(caminho: string): 'jpg' | 'png' {
  return /\.png$/i.test(caminho) ? 'png' : 'jpg';
}

export class FsArmazenamentoComprovantes implements ArmazenamentoComprovantes {
  constructor(
    private readonly pasta = `${RNFS.DocumentDirectoryPath}/comprovantes`,
  ) {}

  async guardar(uriTemporaria: string): Promise<string> {
    const origem = semPrefixo(uriTemporaria);
    if (!(await RNFS.exists(this.pasta))) {
      await RNFS.mkdir(this.pasta);
    }
    const destino = `${this.pasta}/comprovante-${Date.now()}.${extensaoDe(
      origem,
    )}`;
    await RNFS.copyFile(origem, destino);
    return `${PREFIXO_ARQUIVO}${destino}`;
  }

  async apagar(uri: string): Promise<void> {
    const caminho = semPrefixo(uri);
    try {
      if (await RNFS.exists(caminho)) {
        await RNFS.unlink(caminho);
      }
    } catch {
      // Arquivo já removido ou inacessível: nada a fazer.
    }
  }

  ehDefinitivo(uri: string): boolean {
    return semPrefixo(uri).startsWith(`${this.pasta}/`);
  }
}
