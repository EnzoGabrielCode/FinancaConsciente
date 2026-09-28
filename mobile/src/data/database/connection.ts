import SQLite, {type SQLiteDatabase} from 'react-native-sqlite-storage';

import {runMigrations} from './migrations';

SQLite.enablePromise(true);

export const DATABASE_NAME = 'financaconsciente.db';

export interface DatabaseInfo {
  db: SQLiteDatabase;
  schemaVersion: number;
}

let connection: Promise<DatabaseInfo> | null = null;

async function open(): Promise<DatabaseInfo> {
  const db = await SQLite.openDatabase({
    name: DATABASE_NAME,
    location: 'default',
  });
  await db.executeSql('PRAGMA foreign_keys = ON');
  const schemaVersion = await runMigrations(db);
  return {db, schemaVersion};
}

/**
 * Abre o banco local (uma única vez por execução do app) e aplica as
 * migrações pendentes. Chamadas concorrentes recebem a mesma conexão.
 */
export function getDatabase(): Promise<DatabaseInfo> {
  if (!connection) {
    connection = open().catch(error => {
      connection = null; // permite tentar de novo
      throw error;
    });
  }
  return connection;
}

export async function closeDatabase(): Promise<void> {
  if (!connection) {
    return;
  }
  const pending = connection;
  connection = null;
  const {db} = await pending;
  await db.close();
}
