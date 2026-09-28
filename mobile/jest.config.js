module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest/setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-paper|react-native-vector-icons|react-native-safe-area-context)/)',
  ],
};
