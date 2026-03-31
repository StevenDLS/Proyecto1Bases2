const express = require('express');
const multer = require('multer');
const router = express.Router();
const fileService = require('../services/fileService');
const { requireAuth } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

// POST /api/files/upload
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });
  try {
    const fileId = await fileService.uploadFile(
      req.file.buffer, req.file.originalname, req.file.mimetype
    );
    res.status(201).json({ fileId: fileId.toString(), filename: req.file.originalname });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/files/:fileId
router.get('/:fileId', async (req, res) => {
  try {
    await fileService.getFile(req.params.fileId, res);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

module.exports = router;
