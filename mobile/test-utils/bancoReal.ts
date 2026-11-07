import type {SQLiteDatabase} from 'react-native-sqlite-storage';

// O mock de jest.setup.js não aplica CHECK, UNIQUE nem rowsAffected. Este banco
// em memória (node:sqlite, Node >= 22.13) executa o SQL de verdade.
const {DatabaseSync} = require('node:sqlite');

type Parametros = (string | number | null)[];

export function criarBancoReal(): SQLiteDatabase {
  const banco = new DatabaseSync(':memory:');

  const executar = (sql: string, parametros: Parametros = []) => {
    const consulta = banco.prepare(sql);
    if (/^\s*(SELECT|PRAGMA)/i.test(sql)) {
      const linhas: object[] = consulta.all(...parametros);
      return {
        rows: {
          length: linhas.length,
          item: (i: number) => linhas[i],
          raw: () => linhas,
        },
        rowsAffected: 0,
      };
    }
    const {changes, lastInsertRowid} = consulta.run(...parametros);
    return {
      rows: {length: 0, item: () => undefined, raw: () => []},
      rowsAffected: Number(changes),
      insertId: Number(lastInsertRowid),
    };
  };

  return {
    executeSql: async (sql: string, parametros?: Parametros) => [
      executar(sql, parametros),
    ],
    transaction: async (
      escopo: (tx: {
        executeSql: (sql: string, parametros?: Parametros) => unknown;
      }) => void,
    ) => {
      banco.exec('BEGIN');
      try {
        escopo({executeSql: executar});
        banco.exec('COMMIT');
      } catch (erro) {
        banco.exec('ROLLBACK');
        throw erro;
      }
    },
  } as unknown as SQLiteDatabase;
}
