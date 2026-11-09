import RNFS from 'react-native-fs';
import Share from 'react-native-share';

import {
  cancelamentoDeCompartilhar,
  type ExportadorArquivos,
} from '../../domain/repositories/ExportadorArquivos';

export const PASTA_RELATORIOS = `${RNFS.CachesDirectoryPath}/relatorios`;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

export class RnfsExportador implements ExportadorArquivos {
  constructor(private readonly agora: () => number = Date.now) {}

  // Os arquivos só existem para o compartilhar: os de ontem já não servem.
  private async prepararPasta(): Promise<void> {
    await RNFS.mkdir(PASTA_RELATORIOS);
    try {
      const itens = await RNFS.readDir(PASTA_RELATORIOS);
      for (const item of itens) {
        const modificado = item.mtime?.getTime() ?? this.agora();
        if (item.isFile() && this.agora() - modificado > UM_DIA_MS) {
          await RNFS.unlink(item.path).catch(() => {});
        }
      }
    } catch {
      // Limpeza é só arrumação: não pode impedir a exportação.
    }
  }

  private async salvar(
    nome: string,
    conteudo: string,
    codificacao: 'utf8' | 'base64',
  ): Promise<string> {
    await this.prepararPasta();
    const caminho = `${PASTA_RELATORIOS}/${nome}`;
    await RNFS.writeFile(caminho, conteudo, codificacao);
    return caminho;
  }

  salvarTexto(nome: string, conteudo: string): Promise<string> {
    return this.salvar(nome, conteudo, 'utf8');
  }

  salvarBase64(nome: string, base64: string): Promise<string> {
    return this.salvar(nome, base64, 'base64');
  }

  async compartilhar(
    caminho: string,
    mime: string,
    titulo: string,
  ): Promise<void> {
    try {
      await Share.open({
        url: `file://${caminho}`,
        type: mime,
        title: titulo,
        failOnCancel: false,
      });
    } catch (erro) {
      // Algumas versões ainda rejeitam ao fechar o menu, mesmo com failOnCancel.
      if (/did not share/i.test(String(erro))) {
        throw cancelamentoDeCompartilhar();
      }
      throw erro;
    }
  }
}
