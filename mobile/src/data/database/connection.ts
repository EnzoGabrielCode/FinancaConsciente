import SQLite, {SQLiteDatabase} from 'react-native-sqlite-storage';
import {migrations} from './migrations';

SQLite.enablePromise(true);

const DATABASE_NAME = 'financaconsciente.db';

let instance: SQLiteDatabase | null = null;

async function runMigrations(db: SQLiteDatabase): Promise<number> {
  const [result] = await db.executeSql('PRAGMA user_version');
  const currentVersion: number = result.rows.item(0).user_version;

  for (let version = currentVersion; version < migrations.length; version++) {
    await db.transaction(tx => {
      migrations[version].forEach(sql => tx.executeSql(sql));
    });
    await db.executeSql(`PRAGMA user_version = ${version + 1}`);
  }
  return migrations.length;
}

/** Abre (uma única vez) o banco SQLite local e aplica as migrações pendentes. */
export async function getDatabase(): Promise<SQLiteDatabase> {
  if (!instance) {
    const db = await SQLite.openDatabase({
      name: DATABASE_NAME,
      location: 'default',
    });
    await runMigrations(db);
    instance = db;
  }
  return instance;
}

export async function getSchemaVersion(): Promise<number> {
  const db = await getDatabase();
  const [result] = await db.executeSql('PRAGMA user_version');
  return result.rows.item(0).user_version;
}
