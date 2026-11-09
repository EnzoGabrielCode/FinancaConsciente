import React from 'react';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import renderer, {act, type ReactTestRenderer} from 'react-test-renderer';

import type {DadosTransacao} from '../src/domain/entities/Transacao';
import type {ArmazenamentoComprovantes} from '../src/domain/repositories/ArmazenamentoComprovantes';
import type {TransacaoRepository} from '../src/domain/repositories/TransacaoRepository';
import {
  useTransacoes,
  type UseTransacoes,
} from '../src/presentation/hooks/useTransacoes';

const despesa: DadosTransacao = {
  tipo: 'despesa',
  valorCentavos: 1000,
  categoria: 'lazer',
  descricao: 'Cinema',
  data: '2026-11-06',
  recorrencia: 'variavel',
  comprovanteUri: null,
  contaRecorrenteId: null,
  idExterno: null,
};

const receita: DadosTransacao = {
  ...despesa,
  tipo: 'receita',
  categoria: 'salario',
  descricao: 'Salário',
};

const armazenamento: ArmazenamentoComprovantes = {
  guardar: async uri => uri,
  apagar: async () => {},
  ehDefinitivo: () => true,
};

describe('useTransacoes: aoSalvarDespesa', () => {
  let hook: UseTransacoes;
  let tree: ReactTestRenderer;
  let aoSalvarDespesa: jest.Mock<
    (categoria: string, data: string) => Promise<void>
  >;
  let repositorio: TransacaoRepository;

  function Sonda(): null {
    hook = useTransacoes(
      repositorio,
      armazenamento,
      undefined,
      aoSalvarDespesa,
    );
    return null;
  }

  beforeEach(async () => {
    aoSalvarDespesa = jest.fn(async () => {});
    repositorio = {
      listarRecentes: async () => [],
      buscarPorId: async () => ({...despesa, id: 1, sincronizado: false}),
      criar: async () => 1,
      atualizar: async () => {},
      saldoAte: async () => 0,
      totaisPorMes: async () => [],
    } as unknown as TransacaoRepository;
    await act(async () => {
      tree = renderer.create(<Sonda />);
    });
  });

  afterEach(async () => {
    await act(async () => {
      tree.unmount();
    });
  });

  it('é chamado ao criar uma despesa', async () => {
    await act(async () => {
      await hook.criar(despesa);
    });
    expect(aoSalvarDespesa).toHaveBeenCalledTimes(1);
    expect(aoSalvarDespesa).toHaveBeenCalledWith('lazer', '2026-11-06');
  });

  it('é chamado ao atualizar uma despesa', async () => {
    await act(async () => {
      await hook.atualizar(1, despesa);
    });
    expect(aoSalvarDespesa).toHaveBeenCalledWith('lazer', '2026-11-06');
  });

  it('não é chamado para receita', async () => {
    await act(async () => {
      await hook.criar(receita);
      await hook.atualizar(1, receita);
    });
    expect(aoSalvarDespesa).not.toHaveBeenCalled();
  });

  it('não é chamado se o lançamento falhar', async () => {
    repositorio.criar = async () => {
      throw new Error('banco fechado');
    };
    await act(async () => {
      await expect(hook.criar(despesa)).rejects.toThrow('banco fechado');
    });
    expect(aoSalvarDespesa).not.toHaveBeenCalled();
  });

  it('não espera o aviso terminar', async () => {
    aoSalvarDespesa.mockImplementation(() => new Promise(() => {}));
    await act(async () => {
      await expect(hook.criar(despesa)).resolves.toBeUndefined();
    });
    expect(aoSalvarDespesa).toHaveBeenCalledTimes(1);
  });

  it('ignora erro do aviso, assíncrono ou síncrono', async () => {
    aoSalvarDespesa.mockRejectedValueOnce(new Error('falhou'));
    aoSalvarDespesa.mockImplementationOnce(() => {
      throw new Error('falhou');
    });
    await act(async () => {
      await expect(hook.criar(despesa)).resolves.toBeUndefined();
      await expect(hook.criar(despesa)).resolves.toBeUndefined();
    });
    expect(aoSalvarDespesa).toHaveBeenCalledTimes(2);
  });
});
