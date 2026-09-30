import {MD3DarkTheme, MD3LightTheme, type MD3Theme} from 'react-native-paper';

/**
 * Temas Material Design 3 (RNF05). Parte da paleta base do Paper e troca a
 * cor primária por tons de verde (semente #006E1C), gerados no padrão M3.
 */
export const lightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#006E1C',
    onPrimary: '#FFFFFF',
    primaryContainer: '#94F990',
    onPrimaryContainer: '#002204',
  },
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#78DC77',
    onPrimary: '#00390A',
    primaryContainer: '#005313',
    onPrimaryContainer: '#94F990',
  },
};

/** Tema que acompanha o modo claro/escuro do sistema (RF56). */
export function themeFor(colorScheme: string | null | undefined): MD3Theme {
  return colorScheme === 'dark' ? darkTheme : lightTheme;
}
