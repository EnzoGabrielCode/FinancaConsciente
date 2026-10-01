function createMockDatabase({userVersion = 0} = {}) {
  const db = {
    userVersion,
    lastInsertId: 0,
    executed: [],
    run(sql) {
      db.executed.push(sql);
      const setVersion = /^PRAGMA user_version\s*=\s*(\d+)/i.exec(sql);
      if (setVersion) {
        db.userVersion = Number(setVersion[1]);
      }
      const rows = /^PRAGMA user_version$/i.test(sql)
        ? [{user_version: db.userVersion}]
        : [];
      const insertId = /^\s*INSERT/i.test(sql) ? ++db.lastInsertId : undefined;
      return {
        rows: {length: rows.length, item: i => rows[i], raw: () => rows},
        rowsAffected: 0,
        insertId,
      };
    },
    executeSql: jest.fn(async sql => [db.run(sql)]),
    transaction: jest.fn(async scope => {
      const snapshot = {
        executed: db.executed.length,
        userVersion: db.userVersion,
      };
      const tx = {executeSql: jest.fn(sql => db.run(sql))};
      try {
        scope(tx);
      } catch (error) {
        db.executed.length = snapshot.executed;
        db.userVersion = snapshot.userVersion;
        throw error;
      }
      return tx;
    }),
    close: jest.fn(async () => {}),
  };
  return db;
}

const SQLite = {
  enablePromise: jest.fn(),
  openDatabase: jest.fn(async () => createMockDatabase()),
  createMockDatabase,
};

module.exports = SQLite;
module.exports.default = SQLite;
