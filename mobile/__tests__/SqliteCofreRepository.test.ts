import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import SQLite, {type SQLiteDatabase} from 'react-native-sqlite-storage';

import {SqliteCofreRepository} from '../src/data/repositories/SqliteCofreRepository';

type MockFn = jest.Mock & {mock: {calls: unknown[][]}};

type MockDatabase = SQLiteDatabase & {
  executeSql: MockFn;
  transaction: MockFn & {
    mock: {results: {value: Promise<{executeSql: MockFn}>}[]};
  };
};

const createDb = () =>
  (
    SQLite as unknown as {createMockDatabase: () => MockDatabase}
  ).createMockDatabase();

const normalizar = (sql: unknown) => String(sql).replace(/\s+/g, ' ').trim();

const resultadoCom = (linhas: object[]) => [
  {
    rows: {
      length: linhas.length,
      item: (i: number) => linhas[i],
      raw: () => linhas,
    },
  },
];

describe('SqliteCofreRepository', () => {
  let db: MockDatabase;
  let repositorio: SqliteCofreRepository;

  const ultimaChamada = () => {
    const [sql, parametros] = db.executeSql.mock.calls.at(-1) as [
      string,
      unknown[],
    ];
    return {sql: normalizar(sql), parametros};
  };

  beforeEach(() => {
    db = createDb();
    repositorio = new SqliteCofreRepository(async () => db);
  });

  it('lista os cofres com o saldo somado dos movimentos', async () => {
    db.executeSql.mockImplementationOnce(async () =>
      resultadoCom([
        {
          id: 1,
          nome: 'Viagem',
          icone: '✈️',
          cor: '#64B5F6',
          meta_centavos: 800000,
          saldo: '496000',
        },
        {
          id: 2,
          nome: 'Reserva',
          icone: '🛡️',
          cor: '#39FF84',
          meta_centavos: null,
          saldo: 0,
        },
      ]),
    );

    await expect(repositorio.listar()).resolves.toEqual([
      {
        id: 1,
        nome: 'Viagem',
        icone: '✈️',
        cor: '#64B5F6',
        metaCentavos: 800000,
        saldoCentavos: 496000,
      },
      {
        id: 2,
        nome: 'Reserva',
        icone: '🛡️',
        cor: '#39FF84',
        metaCentavos: null,
        saldoCentavos: 0,
      },
    ]);
    expect(ultimaChamada()).toEqual({
      sql: "SELECT c.id, c.nome, c.icone, c.cor, c.meta_centavos, COALESCE(SUM(CASE WHEN m.tipo = 'deposito' THEN m.valor_centavos ELSE -m.valor_centavos END), 0) AS saldo FROM cofres c LEFT JOIN movimentos_cofre m ON m.cofre_id = c.id GROUP BY c.id ORDER BY c.criado_em, c.id",
      parametros: [],
    });
  });

  it('busca por id com parâmetro', async () => {
    await expect(repositorio.buscarPorId(7)).resolves.toBeNull();
    const {sql, parametros} = ultimaChamada();
    expect(sql).toContain('WHERE c.id = ? GROUP BY c.id');
    expect(parametros).toEqual([7]);
  });

  it('cria com INSERT parametrizado e devolve o id', async () => {
    const nome = "Casa d'água";
    await expect(
      repositorio.criar({
        nome,
        icone: '🏠',
        cor: '#FFB74D',
        metaCentavos: null,
      }),
    ).resolves.toBe(1);
    expect(ultimaChamada()).toEqual({
      sql: 'INSERT INTO cofres (nome, icone, cor, meta_centavos, sincronizado) VALUES (?, ?, ?, ?, 0)',
      parametros: [nome, '🏠', '#FFB74D', null],
    });
  });

  it('atualiza pelo id e marca como não sincronizado', async () => {
    await repositorio.atualizar(3, {
      nome: 'Carro',
      icone: '🚗',
      cor: '#FF6B6B',
      metaCentavos: 5000000,
    });
    expect(ultimaChamada()).toEqual({
      sql: 'UPDATE cofres SET nome = ?, icone = ?, cor = ?, meta_centavos = ?, sincronizado = 0 WHERE id = ?',
      parametros: ['Carro', '🚗', '#FF6B6B', 5000000, 3],
    });
  });

  it('registra um movimento com INSERT parametrizado', async () => {
    await expect(
      repositorio.registrarMovimento({
        cofreId: 2,
        tipo: 'deposito',
        valorCentavos: 50000,
        data: '2026-10-03',
      }),
    ).resolves.toBe(1);
    expect(ultimaChamada()).toEqual({
      sql: 'INSERT INTO movimentos_cofre (cofre_id, tipo, valor_centavos, data, sincronizado) VALUES (?, ?, ?, ?, 0)',
      parametros: [2, 'deposito', 50000, '2026-10-03'],
    });
  });

  it('lista os últimos movimentos do cofre', async () => {
    db.executeSql.mockImplementationOnce(async () =>
      resultadoCom([
        {
          id: 4,
          cofre_id: 2,
          tipo: 'retirada',
          valor_centavos: 20000,
          data: '2026-10-02',
        },
      ]),
    );
    await expect(repositorio.listarMovimentos(2, 5)).resolves.toEqual([
      {
        id: 4,
        cofreId: 2,
        tipo: 'retirada',
        valorCentavos: 20000,
        data: '2026-10-02',
      },
    ]);
    expect(ultimaChamada()).toEqual({
      sql: 'SELECT id, cofre_id, tipo, valor_centavos, data FROM movimentos_cofre WHERE cofre_id = ? ORDER BY data DESC, id DESC LIMIT ?',
      parametros: [2, 5],
    });
  });

  it('exclui os movimentos e o cofre na mesma transação', async () => {
    await repositorio.excluir(5);

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(db.executeSql).not.toHaveBeenCalled();
    const tx = await db.transaction.mock.results[0].value;
    expect(
      tx.executeSql.mock.calls.map(([sql, parametros]) => [
        normalizar(sql),
        parametros,
      ]),
    ).toEqual([
      ['DELETE FROM movimentos_cofre WHERE cofre_id = ?', [5]],
      ['DELETE FROM cofres WHERE id = ?', [5]],
    ]);
  });

  it('total guardado é 0 sem movimentos e converte o SUM com Number', async () => {
    db.executeSql.mockImplementationOnce(async () =>
      resultadoCom([{total: 0}]),
    );
    await expect(repositorio.totalGuardado()).resolves.toBe(0);

    db.executeSql.mockImplementationOnce(async () =>
      resultadoCom([{total: '30000'}]),
    );
    await expect(repositorio.totalGuardado()).resolves.toBe(30000);
    expect(ultimaChamada().sql).toBe(
      "SELECT COALESCE(SUM(CASE WHEN m.tipo = 'deposito' THEN m.valor_centavos ELSE -m.valor_centavos END), 0) AS total FROM movimentos_cofre m",
    );
  });
});
