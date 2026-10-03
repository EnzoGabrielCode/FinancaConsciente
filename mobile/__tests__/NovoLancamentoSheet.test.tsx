import 'react-native';
import React from 'react';
import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {AppState} from 'react-native';
import {PaperProvider} from 'react-native-paper';
import renderer, {
  act,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';

import {hojeISO} from '../src/domain/datas';
import type {
  Cofre,
  DadosCofre,
  DadosMovimento,
  MovimentoCofre,
} from '../src/domain/entities/Cofre';
import type {TotaisMes} from '../src/domain/entities/Dashboard';
import type {PossivelDuplicata} from '../src/domain/entities/Duplicata';
import type {DadosTransacao, Transacao} from '../src/domain/entities/Transacao';
import type {ArmazenamentoComprovantes} from '../src/domain/repositories/ArmazenamentoComprovantes';
import type {CofreRepository} from '../src/domain/repositories/CofreRepository';
import type {TransacaoRepository} from '../src/domain/repositories/TransacaoRepository';
import AlertaDuplicataDialog from '../src/presentation/components/AlertaDuplicataDialog';
import NovoLancamentoSheet from '../src/presentation/components/NovoLancamentoSheet';
import HomeScreen from '../src/presentation/screens/HomeScreen';
import type {
  ImagemSelecionada,
  SeletorImagem,
} from '../src/presentation/servicos/seletorImagem';
import {darkTheme} from '../src/presentation/theme';

class RepositorioEmMemoria implements TransacaoRepository {
  transacoes: Transacao[] = [];
  criadoEm = new Map<number, string>();
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
    this.criadoEm.set(id, new Date().toISOString());
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

  saldoAte = jest.fn(async (dataISO: string) =>
    this.transacoes
      .filter(t => t.data <= dataISO)
      .reduce(
        (saldo, t) =>
          saldo + (t.tipo === 'receita' ? t.valorCentavos : -t.valorCentavos),
        0,
      ),
  );

  totaisPorMes = jest.fn(async (deAnoMes: string, ateAnoMes: string) => {
    const porMes = new Map<string, TotaisMes>();
    for (const t of this.transacoes) {
      const anoMes = t.data.slice(0, 7);
      if (anoMes < deAnoMes || anoMes > ateAnoMes) {
        continue;
      }
      const totais = porMes.get(anoMes) ?? {
        anoMes,
        receitasCentavos: 0,
        despesasCentavos: 0,
      };
      if (t.tipo === 'receita') {
        totais.receitasCentavos += t.valorCentavos;
      } else {
        totais.despesasCentavos += t.valorCentavos;
      }
      porMes.set(anoMes, totais);
    }
    return [...porMes.values()].sort((a, b) =>
      a.anoMes.localeCompare(b.anoMes),
    );
  });

  buscarCandidatasDuplicata = jest.fn(
    async (tipo: string, valorCentavos: number, data: string) =>
      this.transacoes
        .filter(
          t =>
            t.tipo === tipo &&
            t.valorCentavos === valorCentavos &&
            t.data === data,
        )
        .map(transacao => ({
          transacao,
          criadoEm:
            this.criadoEm.get(transacao.id) ?? '2000-01-01T00:00:00.000Z',
        })),
  );
}

class CofresEmMemoria implements CofreRepository {
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
    this.movimentos
      .filter(m => m.cofreId === cofreId)
      .reverse()
      .slice(0, limite),
  );

  totalGuardado = jest.fn(async () =>
    this.movimentos.reduce(
      (soma, m) =>
        soma + (m.tipo === 'deposito' ? m.valorCentavos : -m.valorCentavos),
      0,
    ),
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
let cofresRepo: CofresEmMemoria;
let seletor: ReturnType<typeof criarSeletorFake>;

async function renderizar(repositorio: TransacaoRepository) {
  await act(async () => {
    tree = renderer.create(
      <PaperProvider theme={darkTheme}>
        <HomeScreen
          repositorio={repositorio}
          armazenamento={armazenamento}
          repositorioCofres={cofresRepo}
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
    cofresRepo = new CofresEmMemoria();
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

describe('NovoLancamentoSheet: prevenção de duplicatas (US 1.5)', () => {
  const duplicataDe = (
    id: number,
    motivo: PossivelDuplicata['motivo'] = 'mesma-categoria',
    parcial: Partial<Transacao> = {},
  ): PossivelDuplicata => ({
    transacao: {
      ...despesa,
      id,
      data: hojeISO(),
      descricao: `Mercado ${id}`,
      ...parcial,
    },
    criadoEm: new Date(2026, 9, 3, 14, 32).toISOString(),
    motivo,
  });

  let onSalvar: jest.Mock<(dados: DadosTransacao) => Promise<void>>;
  let onVerificarDuplicatas: jest.Mock<
    (dados: DadosTransacao) => Promise<PossivelDuplicata[]>
  >;

  beforeEach(() => {
    jest.useFakeTimers();
    seletor = criarSeletorFake();
    onSalvar = jest.fn(async () => {});
    onVerificarDuplicatas = jest.fn(async () => []);
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
      tree.unmount();
    });
    jest.useRealTimers();
  });

  async function abrirSheet(transacao: Transacao | null = null) {
    await act(async () => {
      tree = renderer.create(
        <PaperProvider theme={darkTheme}>
          <NovoLancamentoSheet
            visivel
            transacao={transacao}
            onFechar={() => {}}
            onSalvar={onSalvar}
            onVerificarDuplicatas={onVerificarDuplicatas}
            seletorImagem={seletor}
          />
        </PaperProvider>,
      );
    });
  }

  async function preencherDespesa() {
    await digitar('8', '9', ',', '9', '0');
    await tocar('categoria-alimentacao');
  }

  const alertaAberto = () =>
    tree.root.findAll(
      no => no.props.testID === 'alerta-duplicata' && no.props.visible === true,
    ).length > 0;

  it('sem duplicata salva direto', async () => {
    await abrirSheet();
    await preencherDespesa();
    await tocar('botao-salvar');

    expect(onVerificarDuplicatas).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'despesa',
        valorCentavos: 8990,
        categoria: 'alimentacao',
        data: hojeISO(),
      }),
    );
    expect(onSalvar).toHaveBeenCalledTimes(1);
    expect(existe('alerta-duplicata-titulo')).toBe(false);
  });

  it('com duplicata abre o alerta e não chama onSalvar', async () => {
    onVerificarDuplicatas.mockResolvedValueOnce([duplicataDe(7)]);
    await abrirSheet();
    await preencherDespesa();
    await tocar('botao-salvar');

    expect(alertaAberto()).toBe(true);
    expect(onSalvar).not.toHaveBeenCalled();
    expect(textoDe(porId('alerta-duplicata-titulo'))).toBe('Despesa repetida?');
    expect(textoDe(porId('alerta-duplicata-texto'))).toBe(
      'Você já lançou R$ 89,90 hoje:',
    );
    expect(textoDe(porId('duplicata-item-7'))).toMatch(
      /Alimentação.*Mercado 7.*às 14:32$/,
    );
    expect(textoDe(porId('alerta-duplicata-motivo'))).toBe(
      'Mesmo valor, mesma categoria e mesmo dia.',
    );
    expect(existe('alerta-duplicata-mais')).toBe(false);
  });

  it('mostra até 3 itens, "e mais N" e o motivo do primeiro', async () => {
    onVerificarDuplicatas.mockResolvedValueOnce([
      duplicataDe(1, 'lancada-agora', {
        data: '2026-09-28',
        categoria: 'transporte',
      }),
      duplicataDe(2, 'mesma-categoria', {data: '2026-09-28'}),
      duplicataDe(3, 'mesma-categoria', {data: '2026-09-28'}),
      duplicataDe(4, 'mesma-categoria', {data: '2026-09-28'}),
      duplicataDe(5, 'mesma-categoria', {data: '2026-09-28'}),
    ]);
    await abrirSheet();
    await preencherDespesa();
    await tocar('botao-salvar');

    expect(existe('duplicata-item-1')).toBe(true);
    expect(existe('duplicata-item-3')).toBe(true);
    expect(existe('duplicata-item-4')).toBe(false);
    expect(textoDe(porId('alerta-duplicata-mais'))).toBe('e mais 2');
    expect(textoDe(porId('duplicata-item-1'))).toContain('Transporte');
    expect(textoDe(porId('alerta-duplicata-motivo'))).toBe(
      'Lançada há poucos minutos com o mesmo valor.',
    );
  });

  it('o alerta mostra "em DD/MM/AAAA" quando a data não é hoje', async () => {
    await act(async () => {
      tree = renderer.create(
        <PaperProvider theme={darkTheme}>
          <AlertaDuplicataDialog
            visivel
            duplicatas={[
              duplicataDe(7, 'mesma-categoria', {data: '2026-09-28'}),
            ]}
            valorCentavos={8990}
            data="2026-09-28"
            onRevisar={() => {}}
            onSalvarMesmoAssim={() => {}}
          />
        </PaperProvider>,
      );
    });

    expect(textoDe(porId('alerta-duplicata-texto'))).toBe(
      'Você já lançou R$ 89,90 em 28/09/2026:',
    );
  });

  it('"Voltar e revisar" fecha o alerta e mantém o formulário preenchido', async () => {
    onVerificarDuplicatas.mockResolvedValueOnce([duplicataDe(7)]);
    await abrirSheet();
    await preencherDespesa();
    await tocar('botao-camera');
    await tocar('menu-tirar-foto');
    await tocar('botao-salvar');

    await tocar('alerta-duplicata-revisar');

    expect(alertaAberto()).toBe(false);
    expect(onSalvar).not.toHaveBeenCalled();
    expect(existe('novo-lancamento-sheet')).toBe(true);
    expect(textoDe(porId('valor-display'))).toBe('89,90');
    expect(porId('categoria-alimentacao').props.accessibilityState).toEqual({
      checked: true,
    });
    expect(existe('comprovante-anexado')).toBe(true);
  });

  it('"Salvar mesmo assim" fecha o alerta e chama onSalvar uma vez', async () => {
    onVerificarDuplicatas.mockResolvedValueOnce([duplicataDe(7)]);
    await abrirSheet();
    await preencherDespesa();
    await tocar('botao-salvar');

    await tocar('alerta-duplicata-salvar');

    expect(alertaAberto()).toBe(false);
    expect(onSalvar).toHaveBeenCalledTimes(1);
    expect(onSalvar).toHaveBeenCalledWith(
      expect.objectContaining({valorCentavos: 8990, categoria: 'alimentacao'}),
    );
    expect(onVerificarDuplicatas).toHaveBeenCalledTimes(1);
  });

  it('erro na verificação não impede de salvar', async () => {
    onVerificarDuplicatas.mockRejectedValueOnce(new Error('banco ocupado'));
    await abrirSheet();
    await preencherDespesa();
    await tocar('botao-salvar');

    expect(onSalvar).toHaveBeenCalledTimes(1);
    expect(alertaAberto()).toBe(false);
  });

  it('em edição não chama onVerificarDuplicatas', async () => {
    await abrirSheet({...despesa, data: hojeISO()});
    await digitar('⌫');
    await tocar('botao-salvar');

    expect(onVerificarDuplicatas).not.toHaveBeenCalled();
    expect(onSalvar).toHaveBeenCalledTimes(1);
  });

  it('receita não mostra alerta', async () => {
    await abrirSheet();
    await tocar('tipo-receita');
    await digitar('8', '9', ',', '9', '0');
    await tocar('categoria-salario');
    await tocar('botao-salvar');

    expect(alertaAberto()).toBe(false);
    expect(onSalvar).toHaveBeenCalledTimes(1);
  });

  it('na tela inicial, a mesma despesa duas vezes mostra o alerta', async () => {
    const repositorio = new RepositorioEmMemoria();
    armazenamento = new ArmazenamentoFake();
    cofresRepo = new CofresEmMemoria();
    await renderizar(repositorio);

    for (let vez = 0; vez < 2; vez++) {
      await tocar('botao-novo-lancamento');
      await preencherDespesa();
      await tocar('botao-salvar');
    }

    expect(repositorio.criar).toHaveBeenCalledTimes(1);
    expect(repositorio.buscarCandidatasDuplicata).toHaveBeenLastCalledWith(
      'despesa',
      8990,
      hojeISO(),
    );
    expect(alertaAberto()).toBe(true);

    await tocar('alerta-duplicata-salvar');
    expect(repositorio.criar).toHaveBeenCalledTimes(2);
  });
});

describe('HomeScreen: dashboard', () => {
  let repositorio: RepositorioEmMemoria;
  const appStateMock = AppState.addEventListener as unknown as jest.Mock<
    typeof AppState.addEventListener
  >;

  beforeEach(() => {
    jest.useFakeTimers();
    appStateMock.mockClear();
    armazenamento = new ArmazenamentoFake();
    cofresRepo = new CofresEmMemoria();
    seletor = criarSeletorFake();
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
      tree.unmount();
    });
    jest.useRealTimers();
  });

  it('mostra o cabeçalho com saudação no lugar do Appbar', async () => {
    repositorio = new RepositorioEmMemoria();
    await renderizar(repositorio);

    expect(textoDe(porId('saudacao'))).toMatch(
      /^(Bom dia|Boa tarde|Boa noite)$/,
    );
    expect(existe('receitas-card')).toBe(false);
    expect(existe('database-card')).toBe(false);
  });

  it('atualiza o saldo na hora depois de salvar e de excluir', async () => {
    repositorio = new RepositorioEmMemoria([
      {...despesa, data: hojeISO(), valorCentavos: 20000},
    ]);
    await renderizar(repositorio);
    expect(textoDe(porId('disponivel'))).toBe('R$ -200,00');

    await tocar('botao-novo-lancamento');
    await tocar('tipo-receita');
    await digitar('1', '2', '0', '0');
    await tocar('categoria-salario');
    await tocar('botao-salvar');

    expect(textoDe(porId('disponivel'))).toBe('R$ 1.000,00');
    expect(textoDe(porId('receitas-mes'))).toBe('+R$ 1.200,00');
    expect(textoDe(porId('despesas-mes'))).toBe('-R$ 200,00');

    await tocar('excluir-1');
    await tocar('confirmar-exclusao');

    expect(textoDe(porId('disponivel'))).toBe('R$ 1.200,00');
    expect(textoDe(porId('despesas-mes'))).toBe('-R$ 0,00');
  });

  it('mostra o indicador no lugar do card enquanto carrega', async () => {
    repositorio = new RepositorioEmMemoria();
    repositorio.saldoAte.mockImplementation(() => new Promise(() => {}));
    await renderizar(repositorio);

    expect(existe('carregando-resumo')).toBe(true);
    expect(existe('card-saldo')).toBe(false);
  });

  it('recarrega quando o app volta para a frente e remove o listener', async () => {
    repositorio = new RepositorioEmMemoria();
    await renderizar(repositorio);
    const [[evento, aoMudar]] = appStateMock.mock.calls;
    const assinatura = appStateMock.mock.results[0].value as {
      remove: jest.Mock;
    };
    expect(evento).toBe('change');
    const chamadas = repositorio.totaisPorMes.mock.calls.length;

    await act(async () => {
      aoMudar('background');
    });
    expect(repositorio.totaisPorMes).toHaveBeenCalledTimes(chamadas);

    await act(async () => {
      aoMudar('active');
    });
    expect(repositorio.totaisPorMes).toHaveBeenCalledTimes(chamadas + 1);

    await act(async () => {
      tree.unmount();
    });
    expect(assinatura.remove).toHaveBeenCalled();
    await renderizar(repositorio);
  });

  it('puxar a tela para baixo recarrega o painel', async () => {
    repositorio = new RepositorioEmMemoria();
    await renderizar(repositorio);
    repositorio.transacoes.push({...despesa, data: hojeISO()});

    const refresh = porId('home-scroll').props.refreshControl;
    expect(refresh.props.colors).toEqual(['#39FF84']);
    await act(async () => {
      await refresh.props.onRefresh();
    });

    expect(textoDe(porId('disponivel'))).toBe('R$ -89,90');
  });
});

