const { client: redisClient } = require('../config/redis');

const requireAuth = async (req, res, next) => {
  const sessionId = req.cookies.sessionId;
  if (!sessionId) return res.status(401).json({ error: 'No autenticado' });

  const data = await redisClient.get(`session:${sessionId}`);
  if (!data) return res.status(401).json({ error: 'Sesión inválida o expirada' });

  req.user = JSON.parse(data);
  req.sessionId = sessionId;
  next();
};

module.exports = { requireAuth };
