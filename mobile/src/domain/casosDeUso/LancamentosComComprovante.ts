import type {DadosTransacao} from '../entities/Transacao';
import type {ArmazenamentoComprovantes} from '../repositories/ArmazenamentoComprovantes';
import type {TransacaoRepository} from '../repositories/TransacaoRepository';

export class LancamentosComComprovante {
  constructor(
    private readonly repositorio: TransacaoRepository,
    private readonly armazenamento: ArmazenamentoComprovantes,
  ) {}

  async criar(dados: DadosTransacao): Promise<number> {
    const {dados: definitivos, copiada} = await this.guardarComprovante(dados);
    try {
      return await this.repositorio.criar(definitivos);
    } catch (erro) {
      await this.apagarSemFalhar(copiada);
      throw erro;
    }
  }

  async atualizar(id: number, dados: DadosTransacao): Promise<void> {
    const anterior = await this.repositorio.buscarPorId(id);
    const {dados: definitivos, copiada} = await this.guardarComprovante(dados);
    try {
      await this.repositorio.atualizar(id, definitivos);
    } catch (erro) {
      await this.apagarSemFalhar(copiada);
      throw erro;
    }
    const uriAnterior = anterior?.comprovanteUri ?? null;
    if (uriAnterior && uriAnterior !== definitivos.comprovanteUri) {
      await this.apagarSemFalhar(uriAnterior);
    }
  }

  async excluir(id: number): Promise<void> {
    const transacao = await this.repositorio.buscarPorId(id);
    await this.repositorio.excluir(id);
    await this.apagarSemFalhar(transacao?.comprovanteUri ?? null);
  }

  private async guardarComprovante(
    dados: DadosTransacao,
  ): Promise<{dados: DadosTransacao; copiada: string | null}> {
    const uri = dados.comprovanteUri;
    if (!uri || this.armazenamento.ehDefinitivo(uri)) {
      return {dados, copiada: null};
    }
    const definitiva = await this.armazenamento.guardar(uri);
    return {dados: {...dados, comprovanteUri: definitiva}, copiada: definitiva};
  }

  private async apagarSemFalhar(uri: string | null): Promise<void> {
    if (!uri) {
      return;
    }
    try {
      await this.armazenamento.apagar(uri);
    } catch {
      // O lançamento já está salvo/excluído; um arquivo órfão não deve desfazer isso.
    }
  }
}
