import React from 'react';
import {StatusBar} from 'react-native';
import {PaperProvider} from 'react-native-paper';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {FsArmazenamentoComprovantes} from './src/data/arquivos/FsArmazenamentoComprovantes';
import {getDatabase} from './src/data/database/connection';
import {SqliteCofreRepository} from './src/data/repositories/SqliteCofreRepository';
import {SqliteContaRecorrenteRepository} from './src/data/repositories/SqliteContaRecorrenteRepository';
import {SqliteOrcamentoRepository} from './src/data/repositories/SqliteOrcamentoRepository';
import {SqliteTransacaoRepository} from './src/data/repositories/SqliteTransacaoRepository';
import {NotifeeNotificador} from './src/data/servicos/NotifeeNotificador';
import HomeScreen from './src/presentation/screens/HomeScreen';
import {darkTheme} from './src/presentation/theme';
import {CORES} from './src/presentation/theme/cores';

const obterBanco = async () => (await getDatabase()).db;
const repositorio = new SqliteTransacaoRepository(obterBanco);
const repositorioCofres = new SqliteCofreRepository(obterBanco);
const repositorioOrcamentos = new SqliteOrcamentoRepository(obterBanco);
const repositorioContas = new SqliteContaRecorrenteRepository(obterBanco);
const notificador = new NotifeeNotificador();
const armazenamento = new FsArmazenamentoComprovantes();

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={darkTheme}>
        <StatusBar barStyle="light-content" backgroundColor={CORES.fundo} />
        <HomeScreen
          repositorio={repositorio}
          armazenamento={armazenamento}
          repositorioCofres={repositorioCofres}
          repositorioOrcamentos={repositorioOrcamentos}
          repositorioContas={repositorioContas}
          notificador={notificador}
        />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

export default App;
