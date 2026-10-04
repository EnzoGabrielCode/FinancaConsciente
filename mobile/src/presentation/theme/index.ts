import {MD3DarkTheme, configureFonts, type MD3Theme} from 'react-native-paper';

import {CORES} from './cores';
import {FONTES} from './fontes';

export {FONTES} from './fontes';

// Com fonte própria o peso vem do arquivo; fontWeight acima de '400'
// faria o Android aplicar negrito sintético por cima.
const TITULO = {fontFamily: FONTES.seminegrito, fontWeight: '400'} as const;

const base = configureFonts({config: {fontFamily: FONTES.regular}});

const fontes = {
  ...base,
  titleLarge: {...base.titleLarge, ...TITULO},
  titleMedium: {...base.titleMedium, ...TITULO},
  titleSmall: {...base.titleSmall, ...TITULO},
  labelLarge: {...base.labelLarge, ...TITULO},
  labelMedium: {...base.labelMedium, ...TITULO},
  labelSmall: {...base.labelSmall, ...TITULO},
};

export const darkTheme: MD3Theme = {
  ...MD3DarkTheme,
  dark: true,
  fonts: fontes,
  colors: {
    ...MD3DarkTheme.colors,
    primary: CORES.verde,
    onPrimary: CORES.fundo,
    primaryContainer: 'rgba(57,255,132,0.15)',
    onPrimaryContainer: CORES.verde,
    secondary: CORES.azul,
    background: CORES.fundo,
    surface: CORES.superficie,
    surfaceVariant: CORES.superficie2,
    onSurface: CORES.texto,
    onSurfaceVariant: CORES.textoSecundario,
    outline: 'rgba(255,255,255,0.08)',
    outlineVariant: CORES.borda,
    error: CORES.vermelho,
    onError: CORES.fundo,
    inverseSurface: CORES.superficie3,
    inverseOnSurface: CORES.texto,
    inversePrimary: CORES.verde,
    backdrop: 'rgba(0,0,0,0.7)',
    surfaceDisabled: CORES.realceForte,
    onSurfaceDisabled: CORES.textoApagado,
    elevation: {
      level0: 'transparent',
      level1: CORES.superficie,
      level2: '#222222',
      level3: CORES.superficie2,
      level4: '#292929',
      level5: CORES.superficie3,
    },
  },
};

// Snackbar do Figma: superfície #2C2C2C e texto em Outfit Medium.
export const TEMA_SNACKBAR = {
  colors: {inverseSurface: CORES.superficie3, inverseOnSurface: CORES.texto},
  fonts: {
    ...fontes,
    bodyMedium: {...fontes.bodyMedium, fontFamily: FONTES.medio},
  },
};

export const ESTILO_SNACKBAR = {
  borderRadius: 14,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.08)',
} as const;
