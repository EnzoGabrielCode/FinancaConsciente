module.exports = {
  presets: ['module:@react-native/babel-preset'],
  env: {
    production: {
      // Importa só os componentes usados do react-native-paper (APK menor).
      plugins: ['react-native-paper/babel'],
    },
  },
};
