const RNFS = {
  DocumentDirectoryPath: '/docs',
  CachesDirectoryPath: '/cache',
  readDir: jest.fn(async () => []),
  writeFile: jest.fn(async () => {}),
  mkdir: jest.fn(async () => {}),
  exists: jest.fn(async () => false),
  copyFile: jest.fn(async () => {}),
  unlink: jest.fn(async () => {}),
};

module.exports = RNFS;
module.exports.default = RNFS;
