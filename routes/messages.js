const express = require('express');
const router = express.Router();
const messageService = require('../services/messageService');
const { requireAuth } = require('../middleware/auth');

// GET /api/messages — lista de hilos
router.get('/', requireAuth, async (req, res) => {
  try {
    const threads = await messageService.getThreads(req.user.userId);
    res.json(threads);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/messages — crear nuevo hilo
router.post('/', requireAuth, async (req, res) => {
  const { recipientIds, subject, content } = req.body;
  if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0 || !content) {
    return res.status(400).json({ error: 'Destinatarios y contenido requeridos' });
  }
  try {
    const thread = await messageService.createThread(
      req.user.userId, recipientIds, subject || '(sin asunto)', content
    );
    res.status(201).json(thread);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/messages/:threadId — ver hilo
router.get('/:threadId', requireAuth, async (req, res) => {
  try {
    const thread = await messageService.getThread(req.params.threadId, req.user.userId);
    res.json(thread);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

// POST /api/messages/:threadId/reply — responder
router.post('/:threadId/reply', requireAuth, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Contenido requerido' });
  try {
    const thread = await messageService.replyToThread(req.params.threadId, req.user.userId, content);
    res.status(201).json(thread);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

module.exports = router;
