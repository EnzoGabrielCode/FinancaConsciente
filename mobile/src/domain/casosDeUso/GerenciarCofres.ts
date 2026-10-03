import {validarCofre, validarMovimento} from '../cofres';
import {hojeISO} from '../datas';
import type {DadosCofre, TipoMovimento} from '../entities/Cofre';
import type {CofreRepository} from '../repositories/CofreRepository';
import type {TransacaoRepository} from '../repositories/TransacaoRepository';

export class GerenciarCofres {
  constructor(
    private readonly cofres: CofreRepository,
    private readonly transacoes: TransacaoRepository,
  ) {}

  async disponivel(): Promise<number> {
    const [saldo, guardado] = await Promise.all([
      this.transacoes.saldoAte(hojeISO()),
      this.cofres.totalGuardado(),
    ]);
    return saldo - guardado;
  }

  async criar(dados: DadosCofre): Promise<number> {
    const validos = await this.validar(dados);
    return this.cofres.criar(validos);
  }

  async atualizar(id: number, dados: DadosCofre): Promise<void> {
    const validos = await this.validar(dados, id);
    await this.cofres.atualizar(id, validos);
  }

  async excluir(id: number): Promise<void> {
    await this.cofres.excluir(id);
  }

  guardar(cofreId: number, valorCentavos: number): Promise<void> {
    return this.movimentar(cofreId, 'deposito', valorCentavos);
  }

  retirar(cofreId: number, valorCentavos: number): Promise<void> {
    return this.movimentar(cofreId, 'retirada', valorCentavos);
  }

  private async validar(
    dados: DadosCofre,
    idEmEdicao?: number,
  ): Promise<DadosCofre> {
    const existentes = await this.cofres.listar();
    const resultado = validarCofre(
      dados,
      existentes.filter(cofre => cofre.id !== idEmEdicao).map(c => c.nome),
    );
    if (!resultado.valido) {
      throw new Error(Object.values(resultado.erros)[0]);
    }
    return resultado.dados;
  }

  private async movimentar(
    cofreId: number,
    tipo: TipoMovimento,
    valorCentavos: number,
  ): Promise<void> {
    const [cofre, disponivelCentavos] = await Promise.all([
      this.cofres.buscarPorId(cofreId),
      this.disponivel(),
    ]);
    if (!cofre) {
      throw new Error('Cofre não encontrado.');
    }
    const erro = validarMovimento({
      tipo,
      valorCentavos,
      saldoCofreCentavos: cofre.saldoCentavos,
      disponivelCentavos,
    });
    if (erro) {
      throw new Error(erro);
    }
    await this.cofres.registrarMovimento({
      cofreId,
      tipo,
      valorCentavos,
      data: hojeISO(),
    });
  }
}
