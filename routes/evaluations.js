const express = require('express');
const router = express.Router();
const evalService = require('../services/evaluationService');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

// POST /api/evaluations/:courseId — crear evaluación (US #14)
router.post('/:courseId', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  const { title, startDate, endDate, questions } = req.body;
  if (!title || !startDate || !endDate || !questions || questions.length === 0) {
    return res.status(400).json({ error: 'Título, fechas y preguntas son requeridos' });
  }
  try {
    const evaluation = await evalService.createEvaluation(req.body, req.params.courseId);
    res.status(201).json(evaluation);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/evaluations/:courseId — listar evaluaciones del curso
router.get('/:courseId', requireAuth, async (req, res) => {
  try {
    const evaluations = await evalService.getEvaluationsByCourse(req.params.courseId);
    res.json(evaluations);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/evaluations/detail/:evaluationId — ver evaluación
router.get('/detail/:evaluationId', requireAuth, async (req, res) => {
  try {
    const isTeacher = req.user.role === 'teacher' || req.user.role === 'admin';
    const evaluation = await evalService.getEvaluationById(req.params.evaluationId, isTeacher);
    if (!evaluation) return res.status(404).json({ error: 'Evaluación no encontrada' });
    res.json(evaluation);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/evaluations/submit/:evaluationId — enviar respuestas (US #24)
router.post('/submit/:evaluationId', requireAuth, requireRole('student', 'admin'), async (req, res) => {
  const { answers, courseId } = req.body;
  if (!answers || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'Respuestas requeridas' });
  }
  try {
    const result = await evalService.submitEvaluation(
      req.params.evaluationId, req.user.userId, answers, courseId
    );
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

// GET /api/evaluations/results/:courseId/me — mis resultados (US #25)
router.get('/results/:courseId/me', requireAuth, async (req, res) => {
  try {
    const results = await evalService.getStudentResults(req.user.userId, req.params.courseId);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
