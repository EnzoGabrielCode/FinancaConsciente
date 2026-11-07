require('dotenv').config({ quiet: true });

const { loadConfig } = require('./config');
const { createApp } = require('./app');

const config = loadConfig();
const { app, db, logger } = createApp(config);

// No Express 5 o callback do listen também recebe os erros de inicialização.
const server = app.listen(config.port, (err) => {
  if (err) return crash('falha ao iniciar a API', err);
  return logger.info('API ouvindo', { port: config.port });
});

function shutdown() {
  logger.info('encerrando');
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

function crash(message, error) {
  logger.error(message, { error });
  process.exit(1);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', (reason) => crash('rejeição não tratada', reason));
process.on('uncaughtException', (err) => crash('exceção não capturada', err));
