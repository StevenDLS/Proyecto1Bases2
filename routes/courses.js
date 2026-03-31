const express = require('express');
const router = express.Router();
const courseService = require('../services/courseService');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

// GET /api/courses/search — US #20
router.get('/search', requireAuth, async (req, res) => {
  try {
    const courses = await courseService.searchCourses(req.query.q || '');
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/courses/my — US #18
router.get('/my', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const courses = await courseService.getCoursesByTeacher(req.user.userId);
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/courses — US #11
router.post('/', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  const { code, name, description, startDate, endDate, photoFileId } = req.body;
  if (!code || !name || !startDate) return res.status(400).json({ error: 'Código, nombre y fecha de inicio son requeridos' });
  try {
    const course = await courseService.createCourse(req.body, req.user.userId);
    res.status(201).json(course);
  } catch (err) {
    if (err.message && err.message.includes('already exists')) {
      return res.status(409).json({ error: 'Código de curso ya existe' });
    }
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/courses/:courseId
router.get('/:courseId', requireAuth, async (req, res) => {
  try {
    const course = await courseService.getCourseById(req.params.courseId);
    if (!course) return res.status(404).json({ error: 'Curso no encontrado' });
    // Si no es el docente, solo ver si está publicado
    if (!course.published && course.teacherId !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Curso no publicado' });
    }
    res.json(course);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// PUT /api/courses/:courseId
router.put('/:courseId', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const course = await courseService.updateCourse(req.params.courseId, req.body, req.user.userId);
    res.json(course);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

// POST /api/courses/:courseId/publish — US #15
router.post('/:courseId/publish', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const course = await courseService.publishCourse(req.params.courseId, req.user.userId);
    res.json(course);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

// POST /api/courses/:courseId/clone — US #19
router.post('/:courseId/clone', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  const { code, name, startDate, endDate } = req.body;
  if (!code || !name || !startDate) return res.status(400).json({ error: 'Código, nombre y fecha de inicio son requeridos' });
  try {
    const result = await courseService.cloneCourse(req.params.courseId, req.body, req.user.userId);
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

// GET /api/courses/:courseId/students — US #16
router.get('/:courseId/students', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const students = await courseService.getCourseStudents(req.params.courseId, req.user.userId);
    res.json(students);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

module.exports = router;
