const express = require('express');
const router = express.Router();
const enrollmentService = require('../services/enrollmentService');
const { requireAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

// GET /api/enrollment/cart
router.get('/cart', requireAuth, async (req, res) => {
  try {
    const cart = await enrollmentService.getCart(req.user.userId);
    res.json(cart);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/enrollment/cart/:courseId — agregar al carrito
router.post('/cart/:courseId', requireAuth, async (req, res) => {
  try {
    const cart = await enrollmentService.addToCart(req.user.userId, req.params.courseId);
    res.json(cart);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// DELETE /api/enrollment/cart/:courseId
router.delete('/cart/:courseId', requireAuth, async (req, res) => {
  try {
    const cart = await enrollmentService.removeFromCart(req.user.userId, req.params.courseId);
    res.json(cart);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/enrollment/confirm — confirmar matrícula (US #21)
router.post('/confirm', requireAuth, async (req, res) => {
  try {
    const result = await enrollmentService.confirmEnrollment(req.user.userId);
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

// GET /api/enrollment/my-courses — mis cursos (US #22)
router.get('/my-courses', requireAuth, async (req, res) => {
  try {
    const courses = await enrollmentService.getEnrolledCourses(req.user.userId);
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/enrollment/:courseId/students — estudiantes del curso (US #27)
router.get('/:courseId/students', requireAuth, async (req, res) => {
  try {
    const students = await enrollmentService.getCourseStudentsForEnrolled(
      req.params.courseId, req.user.userId
    );
    res.json(students);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

module.exports = router;
