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
import type {ArmazenamentoComprovantes} from '../src/domain/repositories/ArmazenamentoComprovantes';
import type {TransacaoRepository} from '../src/domain/repositories/TransacaoRepository';
import HomeScreen from '../src/presentation/screens/HomeScreen';
import type {
  ImagemSelecionada,
  SeletorImagem,
} from '../src/presentation/servicos/seletorImagem';
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

  buscarPorId = jest.fn(
    async (id: number) => this.transacoes.find(t => t.id === id) ?? null,
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

const PASTA = 'file:///docs/comprovantes/';

class ArmazenamentoFake implements ArmazenamentoComprovantes {
  guardar = jest.fn(
    async (uri: string) => `${PASTA}${uri.split('/').pop() ?? 'foto.jpg'}`,
  );

  apagar = jest.fn(async (_uri: string) => {});

  ehDefinitivo = (uri: string) => uri.startsWith(PASTA);
}

const FOTO: ImagemSelecionada = {
  uri: 'file:///cache/foto.jpg',
  tipoMime: 'image/jpeg',
  tamanhoBytes: 300_000,
};

function criarSeletorFake(imagem: ImagemSelecionada | null = FOTO) {
  return {
    tirarFoto: jest.fn<SeletorImagem['tirarFoto']>(async () => imagem),
    escolherDaGaleria: jest.fn<SeletorImagem['escolherDaGaleria']>(
      async () => imagem,
    ),
  };
}

const despesa: Transacao = {
  id: 1,
  tipo: 'despesa',
  descricao: 'Mercado',
  valorCentavos: 8990,
  data: '2026-09-28',
  categoria: 'alimentacao',
  recorrencia: 'variavel',
  comprovanteUri: null,
  sincronizado: true,
};

let tree: ReactTestRenderer;

let armazenamento: ArmazenamentoFake;
let seletor: ReturnType<typeof criarSeletorFake>;

async function renderizar(repositorio: TransacaoRepository) {
  await act(async () => {
    tree = renderer.create(
      <PaperProvider theme={darkTheme}>
        <HomeScreen
          repositorio={repositorio}
          armazenamento={armazenamento}
          seletorImagem={seletor}
        />
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
    armazenamento = new ArmazenamentoFake();
    seletor = criarSeletorFake();
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
      tree.unmount();
    });
    jest.useRealTimers();
  });

  it('abre pelo + já em Despesa', async () => {
    await renderizar(repositorio);
    expect(existe('novo-lancamento-sheet')).toBe(false);

    await tocar('botao-novo-lancamento');

    expect(textoDe(porId('sheet-titulo'))).toBe('Novo Lançamento');
    expect(porId('tipo-despesa').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(existe('recorrencia-fixa')).toBe(false);
    expect(textoDe(porId('valor-display'))).toBe('0,00');
  });

  it('deixa o botão como "Digite um valor" desabilitado até digitar', async () => {
    await renderizar(repositorio);
    await tocar('botao-novo-lancamento');

    expect(botaoSalvar().props.disabled).toBe(true);
    expect(textoDe(botaoSalvar())).toBe('Digite um valor');

    await digitar('5');
    expect(botaoSalvar().props.disabled).toBe(false);
    expect(textoDe(botaoSalvar())).toBe('Salvar Despesa');

    await tocar('tipo-receita');
    expect(textoDe(botaoSalvar())).toBe('Salvar Receita');
    expect(existe('recorrencia-fixa')).toBe(true);

    await digitar('⌫');
    expect(botaoSalvar().props.disabled).toBe(true);
  });

  it('salva uma receita fixa de salário', async () => {
    await renderizar(repositorio);
    await tocar('botao-novo-lancamento');
    await tocar('tipo-receita');

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
        comprovanteUri: null,
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
    await tocar('categoria-alimentacao');
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

  describe('comprovante (US 1.2)', () => {
    const anexarFoto = async () => {
      await tocar('botao-camera');
      await tocar('menu-tirar-foto');
    };

    it('o botão de câmera só aparece em Despesa', async () => {
      await renderizar(repositorio);
      await tocar('botao-novo-lancamento');

      expect(porId('botao-camera').props.accessibilityLabel).toBe(
        'Anexar comprovante',
      );

      await tocar('tipo-receita');
      expect(existe('botao-camera')).toBe(false);

      await tocar('tipo-despesa');
      expect(existe('botao-camera')).toBe(true);
    });

    it('"Tirar foto" mostra a miniatura e salvar envia o comprovanteUri', async () => {
      await renderizar(repositorio);
      await tocar('botao-novo-lancamento');

      await anexarFoto();

      expect(seletor.tirarFoto).toHaveBeenCalledTimes(1);
      expect(porId('comprovante-imagem').props.source).toEqual({
        uri: FOTO.uri,
      });

      await digitar('4', '5');
      await tocar('categoria-alimentacao');
      await tocar('botao-salvar');

      expect(armazenamento.guardar).toHaveBeenCalledWith(FOTO.uri);
      expect(repositorio.criar).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: 'despesa',
          valorCentavos: 4500,
          comprovanteUri: `${PASTA}foto.jpg`,
        }),
      );
      expect(textoDe(porId('home-snackbar'))).toContain('Despesa salva');
      expect(porId('icone-comprovante').props.accessibilityLabel).toBe(
        'Tem comprovante',
      );
    });

    it('"Escolher da galeria" usa a galeria', async () => {
      await renderizar(repositorio);
      await tocar('botao-novo-lancamento');

      await tocar('botao-camera');
      await tocar('menu-galeria');

      expect(seletor.escolherDaGaleria).toHaveBeenCalledTimes(1);
      expect(existe('comprovante-miniatura')).toBe(true);
    });

    it('imagem GIF mostra o erro e não anexa', async () => {
      seletor = criarSeletorFake({
        uri: 'file:///cache/anim.gif',
        tipoMime: 'image/gif',
        tamanhoBytes: 1000,
      });
      await renderizar(repositorio);
      await tocar('botao-novo-lancamento');

      await anexarFoto();

      expect(existe('comprovante-anexado')).toBe(false);
      expect(textoDe(porId('sheet-snackbar'))).toContain(
        'Formato não suportado. Use JPG ou PNG.',
      );
    });

    it('erro do seletor aparece no Snackbar do modal', async () => {
      seletor.tirarFoto.mockRejectedValueOnce(
        new Error('Câmera indisponível neste aparelho.'),
      );
      await renderizar(repositorio);
      await tocar('botao-novo-lancamento');

      await anexarFoto();

      expect(existe('comprovante-anexado')).toBe(false);
      expect(textoDe(porId('sheet-snackbar'))).toContain(
        'Câmera indisponível neste aparelho.',
      );
    });

    it('"Remover" tira a foto do formulário', async () => {
      await renderizar(repositorio);
      await tocar('botao-novo-lancamento');
      await anexarFoto();

      await tocar('comprovante-remover');

      expect(existe('comprovante-anexado')).toBe(false);
      await digitar('5');
      await tocar('categoria-alimentacao');
      await tocar('botao-salvar');
      expect(repositorio.criar).toHaveBeenCalledWith(
        expect.objectContaining({comprovanteUri: null}),
      );
      expect(armazenamento.guardar).not.toHaveBeenCalled();
    });

    it('trocar para Receita tira a foto', async () => {
      await renderizar(repositorio);
      await tocar('botao-novo-lancamento');
      await anexarFoto();
      expect(existe('comprovante-anexado')).toBe(true);

      await tocar('tipo-receita');
      await tocar('tipo-despesa');

      expect(existe('comprovante-anexado')).toBe(false);
    });

    it('miniatura que não carrega mostra "Comprovante não encontrado"', async () => {
      repositorio = new RepositorioEmMemoria([
        {...despesa, comprovanteUri: `${PASTA}sumiu.jpg`},
      ]);
      await renderizar(repositorio);
      await tocar('abrir-1');

      await act(async () => {
        porId('comprovante-imagem').props.onError();
      });

      expect(existe('comprovante-quebrado')).toBe(true);
      expect(textoDe(porId('comprovante-anexado'))).toContain(
        'Comprovante não encontrado',
      );
    });

    it('tocar na miniatura abre o visualizador em tela cheia', async () => {
      await renderizar(repositorio);
      await tocar('botao-novo-lancamento');
      await anexarFoto();

      await tocar('comprovante-miniatura');
      expect(existe('visualizador-comprovante')).toBe(true);

      await tocar('fechar-visualizador');
      expect(existe('visualizador-comprovante')).toBe(false);
    });

    it('editar trocando a foto salva a nova e apaga a antiga', async () => {
      const antiga = `${PASTA}antiga.jpg`;
      repositorio = new RepositorioEmMemoria([
        {...despesa, comprovanteUri: antiga},
      ]);
      seletor = criarSeletorFake({
        uri: 'file:///cache/nova.png',
        tipoMime: 'image/png',
      });
      await renderizar(repositorio);
      await tocar('abrir-1');

      await tocar('comprovante-trocar');
      await tocar('menu-tirar-foto');
      await tocar('botao-salvar');

      expect(repositorio.atualizar).toHaveBeenCalledWith(
        1,
        expect.objectContaining({comprovanteUri: `${PASTA}nova.png`}),
      );
      expect(armazenamento.apagar).toHaveBeenCalledWith(antiga);
      expect(textoDe(porId('home-snackbar'))).toContain(
        'Lançamento atualizado',
      );
    });
  });
});
