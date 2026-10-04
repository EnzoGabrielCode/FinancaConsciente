import {beforeEach, describe, expect, it, jest} from '@jest/globals';

import {LancamentosComComprovante} from '../src/domain/casosDeUso/LancamentosComComprovante';
import type {CandidataDuplicata} from '../src/domain/entities/Duplicata';
import type {DadosTransacao, Transacao} from '../src/domain/entities/Transacao';
import type {ArmazenamentoComprovantes} from '../src/domain/repositories/ArmazenamentoComprovantes';
import type {TransacaoRepository} from '../src/domain/repositories/TransacaoRepository';

const PASTA = 'file:///docs/comprovantes/';

class RepositorioFake implements TransacaoRepository {
  transacoes: Transacao[] = [];
  private proximoId = 1;

  listarRecentes = jest.fn(async () => [...this.transacoes]);

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

  saldoAte = jest.fn(async () => 0);

  totaisPorMes = jest.fn(async () => []);

  candidatas: CandidataDuplicata[] = [];

  buscarCandidatasDuplicata = jest.fn(async () => this.candidatas);
}

class ArmazenamentoFake implements ArmazenamentoComprovantes {
  arquivos = new Set<string>();
  private contador = 0;

  guardar = jest.fn(async (uriTemporaria: string) => {
    const extensao = uriTemporaria.split('.').pop();
    const definitiva = `${PASTA}comprovante-${++this.contador}.${extensao}`;
    this.arquivos.add(definitiva);
    return definitiva;
  });

  apagar = jest.fn(async (uri: string) => {
    this.arquivos.delete(uri);
  });

  ehDefinitivo = (uri: string) => uri.startsWith(PASTA);
}

const despesa: DadosTransacao = {
  tipo: 'despesa',
  descricao: 'Mercado',
  valorCentavos: 8990,
  data: '2026-09-28',
  categoria: 'alimentacao',
  recorrencia: 'variavel',
  comprovanteUri: null,
};

const TEMPORARIA = 'file:///cache/rn_image_picker_lib_temp_1.jpg';
const TEMPORARIA_2 = 'file:///cache/rn_image_picker_lib_temp_2.png';

