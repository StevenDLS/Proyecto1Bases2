const express = require('express');
const router = express.Router();
const { getClient } = require('../config/cassandra');
const { getSession } = require('../config/neo4j');
const { client: redisClient } = require('../config/redis');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

// GET /api/admin/logs — logs del sistema (US #10)
router.get('/logs', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const client = getClient();
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const eventType = req.query.eventType;

    let query = `SELECT * FROM system_logs WHERE log_date = ? LIMIT 200`;
    const params = [date];

    const result = await client.execute(query, params, { prepare: true });
    let rows = result.rows;

    if (eventType) {
      rows = rows.filter(r => r.event_type === eventType);
    }

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/admin/logs/:userId — logs de un usuario específico
router.get('/logs/:userId', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const client = getClient();
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const result = await client.execute(
      `SELECT * FROM session_logs WHERE user_id = ? AND log_date = ? LIMIT 200`,
      [req.params.userId, date],
      { prepare: true }
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/admin/users — lista de usuarios
router.get('/users', requireAuth, requireRole('admin'), async (req, res) => {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (u:User) RETURN u.userId as userId, u.username as username, u.fullName as fullName, u.role as role, u.blocked as blocked, u.email as email ORDER BY u.createdAt DESC`
    );
    res.json(result.records.map(r => ({
      userId: r.get('userId'), username: r.get('username'),
      fullName: r.get('fullName'), role: r.get('role'),
      blocked: r.get('blocked'), email: r.get('email')
    })));
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  } finally {
    await session.close();
  }
});

// PUT /api/admin/users/:userId/block — bloquear/desbloquear usuario
router.put('/users/:userId/block', requireAuth, requireRole('admin'), async (req, res) => {
  const { username, blocked } = req.body;
  const session = getSession();
  try {
    await session.run(
      `MATCH (u:User {userId: $userId}) SET u.blocked = $blocked`,
      { userId: req.params.userId, blocked: !!blocked }
    );
    await redisClient.run(`SET ${username} "0"`);
    res.json({ message: blocked ? 'Usuario bloqueado' : 'Usuario desbloqueado' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  } finally {
    await session.close();
  }
});

module.exports = router;
