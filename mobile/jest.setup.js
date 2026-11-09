import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);

jest.mock('react-native-sqlite-storage');

jest.mock('react-native-image-picker');

jest.mock('react-native-fs');

jest.mock('@notifee/react-native', () =>
  require('@notifee/react-native/jest-mock'),
);

jest.mock('@react-native-ml-kit/text-recognition', () => ({
  __esModule: true,
  default: {recognize: jest.fn()},
}));

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: () => null,
  DateTimePickerAndroid: {open: jest.fn(), dismiss: jest.fn()},
}));

jest.mock('react-native-share', () => ({
  __esModule: true,
  default: {open: jest.fn(async () => ({success: true}))},
}));

jest.mock('react-native-document-picker', () => {
  const isCancel = erro => erro?.code === 'DOCUMENT_PICKER_CANCELED';
  const picker = {
    pickSingle: jest.fn(),
    isCancel: jest.fn(isCancel),
    types: {allFiles: '*/*'},
  };
  return {__esModule: true, default: picker, ...picker};
});

require('@shopify/flash-list/jestSetup');
