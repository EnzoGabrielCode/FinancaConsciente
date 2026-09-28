import {MD3DarkTheme, MD3LightTheme, MD3Theme} from 'react-native-paper';

const brand = {
  primary: '#2E7D32',
  secondary: '#00897B',
};

export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {...MD3LightTheme.colors, ...brand},
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {...MD3DarkTheme.colors, primary: '#81C784', secondary: '#4DB6AC'},
};
