const express = require('express');
const router = express.Router();
const sectionService = require('../services/sectionService');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

// GET /api/sections/:courseId/tree — US #23
router.get('/:courseId/tree', requireAuth, async (req, res) => {
  try {
    const tree = await sectionService.getSectionTree(req.params.courseId);
    res.json(tree);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/sections/:courseId — agregar sección raíz
router.post('/:courseId', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  if (!req.body.title) return res.status(400).json({ error: 'Título requerido' });
  try {
    const section = await sectionService.addRootSection(req.params.courseId, req.body, req.user.userId);
    res.status(201).json(section);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

// POST /api/sections/:sectionId/subsection
router.post('/:sectionId/subsection', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  if (!req.body.title) return res.status(400).json({ error: 'Título requerido' });
  try {
    const section = await sectionService.addSubsection(req.params.sectionId, req.body, req.user.userId);
    res.status(201).json(section);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

// PUT /api/sections/:sectionId
router.put('/:sectionId', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  try {
    await sectionService.updateSection(req.params.sectionId, req.body, req.user.userId);
    res.json({ message: 'Sección actualizada' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// DELETE /api/sections/:sectionId
router.delete('/:sectionId', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  try {
    await sectionService.deleteSection(req.params.sectionId, req.user.userId);
    res.json({ message: 'Sección eliminada' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
