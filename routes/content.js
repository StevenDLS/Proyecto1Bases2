const express = require('express');
const multer = require('multer');
const router = express.Router();
const contentService = require('../services/contentService');
const fileService = require('../services/fileService');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const upload = multer({ storage: multer.memoryStorage() });

// GET /api/content/:sectionId — US #23
router.get('/:sectionId', requireAuth, async (req, res) => {
  try {
    const items = await contentService.getContent(req.params.sectionId);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' }); 
  }
});

// PUT /api/content/:sectionId — reemplazar contenido completo (solo text items)
router.put('/:sectionId', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  try {
    await contentService.updateContent(req.params.sectionId, req.body.items || []);
    res.json({ message: 'Contenido actualizado' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/content/:sectionId/upload — subir archivo
router.post('/:sectionId/upload', requireAuth, requireRole('teacher', 'admin'),
  upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' });
    try {
      const { type, order } = req.body;
      const allowedTypes = ['document', 'video', 'image'];
      if (!allowedTypes.includes(type)) return res.status(400).json({ error: 'Tipo inválido' });

      const fileId = await fileService.uploadFile(
        req.file.buffer, req.file.originalname, req.file.mimetype
      );
      await contentService.addFileItem(req.params.sectionId, type, fileId, req.file.originalname, parseInt(order) || 0);
      res.status(201).json({ fileId: fileId.toString(), filename: req.file.originalname });
    } catch (err) {
      res.status(500).json({ error: 'Error interno' });
    }
  }
);

module.exports = router;