describe('LancamentosComComprovante', () => {
  let repositorio: RepositorioFake;
  let armazenamento: ArmazenamentoFake;
  let casoDeUso: LancamentosComComprovante;

  async function criarComFoto(): Promise<{id: number; uri: string}> {
    const id = await casoDeUso.criar({...despesa, comprovanteUri: TEMPORARIA});
    const uri = repositorio.transacoes[0].comprovanteUri!;
    armazenamento.guardar.mockClear();
    return {id, uri};
  }

  beforeEach(() => {
    repositorio = new RepositorioFake();
    armazenamento = new ArmazenamentoFake();
    casoDeUso = new LancamentosComComprovante(repositorio, armazenamento);
  });

  it('criar com foto temporária guarda e salva a URI definitiva', async () => {
    const id = await casoDeUso.criar({...despesa, comprovanteUri: TEMPORARIA});

    expect(id).toBe(1);
    expect(armazenamento.guardar).toHaveBeenCalledWith(TEMPORARIA);
    expect(repositorio.criar).toHaveBeenCalledWith({
      ...despesa,
      comprovanteUri: `${PASTA}comprovante-1.jpg`,
    });
    expect(armazenamento.arquivos.has(`${PASTA}comprovante-1.jpg`)).toBe(true);
  });

  it('criar sem foto não chama guardar', async () => {
    await casoDeUso.criar(despesa);

    expect(armazenamento.guardar).not.toHaveBeenCalled();
    expect(repositorio.criar).toHaveBeenCalledWith(despesa);
  });

  it('criar com URI já definitiva não copia de novo', async () => {
    const uri = `${PASTA}existente.jpg`;
    await casoDeUso.criar({...despesa, comprovanteUri: uri});

    expect(armazenamento.guardar).not.toHaveBeenCalled();
    expect(repositorio.criar).toHaveBeenCalledWith({
      ...despesa,
      comprovanteUri: uri,
    });
  });

  it('se o banco falhar ao criar, apaga a cópia e relança o erro', async () => {
    repositorio.criar.mockRejectedValueOnce(new Error('disco cheio'));

    await expect(
      casoDeUso.criar({...despesa, comprovanteUri: TEMPORARIA}),
    ).rejects.toThrow('disco cheio');

    expect(armazenamento.apagar).toHaveBeenCalledWith(
      `${PASTA}comprovante-1.jpg`,
    );
    expect(armazenamento.arquivos.size).toBe(0);
  });

  it('se o banco falhar ao atualizar, apaga a cópia nova e mantém a antiga', async () => {
    const {id, uri} = await criarComFoto();
    repositorio.atualizar.mockRejectedValueOnce(new Error('banco travado'));

    await expect(
      casoDeUso.atualizar(id, {...despesa, comprovanteUri: TEMPORARIA_2}),
    ).rejects.toThrow('banco travado');

    expect(armazenamento.apagar).toHaveBeenCalledTimes(1);
    expect(armazenamento.apagar).toHaveBeenCalledWith(
      `${PASTA}comprovante-2.png`,
    );
    expect([...armazenamento.arquivos]).toEqual([uri]);
  });

  it('atualizar trocando a foto apaga a antiga', async () => {
    const {id, uri} = await criarComFoto();

    await casoDeUso.atualizar(id, {...despesa, comprovanteUri: TEMPORARIA_2});

    const nova = `${PASTA}comprovante-2.png`;
    expect(armazenamento.guardar).toHaveBeenCalledWith(TEMPORARIA_2);
    expect(repositorio.transacoes[0].comprovanteUri).toBe(nova);
    expect(armazenamento.apagar).toHaveBeenCalledWith(uri);
    expect([...armazenamento.arquivos]).toEqual([nova]);
  });

  it('atualizar removendo a foto apaga a antiga', async () => {
    const {id, uri} = await criarComFoto();

    await casoDeUso.atualizar(id, {...despesa, comprovanteUri: null});

    expect(armazenamento.guardar).not.toHaveBeenCalled();
    expect(repositorio.transacoes[0].comprovanteUri).toBeNull();
    expect(armazenamento.apagar).toHaveBeenCalledWith(uri);
    expect(armazenamento.arquivos.size).toBe(0);
  });

  it('atualizar mantendo a mesma foto não apaga nada', async () => {
    const {id, uri} = await criarComFoto();

    await casoDeUso.atualizar(id, {
      ...despesa,
      valorCentavos: 5000,
      comprovanteUri: uri,
    });

    expect(armazenamento.guardar).not.toHaveBeenCalled();
    expect(armazenamento.apagar).not.toHaveBeenCalled();
    expect(repositorio.transacoes[0]).toEqual(
      expect.objectContaining({valorCentavos: 5000, comprovanteUri: uri}),
    );
  });

  it('excluir apaga o arquivo do comprovante', async () => {
    const {id, uri} = await criarComFoto();

    await casoDeUso.excluir(id);

    expect(repositorio.excluir).toHaveBeenCalledWith(id);
    expect(armazenamento.apagar).toHaveBeenCalledWith(uri);
    expect(armazenamento.arquivos.size).toBe(0);
  });

  it('excluir sem comprovante não tenta apagar arquivo', async () => {
    const id = await casoDeUso.criar(despesa);

    await casoDeUso.excluir(id);

    expect(repositorio.transacoes).toEqual([]);
    expect(armazenamento.apagar).not.toHaveBeenCalled();
  });

  it('falha ao apagar o arquivo não impede a exclusão', async () => {
    const {id} = await criarComFoto();
    armazenamento.apagar.mockRejectedValueOnce(new Error('EACCES'));

    await expect(casoDeUso.excluir(id)).resolves.toBeUndefined();

    expect(repositorio.excluir).toHaveBeenCalledWith(id);
    expect(repositorio.transacoes).toEqual([]);
  });

  describe('verificarDuplicatas', () => {
    const criadoEmRecente = new Date().toISOString();

    it('busca as candidatas por (tipo, valor, data) e filtra', async () => {
      const mesmaCategoria = {
        transacao: {...despesa, id: 1, sincronizado: false},
        criadoEm: '2026-09-28T10:00:00.000Z',
      };
      const outraCategoriaAntiga = {
        transacao: {
          ...despesa,
          id: 2,
          categoria: 'transporte',
          sincronizado: false,
        },
        criadoEm: '2026-09-28T09:00:00.000Z',
      };
      const outroValor = {
        transacao: {...despesa, id: 3, valorCentavos: 1, sincronizado: false},
        criadoEm: criadoEmRecente,
      };
      repositorio.candidatas = [
        outraCategoriaAntiga,
        outroValor,
        mesmaCategoria,
      ];

      await expect(casoDeUso.verificarDuplicatas(despesa)).resolves.toEqual([
        {...mesmaCategoria, motivo: 'mesma-categoria'},
      ]);
      expect(repositorio.buscarCandidatasDuplicata).toHaveBeenCalledWith(
        'despesa',
        8990,
        '2026-09-28',
      );
    });

    it('receita devolve [] sem ir ao repositório', async () => {
      await expect(
        casoDeUso.verificarDuplicatas({...despesa, tipo: 'receita'}),
      ).resolves.toEqual([]);
      expect(repositorio.buscarCandidatasDuplicata).not.toHaveBeenCalled();
    });
  });
});
