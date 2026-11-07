import {formatarDiaCurto} from '../datas';
import {formatarCentavos} from '../dinheiro';
import type {
  ContaRecorrente,
  DadosContaRecorrente,
  PainelContasRecorrentes,
} from '../entities/ContaRecorrente';
import {
  dataDoLembrete,
  momentoDoLembrete,
  mudouAgenda,
  primeiroVencimento,
  totalMensalFixo,
  validarContaRecorrente,
  vencimentosAte,
  vencimentoSeguinte,
} from '../recorrencia';
import type {ContaRecorrenteRepository} from '../repositories/ContaRecorrenteRepository';
import type {Notificador} from '../repositories/Notificador';
import type {TransacaoRepository} from '../repositories/TransacaoRepository';

const SEGUNDOS_TESTE_LEMBRETE = 10;

const prefixoDaConta = (id: number) => `conta-${id}-`;

const textoDias = (dias: number) => (dias === 1 ? '1 dia' : `${dias} dias`);

export class GerenciarContasRecorrentes {
  constructor(
    private readonly contas: ContaRecorrenteRepository,
    private readonly transacoes: TransacaoRepository,
    private readonly notificador: Notificador,
    private readonly aoLancarDespesa?: (
      categoria: string,
      data: string,
    ) => Promise<void> | void,
  ) {}

  async carregar(_hoje: string): Promise<PainelContasRecorrentes> {
    const contas = await this.contas.listar();
    return {
      contas: [...contas].sort((a, b) => a.proxima.localeCompare(b.proxima)),
      totalMensal: totalMensalFixo(contas),
    };
  }

  // Devolve quantas despesas foram lançadas: uma conta que vence hoje já entra.
  async salvar(
    dados: DadosContaRecorrente,
    id: number | undefined,
    hoje: string,
  ): Promise<number> {
    const resultado = validarContaRecorrente(dados);
    if (!resultado.valido) {
      throw new Error(Object.values(resultado.erros)[0]);
    }
    const validos = resultado.dados;
    const contaId = await this.gravar(validos, id, hoje);
    const lancadas = await this.lancarVencidas(hoje);
    // Depois de lançar: o lembrete precisa ser do vencimento que ficou pendente.
    const conta = await this.contas.buscarPorId(contaId);
    if (conta) {
      await this.reagendar(conta, hoje);
    }
    return lancadas;
  }

  private async gravar(
    dados: DadosContaRecorrente,
    id: number | undefined,
    hoje: string,
  ): Promise<number> {
    if (id === undefined) {
      return this.contas.criar(dados, primeiroVencimento(dados, hoje));
    }
    const atual = await this.contas.buscarPorId(id);
    if (!atual) {
      throw new Error('Conta não encontrada.');
    }
    const proxima = mudouAgenda(atual, dados)
      ? primeiroVencimento(dados, hoje)
      : atual.proxima;
    await this.contas.atualizar(id, dados, proxima);
    return id;
  }

  async excluir(id: number): Promise<void> {
    await this.cancelarLembretes(id);
    await this.contas.excluir(id);
  }

  async pausar(id: number): Promise<void> {
    await this.contas.definirAtiva(id, false);
    await this.cancelarLembretes(id);
  }

  async retomar(id: number, hoje: string): Promise<void> {
    const conta = await this.contas.buscarPorId(id);
    if (!conta) {
      throw new Error('Conta não encontrada.');
    }
    const proxima = primeiroVencimento(conta, hoje);
    // Nesta ordem: ativa com a data antiga, lançaria o período pausado.
    await this.contas.avancarProxima(id, proxima);
    await this.contas.definirAtiva(id, true);
    await this.reagendar({...conta, ativa: true, proxima}, hoje);
  }

  async lancarVencidas(hoje: string): Promise<number> {
    const contas = await this.contas.listar();
    let lancadas = 0;
    for (const conta of contas.filter(c => c.ativa)) {
      try {
        for (const data of vencimentosAte(conta, hoje)) {
          const inseriu = await this.transacoes.lancarRecorrente({
            tipo: 'despesa',
            descricao: conta.descricao,
            valorCentavos: conta.valorCentavos,
            data,
            categoria: conta.categoria,
            recorrencia: 'fixa',
            comprovanteUri: null,
            contaRecorrenteId: conta.id,
          });
          await this.contas.avancarProxima(
            conta.id,
            vencimentoSeguinte(conta, data),
          );
          if (inseriu) {
            lancadas++;
            await this.avisarLancamento(conta.categoria, data);
          }
        }
      } catch {
        // Uma conta com problema tenta de novo na próxima abertura do app.
      }
    }
    return lancadas;
  }

  async reagendar(
    conta: ContaRecorrente,
    hoje: string,
    agora: Date = new Date(),
  ): Promise<void> {
    await this.cancelarLembretes(conta.id);
    if (!conta.ativa) {
      return;
    }
    const {id, descricao, proxima, lembrarDiasAntes} = conta;
    const valor = formatarCentavos(conta.valorCentavos);
    const prefixo = `${prefixoDaConta(id)}${proxima}`;
    if (lembrarDiasAntes > 0) {
      await this.agendar(
        `${prefixo}-antes`,
        dataDoLembrete(proxima, lembrarDiasAntes),
        `${descricao} vence em ${textoDias(lembrarDiasAntes)}`,
        `${valor} · dia ${formatarDiaCurto(proxima)}`,
        hoje,
        agora,
      );
    }
    await this.agendar(
      `${prefixo}-dia`,
      proxima,
      `${descricao} vence hoje`,
      `Lançamos ${valor} nas suas despesas.`,
      hoje,
      agora,
    );
  }

  async reagendarTodas(hoje: string, agora: Date = new Date()): Promise<void> {
    let contas: ContaRecorrente[];
    try {
      contas = await this.contas.listar();
    } catch {
      return;
    }
    for (const conta of contas) {
      await this.reagendar(conta, hoje, agora);
    }
  }

  async pedirPermissao(): Promise<boolean> {
    try {
      return await this.notificador.pedirPermissao();
    } catch {
      return false;
    }
  }

  // Fora do prefixo da conta: voltar ao app não pode cancelar o teste.
  async testarLembrete(
    conta: ContaRecorrente,
    agora: Date = new Date(),
  ): Promise<void> {
    await this.notificador.agendar(
      `teste-conta-${conta.id}`,
      new Date(agora.getTime() + SEGUNDOS_TESTE_LEMBRETE * 1000),
      `${conta.descricao} vence hoje`,
      `Lançamos ${formatarCentavos(conta.valorCentavos)} nas suas despesas.`,
    );
  }

  private async agendar(
    id: string,
    data: string,
    titulo: string,
    corpo: string,
    hoje: string,
    agora: Date,
  ): Promise<void> {
    const quando = momentoDoLembrete(data);
    if (data < hoje || quando <= agora) {
      return;
    }
    try {
      await this.notificador.agendar(id, quando, titulo, corpo);
    } catch {
      // O lembrete é só um aviso: a conta continua sendo lançada.
    }
  }

  private async cancelarLembretes(id: number): Promise<void> {
    try {
      await this.notificador.cancelarComPrefixo(prefixoDaConta(id));
    } catch {
      // Um lembrete que escapou não pode impedir pausar ou excluir a conta.
    }
  }

  private async avisarLancamento(
    categoria: string,
    data: string,
  ): Promise<void> {
    try {
      await this.aoLancarDespesa?.(categoria, data);
    } catch {
      // A despesa já foi lançada; o alerta de orçamento não pode desfazer isso.
    }
  }
}
