import 'react-native';
import React from 'react';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {PaperProvider} from 'react-native-paper';
import renderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import type {DadosTransacao, Transacao} from '../src/domain/entities/Transacao';
import type {TransacaoRepository} from '../src/domain/repositories/TransacaoRepository';
import HomeScreen from '../src/presentation/screens/HomeScreen';
import {darkTheme} from '../src/presentation/theme';

class RepositorioEmMemoria implements TransacaoRepository {
  transacoes: Transacao[] = [];
  private proximoId = 1;

  constructor(iniciais: Transacao[] = []) {
    this.transacoes = [...iniciais];
    this.proximoId = iniciais.length + 1;
  }

  listarRecentes = jest.fn(async (limite: number) =>
    [...this.transacoes]
      .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)
      .slice(0, limite),
  );

  criar = jest.fn(async (dados: DadosTransacao) => {
    const id = this.proximoId++;
    this.transacoes.push({...dados, id, sincronizado: false});
    return id;
  });

  atualizar = jest.fn(async (id: number, dados: DadosTransacao) => {
    this.transacoes = this.transacoes.map(t =>
      t.id === id ? {...dados, id, sincronizado: false} : t,
    );
  });

  excluir = jest.fn(async (id: number) => {
    this.transacoes = this.transacoes.filter(t => t.id !== id);
  });

  totalReceitasDoMes = jest.fn(async (anoMes: string) =>
    this.transacoes
      .filter(t => t.tipo === 'receita' && t.data.startsWith(anoMes))
      .reduce((soma, t) => soma + t.valorCentavos, 0),
  );
}

const despesa: Transacao = {
  id: 1,
  tipo: 'despesa',
  descricao: 'Mercado',
  valorCentavos: 8990,
  data: '2026-09-28',
  categoria: 'alimentacao',
  recorrencia: 'variavel',
  sincronizado: true,
};

let tree: ReactTestRenderer;

async function renderizar(repositorio: TransacaoRepository) {
  await act(async () => {
    tree = renderer.create(
      <PaperProvider theme={darkTheme}>
        <HomeScreen repositorio={repositorio} />
      </PaperProvider>,
    );
  });
}

const todosComId = (id: string) =>
  tree.root.findAll(no => no.props.testID === id);

const existe = (id: string) => todosComId(id).length > 0;

function porId(id: string): ReactTestInstance {
  const [no] = todosComId(id);
  if (!no) {
    throw new Error(`Elemento com testID "${id}" não encontrado`);
  }
  return no;
}

function textoDe(no: ReactTestInstance): string {
  return no.children
    .map(filho => (typeof filho === 'string' ? filho : textoDe(filho)))
    .join('');
}

async function tocar(id: string) {
  const [alvo] = tree.root.findAll(
    no => no.props.testID === id && typeof no.props.onPress === 'function',
  );
  if (!alvo) {
    throw new Error(`Nada tocável com testID "${id}"`);
  }
  await act(async () => {
    await alvo.props.onPress();
  });
}

async function digitar(...teclas: string[]) {
  for (const tecla of teclas) {
    await tocar(`tecla-${tecla}`);
  }
}

const botaoSalvar = () =>
  tree.root.findAll(
    no =>
      no.props.testID === 'botao-salvar' &&
      typeof no.props.onPress === 'function',
  )[0];

