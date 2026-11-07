import {beforeEach, describe, expect, it} from '@jest/globals';
import type {SQLiteDatabase} from 'react-native-sqlite-storage';

import {runMigrations} from '../src/data/database/migrations';
import {SqliteContaRecorrenteRepository} from '../src/data/repositories/SqliteContaRecorrenteRepository';
import {SqliteTransacaoRepository} from '../src/data/repositories/SqliteTransacaoRepository';
import {GerenciarContasRecorrentes} from '../src/domain/casosDeUso/GerenciarContasRecorrentes';
import type {DadosContaRecorrente} from '../src/domain/entities/ContaRecorrente';
import type {DadosTransacao} from '../src/domain/entities/Transacao';
import {criarBancoReal} from '../test-utils/bancoReal';

const dadosConta: DadosContaRecorrente = {
  descricao: "Conta d'água",
  valorCentavos: 9990,
  categoria: 'outros',
  frequencia: 'mensal',
  dia: 10,
  mes: null,
  lembrarDiasAntes: 2,
  ativa: true,
};

const despesa = (contaRecorrenteId: number | null): DadosTransacao => ({
  tipo: 'despesa',
  descricao: 'Internet',
  valorCentavos: 9990,
  data: '2026-11-10',
  categoria: 'outros',
  recorrencia: 'fixa',
  comprovanteUri: null,
  contaRecorrenteId,
});

let db: SQLiteDatabase;
let contas: SqliteContaRecorrenteRepository;
let transacoes: SqliteTransacaoRepository;

beforeEach(async () => {
  db = criarBancoReal();
  await runMigrations(db);
  contas = new SqliteContaRecorrenteRepository(async () => db);
  transacoes = new SqliteTransacaoRepository(async () => db);
});

describe('SqliteContaRecorrenteRepository', () => {
  it('cria e lê todos os campos', async () => {
    const id = await contas.criar(dadosConta, '2026-11-10');

    await expect(contas.buscarPorId(id)).resolves.toEqual({
      ...dadosConta,
      id,
      proxima: '2026-11-10',
    });
  });

  it('busca por id inexistente devolve null', async () => {
    await expect(contas.buscarPorId(9)).resolves.toBeNull();
  });

  it('guarda o mês da conta anual', async () => {
    const id = await contas.criar(
      {...dadosConta, frequencia: 'anual', mes: 3},
      '2027-03-10',
    );
    await expect(contas.buscarPorId(id)).resolves.toMatchObject({
      frequencia: 'anual',
      mes: 3,
    });
  });

  it('atualiza, pausa e avança proxima', async () => {
    const id = await contas.criar(dadosConta, '2026-11-10');

    await contas.atualizar(
      id,
      {...dadosConta, descricao: 'Fibra', valorCentavos: 12000},
      '2026-12-10',
    );
    await contas.definirAtiva(id, false);

    await expect(contas.buscarPorId(id)).resolves.toMatchObject({
      descricao: 'Fibra',
      valorCentavos: 12000,
      proxima: '2026-12-10',
      ativa: false,
    });

    await contas.avancarProxima(id, '2027-01-10');
    await contas.definirAtiva(id, true);
    await expect(contas.buscarPorId(id)).resolves.toMatchObject({
      proxima: '2027-01-10',
      ativa: true,
    });
  });

  it('lista por proxima', async () => {
    await contas.criar({...dadosConta, descricao: 'B'}, '2026-12-10');
    await contas.criar({...dadosConta, descricao: 'A'}, '2026-11-10');

    const lista = await contas.listar();

    expect(lista.map(c => c.descricao)).toEqual(['A', 'B']);
  });

  it('excluir mantém as transações sem o vínculo', async () => {
    const id = await contas.criar(dadosConta, '2026-11-10');
    const transacaoId = await transacoes.criar(despesa(id));

    await contas.excluir(id);

    await expect(contas.listar()).resolves.toEqual([]);
    await expect(transacoes.buscarPorId(transacaoId)).resolves.toMatchObject({
      descricao: 'Internet',
      contaRecorrenteId: null,
    });
  });
});

describe('SqliteTransacaoRepository: contas recorrentes', () => {
  let contaId: number;

  beforeEach(async () => {
    contaId = await contas.criar(dadosConta, '2026-11-10');
  });

  it('grava e lê contaRecorrenteId', async () => {
    const id = await transacoes.criar(despesa(contaId));

    await expect(transacoes.buscarPorId(id)).resolves.toMatchObject({
      contaRecorrenteId: contaId,
    });
    await expect(transacoes.listarRecentes(5)).resolves.toMatchObject([
      {contaRecorrenteId: contaId},
    ]);
  });

  it('lancarRecorrente devolve true na 1ª vez e false na 2ª', async () => {
    await expect(transacoes.lancarRecorrente(despesa(contaId))).resolves.toBe(
      true,
    );
    await expect(transacoes.lancarRecorrente(despesa(contaId))).resolves.toBe(
      false,
    );
    await expect(transacoes.listarRecentes(5)).resolves.toHaveLength(1);
  });

  it('lancarRecorrente aceita a mesma conta em outra data', async () => {
    await transacoes.lancarRecorrente(despesa(contaId));
    await expect(
      transacoes.lancarRecorrente({...despesa(contaId), data: '2026-12-10'}),
    ).resolves.toBe(true);
  });

  it('atualizar mantém o vínculo', async () => {
    const id = await transacoes.criar(despesa(contaId));

    await transacoes.atualizar(id, {
      ...despesa(contaId),
      valorCentavos: 12000,
    });

    await expect(transacoes.buscarPorId(id)).resolves.toMatchObject({
      valorCentavos: 12000,
      contaRecorrenteId: contaId,
    });
  });

  it('avisa ao mover um lançamento para a data de outro da mesma conta', async () => {
    await transacoes.criar(despesa(contaId));
    const id = await transacoes.criar({
      ...despesa(contaId),
      data: '2026-12-10',
    });

    await expect(transacoes.atualizar(id, despesa(contaId))).rejects.toThrow(
      'Esta conta fixa já tem um lançamento nessa data.',
    );
  });

  it('o caso de uso não duplica no banco de verdade', async () => {
    const gerenciar = new GerenciarContasRecorrentes(contas, transacoes, {
      agendar: async () => {},
      cancelarComPrefixo: async () => {},
      notificar: async () => {},
      pedirPermissao: async () => true,
    });

    await expect(gerenciar.lancarVencidas('2026-11-10')).resolves.toBe(1);
    await contas.avancarProxima(contaId, '2026-11-10');
    await expect(gerenciar.lancarVencidas('2026-11-10')).resolves.toBe(0);

    await expect(transacoes.listarRecentes(5)).resolves.toHaveLength(1);
    await expect(contas.buscarPorId(contaId)).resolves.toMatchObject({
      proxima: '2026-12-10',
    });
  });
});
