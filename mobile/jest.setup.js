import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

jest.mock('react-native-sqlite-storage');

jest.mock('react-native-image-picker');

jest.mock('react-native-fs');
