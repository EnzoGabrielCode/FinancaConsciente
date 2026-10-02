import React from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import {PaperProvider} from 'react-native-paper';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {FsArmazenamentoComprovantes} from './src/data/arquivos/FsArmazenamentoComprovantes';
import {getDatabase} from './src/data/database/connection';
import {SqliteTransacaoRepository} from './src/data/repositories/SqliteTransacaoRepository';
import HomeScreen from './src/presentation/screens/HomeScreen';
import {themeFor} from './src/presentation/theme';

const repositorio = new SqliteTransacaoRepository(
  async () => (await getDatabase()).db,
);
const armazenamento = new FsArmazenamentoComprovantes();

function App(): React.JSX.Element {
  const colorScheme = useColorScheme();
  const theme = themeFor(colorScheme);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar
          barStyle={theme.dark ? 'light-content' : 'dark-content'}
          backgroundColor={theme.colors.elevation.level2}
        />
        <HomeScreen repositorio={repositorio} armazenamento={armazenamento} />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

export default App;
