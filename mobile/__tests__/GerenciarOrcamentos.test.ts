import {beforeEach, describe, expect, it, jest} from '@jest/globals';

import {GerenciarOrcamentos} from '../src/domain/casosDeUso/GerenciarOrcamentos';
import type {
  DadosOrcamento,
  NivelAlerta,
  Orcamento,
} from '../src/domain/entities/Orcamento';
import type {Notificador} from '../src/domain/repositories/Notificador';
import type {OrcamentoRepository} from '../src/domain/repositories/OrcamentoRepository';
import type {TransacaoRepository} from '../src/domain/repositories/TransacaoRepository';

const HOJE = '2026-11-06';

class OrcamentosEmMemoria implements OrcamentoRepository {
  orcamentos: Orcamento[] = [];
  alertas = new Set<string>();

  listar = jest.fn(async () => [...this.orcamentos]);

  salvar = jest.fn(async (dados: DadosOrcamento) => {
    this.orcamentos.push({id: this.orcamentos.length + 1, ...dados});
  });

  excluir = jest.fn(async (id: number) => {
    this.orcamentos = this.orcamentos.filter(o => o.id !== id);
  });

  registrarAlerta = jest.fn(
    async (categoria: string, anoMes: string, nivel: NivelAlerta) => {
      const chave = `${categoria}|${anoMes}|${nivel}`;
      const novo = !this.alertas.has(chave);
      this.alertas.add(chave);
      return novo;
    },
  );
}

