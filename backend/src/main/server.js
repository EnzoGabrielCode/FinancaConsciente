const config = require('./config');
const { buildApp } = require('./container');

const { app } = buildApp(config);

app.listen(config.port, () => {
  console.log(`API FinançaConsciente rodando em http://localhost:${config.port}/api`);
});
