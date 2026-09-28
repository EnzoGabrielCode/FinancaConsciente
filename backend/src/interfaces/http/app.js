const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const buildRoutes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');

function createApp(dependencies) {
  const app = express();

  app.use(helmet()); // inclui Strict-Transport-Security (HSTS)
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', buildRoutes(dependencies));
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
