import React from 'react';
import {afterEach, describe, expect, it, jest} from '@jest/globals';
import renderer, {act, type ReactTestRenderer} from 'react-test-renderer';

import type {Transacao} from '../src/domain/entities/Transacao';
import type {TransacaoRepository} from '../src/domain/repositories/TransacaoRepository';
import {
  useTodasTransacoes,
  type UseTodasTransacoes,
} from '../src/presentation/hooks/useTodasTransacoes';

const criarTransacoes = (quantidade: number): Transacao[] =>
  Array.from({length: quantidade}, (_, i) => ({
    id: quantidade - i,
    tipo: 'despesa',
    descricao: `Lançamento ${quantidade - i}`,
    valorCentavos: 1000,
    data: '2026-10-01',
    categoria: 'outros',
    recorrencia: 'variavel',
    comprovanteUri: null,
    contaRecorrenteId: null,
    idExterno: null,
    sincronizado: false,
  }));

function criarRepositorio(quantidade: number) {
  const lista = criarTransacoes(quantidade);
  const listarPagina = jest.fn(async (limite: number, deslocamento: number) =>
    lista.slice(deslocamento, deslocamento + limite),
  );
  const repositorio = {listarPagina} as unknown as TransacaoRepository;
  return {lista, listarPagina, repositorio};
}

let hook: UseTodasTransacoes;
let tree: ReactTestRenderer;

function Sonda({
  repositorio,
  ativo,
}: {
  repositorio: TransacaoRepository;
  ativo?: boolean;
}): null {
  hook = useTodasTransacoes(repositorio, ativo);
  return null;
}

async function montar(repositorio: TransacaoRepository, ativo?: boolean) {
  await act(async () => {
    tree = renderer.create(<Sonda repositorio={repositorio} ativo={ativo} />);
  });
}

function adiada<T>() {
  let resolver!: (valor: T) => void;
  const promessa = new Promise<T>(resolve => {
    resolver = resolve;
  });
  return {promessa, resolver};
}

describe('useTodasTransacoes', () => {
  afterEach(async () => {
    await act(async () => {
      tree.unmount();
    });
  });

  it('pagina de 30 em 30 até o fim e recarregar volta à primeira página', async () => {
    const {repositorio, listarPagina} = criarRepositorio(65);
    await montar(repositorio);
    expect(hook.transacoes).toHaveLength(30);
    expect(hook.carregando).toBe(false);
    expect(hook.fim).toBe(false);

    await act(async () => {
      await hook.carregarMais();
    });
    expect(hook.transacoes).toHaveLength(60);
    expect(hook.fim).toBe(false);

    await act(async () => {
      await hook.carregarMais();
    });
    expect(hook.transacoes).toHaveLength(65);
    expect(hook.fim).toBe(true);
    expect(listarPagina).toHaveBeenCalledTimes(3);
    expect(listarPagina).toHaveBeenLastCalledWith(30, 60);

    await act(async () => {
      await hook.carregarMais();
    });
    expect(hook.transacoes).toHaveLength(65);
    expect(listarPagina).toHaveBeenCalledTimes(3);

    await act(async () => {
      await hook.recarregar();
    });
    expect(hook.transacoes).toHaveLength(30);
    expect(hook.fim).toBe(false);
    expect(listarPagina).toHaveBeenLastCalledWith(30, 0);
  });

  it('marca o fim já na primeira página quando vêm menos de 30', async () => {
    const {repositorio} = criarRepositorio(3);
    await montar(repositorio);
    expect(hook.transacoes).toHaveLength(3);
    expect(hook.fim).toBe(true);
  });

  it('não duplica itens com duas chamadas seguidas de carregarMais', async () => {
    const {repositorio, listarPagina} = criarRepositorio(65);
    await montar(repositorio);

    await act(async () => {
      await Promise.all([hook.carregarMais(), hook.carregarMais()]);
    });

    expect(listarPagina).toHaveBeenCalledTimes(2);
    expect(hook.transacoes).toHaveLength(60);
    expect(new Set(hook.transacoes.map(t => t.id)).size).toBe(60);
  });

  it('não repete um item empurrado para a página seguinte', async () => {
    const {lista, repositorio, listarPagina} = criarRepositorio(65);
    await montar(repositorio);
    listarPagina.mockImplementationOnce(async () => lista.slice(29, 59));

    await act(async () => {
      await hook.carregarMais();
    });

    expect(hook.transacoes).toHaveLength(59);
    expect(new Set(hook.transacoes.map(t => t.id)).size).toBe(59);
  });

  it('ignora carregarMais enquanto a primeira página carrega', async () => {
    const {repositorio, listarPagina} = criarRepositorio(65);
    const primeira = adiada<Transacao[]>();
    listarPagina.mockImplementationOnce(() => primeira.promessa);
    await montar(repositorio);

    await act(async () => {
      await hook.carregarMais();
    });
    expect(listarPagina).toHaveBeenCalledTimes(1);

    await act(async () => {
      primeira.resolver([]);
    });
  });

  it('descarta a página em andamento quando recarregar é chamado', async () => {
    const {lista, repositorio, listarPagina} = criarRepositorio(65);
    await montar(repositorio);
    const atrasada = adiada<Transacao[]>();
    listarPagina.mockImplementationOnce(() => atrasada.promessa);

    await act(async () => {
      hook.carregarMais();
      await hook.recarregar();
    });
    await act(async () => {
      atrasada.resolver(lista.slice(30, 60));
    });

    expect(hook.transacoes).toHaveLength(30);
    expect(hook.carregandoMais).toBe(false);

    await act(async () => {
      await hook.carregarMais();
    });
    expect(listarPagina).toHaveBeenLastCalledWith(30, 30);
    expect(hook.transacoes).toHaveLength(60);
  });

  it('mantém os itens e permite repetir quando carregarMais falha', async () => {
    const {repositorio, listarPagina} = criarRepositorio(65);
    await montar(repositorio);
    listarPagina.mockImplementationOnce(async () => {
      throw new Error('falhou');
    });

    await act(async () => {
      await hook.carregarMais();
    });
    expect(hook.erro).toBe('falhou');
    expect(hook.transacoes).toHaveLength(30);
    expect(hook.carregandoMais).toBe(false);

    await act(async () => {
      await hook.carregarMais();
    });
    expect(hook.erro).toBeNull();
    expect(hook.transacoes).toHaveLength(60);
  });

  it('descarta a lista quando recarregar falha', async () => {
    const {repositorio, listarPagina} = criarRepositorio(65);
    await montar(repositorio);
    listarPagina.mockImplementationOnce(async () => {
      throw new Error('falhou');
    });

    await act(async () => {
      await hook.recarregar();
    });

    expect(hook.erro).toBe('falhou');
    expect(hook.transacoes).toEqual([]);
    expect(hook.carregando).toBe(false);
  });

  it('só consulta quando ativo e recarrega a cada ativação', async () => {
    const {repositorio, listarPagina} = criarRepositorio(65);
    await montar(repositorio, false);
    expect(listarPagina).not.toHaveBeenCalled();

    await act(async () => {
      tree.update(<Sonda repositorio={repositorio} ativo />);
    });
    expect(listarPagina).toHaveBeenCalledTimes(1);

    await act(async () => {
      tree.update(<Sonda repositorio={repositorio} ativo={false} />);
    });
    await act(async () => {
      tree.update(<Sonda repositorio={repositorio} ativo />);
    });
    expect(listarPagina).toHaveBeenCalledTimes(2);
  });
});
