require('dotenv').config({ quiet: true });

const { loadConfig } = require('./config');
const { createApp } = require('./app');

const config = loadConfig();
const { app, db } = createApp(config);

const server = app.listen(config.port, () => {
  console.log(`FinançaConsciente API ouvindo na porta ${config.port}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
