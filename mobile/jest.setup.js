/* eslint-env jest */
import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

// O módulo nativo do SQLite não existe no Jest: usa o mock em __mocks__/.
jest.mock('react-native-sqlite-storage');
