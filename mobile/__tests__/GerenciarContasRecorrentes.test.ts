import {beforeEach, describe, expect, it, jest} from '@jest/globals';

import {GerenciarContasRecorrentes} from '../src/domain/casosDeUso/GerenciarContasRecorrentes';
import type {
  ContaRecorrente,
  DadosContaRecorrente,
} from '../src/domain/entities/ContaRecorrente';
import type {DadosTransacao} from '../src/domain/entities/Transacao';
import type {ContaRecorrenteRepository} from '../src/domain/repositories/ContaRecorrenteRepository';
import type {Notificador} from '../src/domain/repositories/Notificador';
import type {TransacaoRepository} from '../src/domain/repositories/TransacaoRepository';

const dados: DadosContaRecorrente = {
  descricao: 'Internet',
  valorCentavos: 9990,
  categoria: 'outros',
  frequencia: 'mensal',
  dia: 10,
  mes: null,
  lembrarDiasAntes: 2,
  ativa: true,
};

class ContasEmMemoria implements ContaRecorrenteRepository {
  contas: ContaRecorrente[] = [];
  private proximoId = 1;

  listar = jest.fn(async () => this.contas.map(c => ({...c})));

  buscarPorId = jest.fn(async (id: number) => {
    const conta = this.contas.find(c => c.id === id);
    return conta ? {...conta} : null;
  });

  criar = jest.fn(async (novos: DadosContaRecorrente, proxima: string) => {
    const id = this.proximoId++;
    this.contas.push({...novos, id, proxima});
    return id;
  });

  atualizar = jest.fn(
    async (id: number, novos: DadosContaRecorrente, proxima: string) => {
      this.contas = this.contas.map(c =>
        c.id === id ? {...novos, id, proxima} : c,
      );
    },
  );

  excluir = jest.fn(async (id: number) => {
    this.contas = this.contas.filter(c => c.id !== id);
  });

  definirAtiva = jest.fn(async (id: number, ativa: boolean) => {
    this.contas = this.contas.map(c => (c.id === id ? {...c, ativa} : c));
  });

  avancarProxima = jest.fn(async (id: number, proxima: string) => {
    this.contas = this.contas.map(c => (c.id === id ? {...c, proxima} : c));
  });
}

