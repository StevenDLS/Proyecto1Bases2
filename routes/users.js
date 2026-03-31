const express = require('express');
const router = express.Router();
const userService = require('../services/userService');
const { requireAuth } = require('../middleware/auth');

// GET /api/users/search — US #29
router.get('/search', requireAuth, async (req, res) => {
  try {
    const users = await userService.searchUsers(req.query.q || '');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/users/me/friends — mis amigos
router.get('/me/friends', requireAuth, async (req, res) => {
  try {
    const friends = await userService.getFriends(req.user.userId);
    res.json(friends);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/users/me/friend-requests — solicitudes pendientes
router.get('/me/friend-requests', requireAuth, async (req, res) => {
  try {
    const requests = await userService.getPendingRequests(req.user.userId);
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/users/:userId — ver perfil
router.get('/:userId', requireAuth, async (req, res) => {
  try {
    const profile = await userService.getUserProfile(req.params.userId, req.user.userId);
    if (!profile) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/users/:userId/friend-request
router.post('/:userId/friend-request', requireAuth, async (req, res) => {
  if (req.params.userId === req.user.userId) {
    return res.status(400).json({ error: 'No puedes enviarte una solicitud a ti mismo' });
  }
  try {
    await userService.sendFriendRequest(req.user.userId, req.params.userId);
    res.json({ message: 'Solicitud enviada' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

// POST /api/users/:userId/accept-friend — US #28
router.post('/:userId/accept-friend', requireAuth, async (req, res) => {
  try {
    // req.params.userId es quien envió la solicitud, req.user es quien acepta
    await userService.acceptFriendRequest(req.params.userId, req.user.userId);
    res.json({ message: 'Solicitud aceptada' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

module.exports = router;
