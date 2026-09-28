const { Router } = require('express');

function buildRoutes({ authController, userRepository, authMiddleware }) {
  const router = Router();

  router.get('/health', (_req, res) => res.json({ status: 'ok' }));

  router.post('/auth/register', authController.register);
  router.post('/auth/login', authController.login);

  // Exemplo de rota protegida por JWT (Definition of Done, item 3)
  router.get('/me', authMiddleware, (req, res) => {
    res.json({ user: userRepository.findById(req.userId) });
  });

  return router;
}

module.exports = buildRoutes;
