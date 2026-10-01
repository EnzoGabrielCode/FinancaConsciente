const { Router } = require('express');

/**
 * Tabela de rotas da API. Recebe controllers e middlewares já montados
 * pelo composition root (src/main/app.js).
 */
function createRoutes({ authController, userController, requireAuth }) {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  router.post('/auth/register', authController.register);
  router.post('/auth/login', authController.login);

  router.get('/me', requireAuth, userController.me);

  return router;
}

module.exports = { createRoutes };
