import {beforeEach, describe, expect, it, jest} from '@jest/globals';

import {GerenciarCofres} from '../src/domain/casosDeUso/GerenciarCofres';
import {hojeISO} from '../src/domain/datas';
import type {
  Cofre,
  DadosCofre,
  DadosMovimento,
  MovimentoCofre,
} from '../src/domain/entities/Cofre';
import type {CofreRepository} from '../src/domain/repositories/CofreRepository';
import type {TransacaoRepository} from '../src/domain/repositories/TransacaoRepository';

class CofresFake implements CofreRepository {
  cofres: Omit<Cofre, 'saldoCentavos'>[] = [];
  movimentos: MovimentoCofre[] = [];
  private proximoId = 1;

  private saldoDe(cofreId: number): number {
    return this.movimentos
      .filter(m => m.cofreId === cofreId)
      .reduce(
        (soma, m) =>
          soma + (m.tipo === 'deposito' ? m.valorCentavos : -m.valorCentavos),
        0,
      );
  }

  listar = jest.fn(async () =>
    this.cofres.map(c => ({...c, saldoCentavos: this.saldoDe(c.id)})),
  );

  buscarPorId = jest.fn(async (id: number) => {
    const cofre = this.cofres.find(c => c.id === id);
    return cofre ? {...cofre, saldoCentavos: this.saldoDe(id)} : null;
  });

  criar = jest.fn(async (dados: DadosCofre) => {
    const id = this.proximoId++;
    this.cofres.push({...dados, id});
    return id;
  });

  atualizar = jest.fn(async (id: number, dados: DadosCofre) => {
    this.cofres = this.cofres.map(c => (c.id === id ? {...dados, id} : c));
  });

  excluir = jest.fn(async (id: number) => {
    this.cofres = this.cofres.filter(c => c.id !== id);
    this.movimentos = this.movimentos.filter(m => m.cofreId !== id);
  });

  registrarMovimento = jest.fn(async (movimento: DadosMovimento) => {
    const id = this.movimentos.length + 1;
    this.movimentos.push({...movimento, id});
    return id;
  });

  listarMovimentos = jest.fn(async (cofreId: number, limite: number) =>
    this.movimentos.filter(m => m.cofreId === cofreId).slice(0, limite),
  );

  totalGuardado = jest.fn(async () =>
    this.cofres.reduce((soma, c) => soma + this.saldoDe(c.id), 0),
  );
}

function transacoesFake(saldoCentavos: number): TransacaoRepository {
  return {
    listarRecentes: jest.fn(async () => []),
    buscarPorId: jest.fn(async () => null),
    criar: jest.fn(async () => 1),
    atualizar: jest.fn(async () => {}),
    excluir: jest.fn(async () => {}),
    saldoAte: jest.fn(async () => saldoCentavos),
    totaisPorMes: jest.fn(async () => []),
    buscarCandidatasDuplicata: jest.fn(async () => []),
  };
}

const viagem: DadosCofre = {
  nome: 'Viagem',
  icone: '✈️',
  cor: '#64B5F6',
  metaCentavos: 800000,
};

describe('GerenciarCofres', () => {
  let cofres: CofresFake;
  let transacoes: TransacaoRepository;
  let gerenciar: GerenciarCofres;
  let idViagem: number;

  beforeEach(async () => {
    cofres = new CofresFake();
    transacoes = transacoesFake(100000);
    gerenciar = new GerenciarCofres(cofres, transacoes);
    idViagem = await gerenciar.criar(viagem);
  });

  it('disponível = saldo de hoje - total guardado', async () => {
    await gerenciar.guardar(idViagem, 30000);

    await expect(gerenciar.disponivel()).resolves.toBe(70000);
    expect(transacoes.saldoAte).toHaveBeenCalledWith(hojeISO());
  });

  it('guardar dentro do disponível registra um depósito com a data de hoje', async () => {
    await gerenciar.guardar(idViagem, 100000);

    expect(cofres.registrarMovimento).toHaveBeenCalledWith({
      cofreId: idViagem,
      tipo: 'deposito',
      valorCentavos: 100000,
      data: hojeISO(),
    });
    await expect(gerenciar.disponivel()).resolves.toBe(0);
  });

  it('guardar mais que o disponível lança erro e não registra', async () => {
    await expect(gerenciar.guardar(idViagem, 100001)).rejects.toThrow(
      'Você tem só R$ 1.000,00 disponível.',
    );
    expect(cofres.registrarMovimento).not.toHaveBeenCalled();
  });

  it('retirar mais que o cofre tem lança erro e não registra', async () => {
    await gerenciar.guardar(idViagem, 20000);
    cofres.registrarMovimento.mockClear();

    await expect(gerenciar.retirar(idViagem, 20001)).rejects.toThrow(
      'Este cofre tem só R$ 200,00.',
    );
    expect(cofres.registrarMovimento).not.toHaveBeenCalled();
  });

  it('retirar devolve ao disponível', async () => {
    await gerenciar.guardar(idViagem, 50000);
    await gerenciar.retirar(idViagem, 20000);

    expect(cofres.registrarMovimento).toHaveBeenLastCalledWith(
      expect.objectContaining({tipo: 'retirada', valorCentavos: 20000}),
    );
    await expect(gerenciar.disponivel()).resolves.toBe(70000);
  });

  it('movimentar um cofre que não existe lança erro', async () => {
    await expect(gerenciar.guardar(99, 100)).rejects.toThrow(
      'Cofre não encontrado.',
    );
  });

  it('excluir o cofre devolve o dinheiro guardado ao disponível', async () => {
    await gerenciar.guardar(idViagem, 60000);
    await expect(gerenciar.disponivel()).resolves.toBe(40000);

    await gerenciar.excluir(idViagem);

    expect(cofres.excluir).toHaveBeenCalledWith(idViagem);
    await expect(gerenciar.disponivel()).resolves.toBe(100000);
  });

  it('criar com nome repetido lança a primeira mensagem de erro', async () => {
    await expect(
      gerenciar.criar({...viagem, nome: '  VIAGEM '}),
    ).rejects.toThrow('Já existe um cofre com esse nome.');
    expect(cofres.criar).toHaveBeenCalledTimes(1);
  });

  it('criar salva o nome sem espaços nas pontas', async () => {
    await gerenciar.criar({...viagem, nome: '  Carro  '});
    expect(cofres.criar).toHaveBeenLastCalledWith({...viagem, nome: 'Carro'});
  });

  it('editar mantendo o próprio nome passa', async () => {
    await gerenciar.atualizar(idViagem, {...viagem, metaCentavos: null});
    expect(cofres.atualizar).toHaveBeenCalledWith(idViagem, {
      ...viagem,
      metaCentavos: null,
    });
  });

  it('editar com o nome de outro cofre lança erro', async () => {
    const idCarro = await gerenciar.criar({...viagem, nome: 'Carro'});
    await expect(gerenciar.atualizar(idCarro, viagem)).rejects.toThrow(
      'Já existe um cofre com esse nome.',
    );
    expect(cofres.atualizar).not.toHaveBeenCalled();
  });
});