describe('HomeScreen: cofres virtuais', () => {
  const receita: Transacao = {
    id: 1,
    tipo: 'receita',
    descricao: 'Salário',
    valorCentavos: 100000,
    data: hojeISO(),
    categoria: 'salario',
    recorrencia: 'fixa',
    comprovanteUri: null,
    sincronizado: true,
  };

  let repositorio: RepositorioEmMemoria;

  beforeEach(() => {
    jest.useFakeTimers();
    repositorio = new RepositorioEmMemoria([receita]);
    armazenamento = new ArmazenamentoFake();
    cofresRepo = new CofresEmMemoria();
    seletor = criarSeletorFake();
  });

  afterEach(async () => {
    await act(async () => {
      jest.runOnlyPendingTimers();
      tree.unmount();
    });
    jest.useRealTimers();
  });

  async function escrever(id: string, texto: string) {
    const [campo] = tree.root.findAll(
      no =>
        no.props.testID === id && typeof no.props.onChangeText === 'function',
    );
    await act(async () => {
      campo.props.onChangeText(texto);
    });
  }

  async function criarViagem() {
    const id = await cofresRepo.criar({
      nome: 'Viagem',
      icone: '✈️',
      cor: '#64B5F6',
      metaCentavos: 800000,
    });
    return id;
  }

  it('sem cofres mostra o atalho "Criar cofre" que abre a tela com o formulário', async () => {
    await renderizar(repositorio);

    expect(existe('cofre-criar-atalho')).toBe(true);
    expect(textoDe(porId('em-cofres'))).toBe('R$ 0,00');
    expect(textoDe(porId('em-cofres-detalhe'))).toBe('Nenhum cofre');
    expect(existe('cofres-screen')).toBe(false);

    await tocar('cofre-criar-atalho');

    expect(existe('cofres-screen')).toBe(true);
    expect(textoDe(porId('cofre-form-titulo'))).toBe('Novo Cofre');
    expect(textoDe(porId('cofres-vazio'))).toContain('Nenhum cofre ainda');
  });

  it('cria um cofre pela tela e ele aparece no mini card da tela inicial', async () => {
    await renderizar(repositorio);
    await tocar('cofres-ver-todos');
    expect(existe('cofre-form-sheet')).toBe(false);

    await tocar('cofres-novo');
    await escrever('cofre-nome-input', 'Viagem');
    await escrever('cofre-meta-input', '8000');
    await tocar('cofre-form-salvar');

    expect(cofresRepo.criar).toHaveBeenCalledWith({
      nome: 'Viagem',
      icone: '💰',
      cor: '#39FF84',
      metaCentavos: 800000,
    });
    expect(existe('cofre-form-sheet')).toBe(false);
    expect(textoDe(porId('cofres-snackbar'))).toBe('Cofre criado');
    expect(textoDe(porId('cofre-meta-1'))).toBe('0% · Meta: R$ 8.000,00');
    expect(existe('cofre-mini-1')).toBe(true);
    expect(existe('cofre-criar-atalho')).toBe(false);
    expect(textoDe(porId('em-cofres-detalhe'))).toBe('1 cofre');
  });

  it('guardar diminui o disponível sem mudar o saldo e atualiza o dashboard', async () => {
    await criarViagem();
    await renderizar(repositorio);

    await tocar('cofre-mini-1');
    expect(textoDe(porId('cofres-disponivel'))).toBe('Disponível: R$ 1.000,00');

    await tocar('cofre-card-1');
    await digitar('3', '0', '0');
    await tocar('movimentar-confirmar');

    expect(cofresRepo.registrarMovimento).toHaveBeenCalledWith({
      cofreId: 1,
      tipo: 'deposito',
      valorCentavos: 30000,
      data: hojeISO(),
    });
    expect(repositorio.criar).not.toHaveBeenCalled();
    expect(existe('movimentar-cofre-sheet')).toBe(false);
    expect(textoDe(porId('cofres-snackbar'))).toBe(
      'R$ 300,00 guardado em Viagem',
    );
    expect(textoDe(porId('cofres-total-valor'))).toBe('R$ 300,00');
    expect(textoDe(porId('cofres-disponivel'))).toBe('Disponível: R$ 700,00');
    expect(textoDe(porId('cofre-meta-1'))).toBe('4% · Meta: R$ 8.000,00');

    await tocar('cofres-voltar');
    expect(existe('cofres-screen')).toBe(false);
    expect(textoDe(porId('saldo-total'))).toBe('Saldo total R$ 1.000,00');
    expect(textoDe(porId('disponivel'))).toBe('R$ 700,00');
    expect(textoDe(porId('em-cofres'))).toBe('R$ 300,00');
  });

  it('guardar mais que o disponível mostra o erro e não fecha a folha', async () => {
    await criarViagem();
    await renderizar(repositorio);
    await tocar('cofre-mini-1');
    await tocar('cofre-card-1');

    await digitar('2', '0', '0', '0');
    await tocar('movimentar-confirmar');

    expect(textoDe(porId('movimentar-erro'))).toBe(
      'Você tem só R$ 1.000,00 disponível.',
    );
    expect(existe('movimentar-cofre-sheet')).toBe(true);
    expect(cofresRepo.registrarMovimento).not.toHaveBeenCalled();
  });

  it('excluir o cofre pede confirmação e devolve o dinheiro ao disponível', async () => {
    const id = await criarViagem();
    await cofresRepo.registrarMovimento({
      cofreId: id,
      tipo: 'deposito',
      valorCentavos: 40000,
      data: hojeISO(),
    });
    await renderizar(repositorio);
    expect(textoDe(porId('disponivel'))).toBe('R$ 600,00');
    expect(textoDe(porId('em-cofres'))).toBe('R$ 400,00');

    await tocar('cofre-mini-1');
    await tocar('cofre-menu-1');
    await tocar('menu-cofre-excluir');

    expect(textoDe(porId('dialogo-exclusao-titulo'))).toBe('Excluir "Viagem"?');
    expect(textoDe(porId('dialogo-exclusao-mensagem'))).toBe(
      'Os R$ 400,00 guardados voltam para o saldo disponível.',
    );

    await tocar('confirmar-exclusao');

    expect(cofresRepo.excluir).toHaveBeenCalledWith(1);
    expect(textoDe(porId('cofres-snackbar'))).toBe(
      'Cofre excluído · R$ 400,00 voltaram para o disponível',
    );
    expect(textoDe(porId('cofres-disponivel'))).toBe('Disponível: R$ 1.000,00');
    expect(textoDe(porId('disponivel'))).toBe('R$ 1.000,00');
    expect(textoDe(porId('em-cofres'))).toBe('R$ 0,00');
    expect(textoDe(porId('em-cofres-detalhe'))).toBe('Nenhum cofre');
  });

  it('excluir um cofre sem saldo mostra só "Cofre excluído"', async () => {
    await criarViagem();
    await renderizar(repositorio);

    await tocar('cofre-mini-1');
    await tocar('cofre-menu-1');
    await tocar('menu-cofre-excluir');
    await tocar('confirmar-exclusao');

    expect(cofresRepo.excluir).toHaveBeenCalledWith(1);
    expect(textoDe(porId('cofres-snackbar'))).toBe('Cofre excluído');
  });
});
