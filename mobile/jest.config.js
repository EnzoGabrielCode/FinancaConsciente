module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Dados de apoio dos testes, sem casos próprios.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/__tests__/fixtures/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-paper|react-native-vector-icons|react-native-safe-area-context|@notifee/react-native|@react-native-ml-kit/text-recognition|@react-native-community/datetimepicker)/)',
  ],
};
