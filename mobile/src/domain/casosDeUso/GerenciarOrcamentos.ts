import {CATEGORIAS_DESPESA} from '../categorias';
import {anoMesDe} from '../datas';
import {formatarCentavos} from '../dinheiro';
import type {DadosOrcamento, PainelOrcamentos} from '../entities/Orcamento';
import {
  categoriaDoOrcamento,
  montarProgressos,
  nivelAlcancado,
  percentualDe,
  resumir,
  validarOrcamento,
} from '../orcamentos';
import type {Notificador} from '../repositories/Notificador';
import type {OrcamentoRepository} from '../repositories/OrcamentoRepository';
import type {TransacaoRepository} from '../repositories/TransacaoRepository';

export class GerenciarOrcamentos {
  constructor(
    private readonly orcamentos: OrcamentoRepository,
    private readonly transacoes: TransacaoRepository,
    private readonly notificador: Notificador,
  ) {}

  async carregar(hoje: string): Promise<PainelOrcamentos> {
    const [orcamentos, gastos] = await Promise.all([
      this.orcamentos.listar(),
      this.transacoes.gastosPorCategoria(anoMesDe(hoje)),
    ]);
    const progressos = montarProgressos(orcamentos, gastos);
    const usadas = new Set(orcamentos.map(o => o.categoria));
    return {
      progressos,
      resumo: resumir(progressos, hoje),
      categoriasLivres: CATEGORIAS_DESPESA.filter(c => !usadas.has(c.id)),
    };
  }

  async salvar(dados: DadosOrcamento): Promise<void> {
    const resultado = validarOrcamento(dados);
    if (!resultado.valido) {
      throw new Error(Object.values(resultado.erros)[0]);
    }
    await this.orcamentos.salvar(resultado.dados);
  }

  async excluir(id: number): Promise<void> {
    await this.orcamentos.excluir(id);
  }

  async pedirPermissao(): Promise<boolean> {
    try {
      return await this.notificador.pedirPermissao();
    } catch {
      return false;
    }
  }

  // Devolve true se notificou. Nunca lança: o lançamento já foi salvo e um
  // problema no aviso não pode atrapalhá-lo.
  async verificarAlerta(
    categoria: string,
    dataISO: string,
    hoje: string,
  ): Promise<boolean> {
    try {
      const anoMes = anoMesDe(hoje);
      if (anoMesDe(dataISO) !== anoMes) {
        return false;
      }
      const orcamentos = await this.orcamentos.listar();
      const orcamento = orcamentos.find(o => o.categoria === categoria);
      if (!orcamento) {
        return false;
      }
      const gastos = await this.transacoes.gastosPorCategoria(anoMes);
      const gasto = gastos[categoria] ?? 0;
      const limite = orcamento.limiteCentavos;
      const nivel = nivelAlcancado(gasto, limite);
      const {label} = categoriaDoOrcamento(categoria);

      if (nivel === 100) {
        await this.orcamentos.registrarAlerta(categoria, anoMes, 80);
        if (!(await this.orcamentos.registrarAlerta(categoria, anoMes, 100))) {
          return false;
        }
        await this.notificador.notificar(
          `Orçamento de ${label} estourado`,
          `Você gastou ${formatarCentavos(gasto)} de ${formatarCentavos(
            limite,
          )} este mês.`,
        );
        return true;
      }

      if (
        nivel === 80 &&
        (await this.orcamentos.registrarAlerta(categoria, anoMes, 80))
      ) {
        await this.notificador.notificar(
          `Atenção: orçamento de ${label}`,
          `Você já usou ${percentualDe(
            gasto,
            limite,
          )}% do limite do mês. Restam ${formatarCentavos(limite - gasto)}.`,
        );
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
