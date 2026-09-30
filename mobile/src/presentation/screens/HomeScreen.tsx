import React from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Avatar,
  Button,
  Card,
  Text,
  useTheme,
} from 'react-native-paper';

import {DATABASE_NAME} from '../../data/database/connection';
import {useDatabase} from '../hooks/useDatabase';

function DatabaseIcon(props: {size: number}): React.JSX.Element {
  return <Avatar.Icon {...props} icon="database" />;
}

function HomeScreen(): React.JSX.Element {
  const theme = useTheme();
  const database = useDatabase();

  return (
    <>
      <Appbar.Header elevated>
        <Appbar.Content title="FinançaConsciente" />
      </Appbar.Header>

      <ScrollView
        style={{backgroundColor: theme.colors.background}}
        contentContainerStyle={styles.content}>
        <Text variant="headlineSmall">Bem-vindo(a)!</Text>
        <Text
          variant="bodyMedium"
          style={{color: theme.colors.onSurfaceVariant}}>
          Seus dados financeiros ficam salvos no aparelho e funcionam mesmo sem
          internet.
        </Text>

        <Card mode="contained" testID="database-card">
          <Card.Title
            title="Banco de dados local"
            subtitle={DATABASE_NAME}
            left={DatabaseIcon}
          />
          <Card.Content>
            {database.status === 'carregando' && (
              <ActivityIndicator accessibilityLabel="Abrindo banco de dados" />
            )}
            {database.status === 'pronto' && (
              <Text variant="bodyLarge" testID="database-status">
                Banco pronto (schema v{database.schemaVersion})
              </Text>
            )}
            {database.status === 'erro' && (
              <Text
                variant="bodyLarge"
                style={{color: theme.colors.error}}
                testID="database-status">
                Não foi possível abrir o banco: {database.message}
              </Text>
            )}
          </Card.Content>
          {database.status === 'erro' && (
            <Card.Actions>
              <Button onPress={database.retry}>Tentar novamente</Button>
            </Card.Actions>
          )}
        </Card>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 16,
  },
});

export default HomeScreen;
