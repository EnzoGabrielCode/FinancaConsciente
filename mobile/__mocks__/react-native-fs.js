const RNFS = {
  DocumentDirectoryPath: '/docs',
  mkdir: jest.fn(async () => {}),
  exists: jest.fn(async () => false),
  copyFile: jest.fn(async () => {}),
  unlink: jest.fn(async () => {}),
};

module.exports = RNFS;
module.exports.default = RNFS;