describe('GerenciarOrcamentos', () => {
  let orcamentos: OrcamentosEmMemoria;
  let gastos: Record<string, number>;
  let gastosPorCategoria: jest.Mock<TransacaoRepository['gastosPorCategoria']>;
  let notificar: jest.Mock<Notificador['notificar']>;
  let pedirPermissao: jest.Mock<Notificador['pedirPermissao']>;
  let gerenciar: GerenciarOrcamentos;

  beforeEach(() => {
    orcamentos = new OrcamentosEmMemoria();
    orcamentos.orcamentos = [
      {id: 1, categoria: 'lazer', limiteCentavos: 10000},
    ];
    gastos = {};
    gastosPorCategoria = jest.fn<TransacaoRepository['gastosPorCategoria']>(
      async () => gastos,
    );
    notificar = jest.fn<Notificador['notificar']>(async () => {});
    pedirPermissao = jest.fn<Notificador['pedirPermissao']>(async () => true);
    gerenciar = new GerenciarOrcamentos(
      orcamentos,
      {gastosPorCategoria} as unknown as TransacaoRepository,
      {
        notificar,
        pedirPermissao,
        agendar: async () => {},
        cancelarComPrefixo: async () => {},
      },
    );
  });

  const gastar = async (centavos: number, data = HOJE, categoria = 'lazer') => {
    gastos = {[categoria]: centavos};
    return gerenciar.verificarAlerta(categoria, data, HOJE);
  };

  describe('verificarAlerta', () => {
    it('não notifica a 79%', async () => {
      await expect(gastar(7900)).resolves.toBe(false);
      expect(notificar).not.toHaveBeenCalled();
      expect(orcamentos.alertas.size).toBe(0);
    });

    it('notifica uma vez a 80%, com o restante', async () => {
      await expect(gastar(8000)).resolves.toBe(true);
      expect(notificar).toHaveBeenCalledTimes(1);
      expect(notificar).toHaveBeenCalledWith(
        'Atenção: orçamento de Lazer',
        'Você já usou 80% do limite do mês. Restam R$ 20,00.',
      );
    });

    it('não repete o aviso em outra despesa a 90%', async () => {
      await gastar(8000);
      await expect(gastar(9000)).resolves.toBe(false);
      expect(notificar).toHaveBeenCalledTimes(1);
    });

    it('notifica "estourado" uma única vez a 100%', async () => {
      await gastar(8000);
      notificar.mockClear();

      await expect(gastar(10000)).resolves.toBe(true);
      await expect(gastar(11000)).resolves.toBe(false);

      expect(notificar).toHaveBeenCalledTimes(1);
      expect(notificar).toHaveBeenCalledWith(
        'Orçamento de Lazer estourado',
        'Você gastou R$ 100,00 de R$ 100,00 este mês.',
      );
    });

    it('de 50% para 120% manda só o aviso de estourado', async () => {
      await gastar(5000);
      await gastar(12000);

      expect(notificar).toHaveBeenCalledTimes(1);
      expect(notificar.mock.calls[0][0]).toBe('Orçamento de Lazer estourado');
      expect(orcamentos.alertas).toEqual(
        new Set(['lazer|2026-11|80', 'lazer|2026-11|100']),
      );
    });

    it('depois de estourar, voltar a 90% não avisa de novo', async () => {
      await gastar(12000);
      notificar.mockClear();
      await expect(gastar(9000)).resolves.toBe(false);
      expect(notificar).not.toHaveBeenCalled();
    });

    it('avisa de novo no mês seguinte', async () => {
      await gastar(8000);
      notificar.mockClear();
      gastos = {lazer: 8000};

      await expect(
        gerenciar.verificarAlerta('lazer', '2026-12-02', '2026-12-05'),
      ).resolves.toBe(true);
      expect(notificar).toHaveBeenCalledTimes(1);
    });

    it('ignora despesa de mês passado', async () => {
      await expect(gastar(20000, '2026-10-31')).resolves.toBe(false);
      expect(notificar).not.toHaveBeenCalled();
      expect(gastosPorCategoria).not.toHaveBeenCalled();
    });

    it('ignora categoria sem orçamento', async () => {
      await expect(gastar(20000, HOJE, 'compras')).resolves.toBe(false);
      expect(notificar).not.toHaveBeenCalled();
    });

    it('não propaga erro do Notificador', async () => {
      notificar.mockRejectedValue(new Error('sem canal'));
      await expect(gastar(8000)).resolves.toBe(false);
    });

    it('não propaga erro dos repositórios', async () => {
      gastosPorCategoria.mockRejectedValue(new Error('banco fechado'));
      await expect(gastar(8000)).resolves.toBe(false);

      orcamentos.listar.mockRejectedValue(new Error('banco fechado'));
      await expect(gastar(8000)).resolves.toBe(false);
    });
  });

  describe('carregar', () => {
    it('monta o painel do mês de hoje e as categorias livres', async () => {
      gastos = {lazer: 8500};

      const painel = await gerenciar.carregar(HOJE);

      expect(gastosPorCategoria).toHaveBeenCalledWith('2026-11');
      expect(painel.progressos[0]).toMatchObject({
        percentual: 85,
        situacao: 'perto',
      });
      expect(painel.resumo).toMatchObject({
        totalLimite: 10000,
        disponivel: 1500,
      });
      expect(painel.categoriasLivres.map(c => c.id)).toEqual([
        'alimentacao',
        'transporte',
        'compras',
        'saude',
        'outros',
      ]);
    });
  });

  describe('salvar', () => {
    it('grava dados válidos', async () => {
      await gerenciar.salvar({categoria: 'compras', limiteCentavos: 5000});
      expect(orcamentos.salvar).toHaveBeenCalledWith({
        categoria: 'compras',
        limiteCentavos: 5000,
      });
    });

    it('recusa dados inválidos sem gravar', async () => {
      await expect(
        gerenciar.salvar({categoria: 'salario', limiteCentavos: 5000}),
      ).rejects.toThrow('categoria');
      expect(orcamentos.salvar).not.toHaveBeenCalled();
    });
  });

  it('excluir remove o orçamento', async () => {
    await gerenciar.excluir(1);
    expect(orcamentos.orcamentos).toEqual([]);
  });

  it('pedirPermissao devolve false se o Notificador lançar', async () => {
    pedirPermissao.mockRejectedValue(new Error('sem activity'));
    await expect(gerenciar.pedirPermissao()).resolves.toBe(false);
  });
});
