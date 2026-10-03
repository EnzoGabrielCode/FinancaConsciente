const launchCamera = jest.fn(async () => ({didCancel: true}));
const launchImageLibrary = jest.fn(async () => ({didCancel: true}));

module.exports = {launchCamera, launchImageLibrary};
