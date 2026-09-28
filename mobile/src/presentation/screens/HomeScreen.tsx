import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {ActivityIndicator, Card, Text} from 'react-native-paper';
import {getSchemaVersion} from '../../data/database/connection';

type Estado =
  | {status: 'carregando'}
  | {status: 'pronto'; versao: number}
  | {status: 'erro'; mensagem: string};

export default function HomeScreen() {
  const [estado, setEstado] = useState<Estado>({status: 'carregando'});

  useEffect(() => {
    getSchemaVersion()
      .then(versao => setEstado({status: 'pronto', versao}))
      .catch((e: Error) => setEstado({status: 'erro', mensagem: e.message}));
  }, []);

  return (
    <View style={styles.container}>
      <Text variant="headlineMedium">FinançaConsciente</Text>
      <Card style={styles.card}>
        <Card.Title title="Banco local (SQLite)" />
        <Card.Content>
          {estado.status === 'carregando' && <ActivityIndicator />}
          {estado.status === 'pronto' && (
            <Text>Pronto para uso offline. Schema v{estado.versao}.</Text>
          )}
          {estado.status === 'erro' && <Text>Erro: {estado.mensagem}</Text>}
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: 16, gap: 16},
  card: {marginTop: 8},
});
