/* eslint-env jest */
jest.mock('react-native-sqlite-storage', () => {
  let userVersion = 0;
  const db = {
    executeSql: jest.fn(async sql => {
      const set = sql.match(/PRAGMA user_version = (\d+)/);
      if (set) {
        userVersion = Number(set[1]);
      }
      return [{rows: {item: () => ({user_version: userVersion})}}];
    }),
    transaction: jest.fn(async fn => fn({executeSql: jest.fn()})),
  };
  return {
    enablePromise: jest.fn(),
    openDatabase: jest.fn(async () => db),
  };
});

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
