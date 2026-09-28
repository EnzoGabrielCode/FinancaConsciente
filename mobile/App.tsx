import React from 'react';
import {StatusBar, StyleSheet, useColorScheme} from 'react-native';
import {PaperProvider} from 'react-native-paper';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import HomeScreen from './src/presentation/screens/HomeScreen';
import {darkTheme, lightTheme} from './src/presentation/theme';

function App(): React.JSX.Element {
  const isDark = useColorScheme() === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={theme.colors.background}
        />
        <SafeAreaView
          style={[styles.root, {backgroundColor: theme.colors.background}]}>
          <HomeScreen />
        </SafeAreaView>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
});

export default App;