describe('GerenciarContasRecorrentes', () => {
  let contas: ContasEmMemoria;
  let lancadas: DadosTransacao[];
  let lancarRecorrente: jest.Mock<TransacaoRepository['lancarRecorrente']>;
  let agendar: jest.Mock<Notificador['agendar']>;
  let cancelarComPrefixo: jest.Mock<Notificador['cancelarComPrefixo']>;
  let aoLancarDespesa: jest.Mock<
    (categoria: string, data: string) => Promise<void>
  >;
  let gerenciar: GerenciarContasRecorrentes;

  const conta = async (
    alteracao: Partial<DadosContaRecorrente> = {},
    proxima = '2026-12-10',
  ) => contas.criar({...dados, ...alteracao}, proxima);

  beforeEach(() => {
    contas = new ContasEmMemoria();
    lancadas = [];
    // Como o índice único: a mesma conta na mesma data não entra duas vezes.
    lancarRecorrente = jest.fn<TransacaoRepository['lancarRecorrente']>(
      async novos => {
        const repetida = lancadas.some(
          t =>
            t.contaRecorrenteId === novos.contaRecorrenteId &&
            t.data === novos.data,
        );
        if (!repetida) {
          lancadas.push(novos);
        }
        return !repetida;
      },
    );
    agendar = jest.fn<Notificador['agendar']>(async () => {});
    cancelarComPrefixo = jest.fn<Notificador['cancelarComPrefixo']>(
      async () => {},
    );
    aoLancarDespesa = jest.fn(async () => {});
    gerenciar = new GerenciarContasRecorrentes(
      contas,
      {lancarRecorrente} as unknown as TransacaoRepository,
      {
        agendar,
        cancelarComPrefixo,
        notificar: async () => {},
        pedirPermissao: async () => true,
      },
      aoLancarDespesa,
    );
  });

  describe('carregar', () => {
    it('ordena por proxima e calcula o total mensal', async () => {
      await conta({valorCentavos: 1000}, '2026-12-20');
      await conta({valorCentavos: 2000}, '2026-12-05');
      await conta({valorCentavos: 4000, ativa: false}, '2026-12-01');

      const painel = await gerenciar.carregar('2026-11-07');

      expect(painel.contas.map(c => c.proxima)).toEqual([
        '2026-12-01',
        '2026-12-05',
        '2026-12-20',
      ]);
      expect(painel.totalMensal).toBe(3000);
    });
  });

  describe('lancarVencidas', () => {
    it('lança com a data do vencimento e avança proxima', async () => {
      await conta({}, '2026-11-05');

      await expect(gerenciar.lancarVencidas('2026-11-07')).resolves.toBe(1);

      expect(lancarRecorrente).toHaveBeenCalledWith({
        tipo: 'despesa',
        descricao: 'Internet',
        valorCentavos: 9990,
        data: '2026-11-05',
        categoria: 'outros',
        recorrencia: 'fixa',
        comprovanteUri: null,
        contaRecorrenteId: 1,
      });
      expect(contas.contas[0].proxima).toBe('2026-12-10');
    });

    it('lança todos os meses atrasados', async () => {
      await conta({}, '2026-09-10');

      await expect(gerenciar.lancarVencidas('2026-11-20')).resolves.toBe(3);

      expect(lancadas.map(t => t.data)).toEqual([
        '2026-09-10',
        '2026-10-10',
        '2026-11-10',
      ]);
      expect(contas.contas[0].proxima).toBe('2026-12-10');
    });

    it('com mais de 12 atrasados termina na abertura seguinte', async () => {
      await conta({}, '2025-04-10');

      await expect(gerenciar.lancarVencidas('2026-11-20')).resolves.toBe(12);
      await expect(gerenciar.lancarVencidas('2026-11-20')).resolves.toBe(8);

      expect(contas.contas[0].proxima).toBe('2026-12-10');
    });

    it('chamar duas vezes não duplica', async () => {
      await conta({}, '2026-11-05');

      await gerenciar.lancarVencidas('2026-11-07');
      await expect(gerenciar.lancarVencidas('2026-11-07')).resolves.toBe(0);

      expect(lancadas).toHaveLength(1);
    });

    it('avança sem contar quando o vencimento já existia', async () => {
      await conta({}, '2026-11-05');
      lancarRecorrente.mockResolvedValueOnce(false);

      await expect(gerenciar.lancarVencidas('2026-11-07')).resolves.toBe(0);

      expect(contas.contas[0].proxima).toBe('2026-12-10');
      expect(aoLancarDespesa).not.toHaveBeenCalled();
    });

    it('conta pausada não lança', async () => {
      await conta({ativa: false}, '2026-11-05');

      await expect(gerenciar.lancarVencidas('2026-11-07')).resolves.toBe(0);

      expect(lancarRecorrente).not.toHaveBeenCalled();
      expect(contas.contas[0].proxima).toBe('2026-11-05');
    });

    it('não lança antes do vencimento', async () => {
      await conta({}, '2026-11-08');
      await expect(gerenciar.lancarVencidas('2026-11-07')).resolves.toBe(0);
    });

    it('erro em uma conta não impede a outra', async () => {
      await conta({descricao: 'Quebrada'}, '2026-11-05');
      await conta({descricao: 'Boa'}, '2026-11-05');
      lancarRecorrente.mockRejectedValueOnce(new Error('falhou'));

      await expect(gerenciar.lancarVencidas('2026-11-07')).resolves.toBe(1);

      expect(lancadas.map(t => t.descricao)).toEqual(['Boa']);
      expect(contas.contas[0].proxima).toBe('2026-11-05');
    });

    it('chama aoLancarDespesa com a categoria e a data', async () => {
      await conta({categoria: 'lazer'}, '2026-11-05');

      await gerenciar.lancarVencidas('2026-11-07');

      expect(aoLancarDespesa).toHaveBeenCalledTimes(1);
      expect(aoLancarDespesa).toHaveBeenCalledWith('lazer', '2026-11-05');
    });

    it('erro em aoLancarDespesa não atrapalha os próximos vencimentos', async () => {
      await conta({}, '2026-10-10');
      aoLancarDespesa.mockRejectedValue(new Error('falhou'));

      await expect(gerenciar.lancarVencidas('2026-11-20')).resolves.toBe(2);

      expect(contas.contas[0].proxima).toBe('2026-12-10');
    });
  });

  describe('reagendar', () => {
    const agora = new Date(2026, 10, 7, 12);

    it('cancela os antigos e agenda "antes" e "dia" às 9h', async () => {
      await conta();
      const [salva] = contas.contas;

      await gerenciar.reagendar(salva, '2026-11-07', agora);

      expect(cancelarComPrefixo).toHaveBeenCalledWith('conta-1-');
      expect(cancelarComPrefixo.mock.invocationCallOrder[0]).toBeLessThan(
        agendar.mock.invocationCallOrder[0],
      );
      expect(agendar.mock.calls).toEqual([
        [
          'conta-1-2026-12-10-antes',
          new Date(2026, 11, 8, 9),
          'Internet vence em 2 dias',
          'R$ 99,90 · dia 10 de dez.',
        ],
        [
          'conta-1-2026-12-10-dia',
          new Date(2026, 11, 10, 9),
          'Internet vence hoje',
          'Lançamos R$ 99,90 nas suas despesas.',
        ],
      ]);
    });

    it('com lembrete "no dia" agenda só o do dia', async () => {
      await conta({lembrarDiasAntes: 0});

      await gerenciar.reagendar(contas.contas[0], '2026-11-07', agora);

      expect(agendar).toHaveBeenCalledTimes(1);
      expect(agendar.mock.calls[0][0]).toBe('conta-1-2026-12-10-dia');
    });

    it('usa o singular com 1 dia', async () => {
      await conta({lembrarDiasAntes: 1});

      await gerenciar.reagendar(contas.contas[0], '2026-11-07', agora);

      expect(agendar.mock.calls[0][2]).toBe('Internet vence em 1 dia');
    });

    it('não agenda horário que já passou', async () => {
      await conta({}, '2026-11-08');

      await gerenciar.reagendar(contas.contas[0], '2026-11-07', agora);

      expect(agendar).toHaveBeenCalledTimes(1);
      expect(agendar.mock.calls[0][0]).toBe('conta-1-2026-11-08-dia');
    });

    it('hoje depois das 9h não agenda, antes das 9h agenda', async () => {
      await conta({lembrarDiasAntes: 0}, '2026-11-07');

      await gerenciar.reagendar(contas.contas[0], '2026-11-07', agora);
      expect(agendar).not.toHaveBeenCalled();

      await gerenciar.reagendar(
        contas.contas[0],
        '2026-11-07',
        new Date(2026, 10, 7, 8),
      );
      expect(agendar).toHaveBeenCalledTimes(1);
    });

    it('conta pausada só cancela', async () => {
      await conta({ativa: false});

      await gerenciar.reagendar(contas.contas[0], '2026-11-07', agora);

      expect(cancelarComPrefixo).toHaveBeenCalledWith('conta-1-');
      expect(agendar).not.toHaveBeenCalled();
    });

    it('erros de notificação não propagam', async () => {
      await conta();
      cancelarComPrefixo.mockRejectedValue(new Error('falhou'));
      agendar.mockRejectedValue(new Error('falhou'));

      await expect(
        gerenciar.reagendar(contas.contas[0], '2026-11-07', agora),
      ).resolves.toBeUndefined();

      expect(agendar).toHaveBeenCalledTimes(2);
    });

    it('reagendarTodas passa por todas as contas', async () => {
      await conta();
      await conta({ativa: false});
      await conta({lembrarDiasAntes: 0});

      await gerenciar.reagendarTodas('2026-11-07', agora);

      expect(cancelarComPrefixo).toHaveBeenCalledTimes(3);
      expect(agendar).toHaveBeenCalledTimes(3);
    });

    it('reagendarTodas não propaga erro do banco', async () => {
      contas.listar.mockRejectedValueOnce(new Error('falhou'));
      await expect(
        gerenciar.reagendarTodas('2026-11-07', agora),
      ).resolves.toBeUndefined();
    });
  });

  describe('salvar', () => {
    it('cria com o primeiro vencimento e agenda os lembretes', async () => {
      await gerenciar.salvar(dados, undefined, '2026-11-07');

      expect(contas.contas[0].proxima).toBe('2026-11-10');
      expect(cancelarComPrefixo).toHaveBeenCalledWith('conta-1-');
    });

    it('recusa dados inválidos sem gravar', async () => {
      await expect(
        gerenciar.salvar({...dados, descricao: ' '}, undefined, '2026-11-07'),
      ).rejects.toThrow('Dê um nome');
      expect(contas.criar).not.toHaveBeenCalled();
    });

    it('conta que vence hoje já é lançada e fica para o mês seguinte', async () => {
      await expect(
        gerenciar.salvar({...dados, dia: 7}, undefined, '2026-11-07'),
      ).resolves.toBe(1);

      expect(lancadas[0].data).toBe('2026-11-07');
      expect(contas.contas[0].proxima).toBe('2026-12-07');
    });

    it('na edição mantém proxima se a agenda não mudou', async () => {
      await conta({}, '2026-12-10');

      await gerenciar.salvar(
        {...dados, descricao: 'Fibra', valorCentavos: 12000},
        1,
        '2026-11-07',
      );

      expect(contas.contas[0]).toMatchObject({
        descricao: 'Fibra',
        valorCentavos: 12000,
        proxima: '2026-12-10',
      });
    });

    it.each([
      ['o dia', {dia: 20}, '2026-11-20'],
      ['a frequência', {frequencia: 'anual' as const, mes: 3}, '2027-03-10'],
    ])('na edição recalcula se mudou %s', async (_, alteracao, proxima) => {
      await conta({}, '2026-12-10');

      await gerenciar.salvar({...dados, ...alteracao}, 1, '2026-11-07');

      expect(contas.contas[0].proxima).toBe(proxima);
    });

    it('recalcula se mudou o mês da conta anual', async () => {
      await conta({frequencia: 'anual', mes: 3}, '2027-03-10');

      await gerenciar.salvar(
        {...dados, frequencia: 'anual', mes: 12},
        1,
        '2026-11-07',
      );

      expect(contas.contas[0].proxima).toBe('2026-12-10');
    });

    it('editar uma conta pausada não agenda nem lança', async () => {
      await conta({ativa: false}, '2026-11-05');

      await gerenciar.salvar(
        {...dados, ativa: false, descricao: 'Fibra'},
        1,
        '2026-11-07',
      );

      expect(lancarRecorrente).not.toHaveBeenCalled();
      expect(agendar).not.toHaveBeenCalled();
    });

    it('recusa editar uma conta que não existe', async () => {
      await expect(gerenciar.salvar(dados, 9, '2026-11-07')).rejects.toThrow(
        'Conta não encontrada',
      );
    });
  });

  describe('excluir, pausar e retomar', () => {
    it('excluir cancela os lembretes e apaga', async () => {
      await conta();

      await gerenciar.excluir(1);

      expect(cancelarComPrefixo).toHaveBeenCalledWith('conta-1-');
      expect(contas.contas).toEqual([]);
    });

    it('excluir funciona mesmo se cancelar falhar', async () => {
      await conta();
      cancelarComPrefixo.mockRejectedValue(new Error('falhou'));

      await gerenciar.excluir(1);

      expect(contas.contas).toEqual([]);
    });

    it('pausar desativa e cancela os lembretes', async () => {
      await conta();

      await gerenciar.pausar(1);

      expect(contas.contas[0].ativa).toBe(false);
      expect(cancelarComPrefixo).toHaveBeenCalledWith('conta-1-');
    });

    it('retomar não lança o período pausado e reagenda', async () => {
      await conta({ativa: false}, '2026-08-10');

      await gerenciar.retomar(1, '2026-11-07');
      await expect(gerenciar.lancarVencidas('2026-11-07')).resolves.toBe(0);

      expect(contas.contas[0]).toMatchObject({
        ativa: true,
        proxima: '2026-11-10',
      });
      expect(lancarRecorrente).not.toHaveBeenCalled();
      expect(agendar.mock.calls.at(-1)?.[0]).toBe('conta-1-2026-11-10-dia');
    });

    it('retomar grava a data nova antes de ativar', async () => {
      await conta({ativa: false}, '2026-08-10');

      await gerenciar.retomar(1, '2026-11-07');

      expect(contas.avancarProxima.mock.invocationCallOrder[0]).toBeLessThan(
        contas.definirAtiva.mock.invocationCallOrder[0],
      );
    });
  });

  it('testarLembrete agenda para daqui a 10 segundos', async () => {
    await conta();
    const agora = new Date(2026, 10, 7, 12);

    await gerenciar.testarLembrete(contas.contas[0], agora);

    expect(agendar).toHaveBeenCalledWith(
      'teste-conta-1',
      new Date(2026, 10, 7, 12, 0, 10),
      'Internet vence hoje',
      'Lançamos R$ 99,90 nas suas despesas.',
    );
  });
});