describe('NovoLancamentoSheet', () => {
  let repositorio: RepositorioEmMemoria;

  beforeEach(() => {
    jest.useFakeTimers();
    repositorio = new RepositorioEmMemoria();
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
      tree.unmount();
    });
    jest.useRealTimers();
  });

  it('abre pelo + já em Receita', async () => {
    await renderizar(repositorio);
    expect(existe('novo-lancamento-sheet')).toBe(false);

    await tocar('botao-novo-lancamento');

    expect(textoDe(porId('sheet-titulo'))).toBe('Novo Lançamento');
    expect(porId('tipo-receita').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(existe('recorrencia-fixa')).toBe(true);
    expect(textoDe(porId('valor-display'))).toBe('0,00');
  });

  it('deixa o botão como "Digite um valor" desabilitado até digitar', async () => {
    await renderizar(repositorio);
    await tocar('botao-novo-lancamento');

    expect(botaoSalvar().props.disabled).toBe(true);
    expect(textoDe(botaoSalvar())).toBe('Digite um valor');

    await digitar('5');
    expect(botaoSalvar().props.disabled).toBe(false);
    expect(textoDe(botaoSalvar())).toBe('Salvar Receita');

    await tocar('tipo-despesa');
    expect(textoDe(botaoSalvar())).toBe('Salvar Despesa');
    expect(existe('recorrencia-fixa')).toBe(false);

    await digitar('⌫');
    expect(botaoSalvar().props.disabled).toBe(true);
  });

  it('salva uma receita fixa de salário', async () => {
    await renderizar(repositorio);
    await tocar('botao-novo-lancamento');

    await digitar('1', '2', '0', '0');
    expect(textoDe(porId('valor-display'))).toBe('1.200');
    await tocar('categoria-salario');
    await tocar('recorrencia-fixa');
    await tocar('botao-salvar');

    expect(repositorio.criar).toHaveBeenCalledTimes(1);
    expect(repositorio.criar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'receita',
        valorCentavos: 120000,
        categoria: 'salario',
        recorrencia: 'fixa',
        descricao: 'Salário',
      }),
    );
    expect(existe('novo-lancamento-sheet')).toBe(false);
    expect(textoDe(porId('home-snackbar'))).toContain('Receita salva');
    expect(existe('transacao-1')).toBe(true);
    expect(existe('selo-fixa')).toBe(true);
  });

  it('exige uma categoria antes de salvar', async () => {
    await renderizar(repositorio);
    await tocar('botao-novo-lancamento');

    await digitar('5');
    await tocar('botao-salvar');

    expect(repositorio.criar).not.toHaveBeenCalled();
    expect(
      tree.root.findAll(
        no =>
          typeof no.type === 'string' &&
          textoDe(no) === 'Escolha uma categoria.',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('mostra o erro do banco sem fechar o modal', async () => {
    repositorio.criar.mockRejectedValueOnce(new Error('disco cheio'));
    await renderizar(repositorio);
    await tocar('botao-novo-lancamento');

    await digitar('5');
    await tocar('categoria-freelance');
    await tocar('botao-salvar');

    expect(existe('novo-lancamento-sheet')).toBe(true);
    expect(textoDe(porId('sheet-snackbar'))).toContain('disco cheio');
  });

  it('no modo edição abre preenchido e chama atualizar()', async () => {
    repositorio = new RepositorioEmMemoria([despesa]);
    await renderizar(repositorio);

    await tocar('abrir-1');
    expect(textoDe(porId('sheet-titulo'))).toBe('Editar Lançamento');
    expect(textoDe(porId('valor-display'))).toBe('89,90');
    expect(porId('tipo-despesa').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(textoDe(botaoSalvar())).toBe('Salvar alterações');

    await digitar('⌫', '⌫', '5');
    await tocar('botao-salvar');

    expect(repositorio.atualizar).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        tipo: 'despesa',
        valorCentavos: 8950,
        categoria: 'alimentacao',
        descricao: 'Mercado',
        data: '2026-09-28',
      }),
    );
    expect(repositorio.criar).not.toHaveBeenCalled();
    expect(textoDe(porId('home-snackbar'))).toContain('Lançamento atualizado');
  });

  it('Excluir pede confirmação e chama excluir()', async () => {
    repositorio = new RepositorioEmMemoria([despesa]);
    await renderizar(repositorio);

    await tocar('abrir-1');
    await tocar('botao-excluir');
    expect(repositorio.excluir).not.toHaveBeenCalled();

    await tocar('confirmar-exclusao');

    expect(repositorio.excluir).toHaveBeenCalledWith(1);
    expect(existe('novo-lancamento-sheet')).toBe(false);
    expect(textoDe(porId('home-snackbar'))).toContain('Lançamento excluído');
    expect(existe('lista-vazia')).toBe(true);
  });

  it('o item da lista oferece Excluir para leitores de tela', async () => {
    repositorio = new RepositorioEmMemoria([despesa]);
    await renderizar(repositorio);

    const item = tree.root.findAll(
      no =>
        no.props.testID === 'abrir-1' &&
        typeof no.props.onAccessibilityAction === 'function',
    )[0];
    expect(item.props.accessibilityActions).toEqual(
      expect.arrayContaining([{name: 'excluir', label: 'Excluir'}]),
    );

    await act(async () => {
      item.props.onAccessibilityAction({nativeEvent: {actionName: 'excluir'}});
    });
    await tocar('confirmar-exclusao');

    expect(repositorio.excluir).toHaveBeenCalledWith(1);
  });
});
