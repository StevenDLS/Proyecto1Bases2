const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const authService = require('../services/authService');
const { requireAuth } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../services/emailService');

// POST /api/auth/register — US #1
router.post('/register',
  body('username').trim().notEmpty().withMessage('Usuario requerido'),
  body('password')
    .isLength({ min: 8 }).withMessage('Mínimo 8 caracteres')
    .matches(/[A-Z]/).withMessage('Debe tener al menos una mayúscula')
    .matches(/[0-9]/).withMessage('Debe tener al menos un número'),
  body('fullName').trim().notEmpty().withMessage('Nombre completo requerido'),
  body('birthDate').notEmpty().withMessage('Fecha de nacimiento requerida'),
  body('email').isEmail().withMessage('Email inválido'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { avatarFileId } = req.body;
      const user = await authService.registerUser({ ...req.body, avatarFileId: avatarFileId || null });
      res.status(201).json({ message: 'Usuario registrado', user });
    } catch (err) {
      if (err.message && err.message.includes('already exists')) {
        return res.status(409).json({ error: 'Usuario o email ya existe' });
      }
      console.error(err);
      res.status(500).json({ error: 'Error interno' });
    }
  }
);

// POST /api/auth/login — US #2, #3, #4
router.post('/login', async (req, res) => {
  const { username, password, rememberMe } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña requeridos' });

  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const device = req.headers['user-agent'] || 'unknown';

  try {
    const { sessionId, user } = await authService.loginUser(username, password, ip, device);

    /*
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      maxAge: (parseInt(process.env.SESSION_TTL_SECONDS) || 86400) * 1000
    });
    
    if (rememberMe) {
      const token = await authService.createRememberToken(user.userId, user.username);
      res.cookie('rememberToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: (parseInt(process.env.REMEMBER_ME_TTL_SECONDS) || 2592000) * 1000
      });
    }
    */

    res.json({ message: 'Sesión iniciada', user });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Error interno' });
  }
});

// POST /api/auth/logout — US #5
router.post('/logout', requireAuth, async (req, res) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const device = req.headers['user-agent'] || 'unknown';
  try {
    await authService.logoutUser(req.sessionId, req.user.userId, req.user.username, ip, device);
    res.clearCookie('sessionId');
    res.clearCookie('rememberToken');
    res.json({ message: 'Sesión cerrada' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/auth/forgot-password — US #7
router.post('/forgot-password', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Usuario requerido' });
  try {
    const result = await authService.generateResetToken(username);
    if (result) {
      const resetLink = `${req.protocol}://${req.get('host')}/reset-password.html?token=${result.token}`;
      sendPasswordResetEmail(result.email, resetLink).catch(() => {});
    }
    // Siempre responder lo mismo para no revelar si el usuario existe
    res.json({ message: 'Si el usuario existe, recibirás un correo con las instrucciones.' });
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/auth/reset-password — US #7
router.post('/reset-password',
  body('token').notEmpty(),
  body('newPassword')
    .isLength({ min: 8 })
    .matches(/[A-Z]/)
    .matches(/[0-9]/),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      await authService.resetPassword(req.body.token, req.body.newPassword);
      res.json({ message: 'Contraseña restablecida correctamente' });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message || 'Error interno' });
    }
  }
);

// PUT /api/auth/change-password — US #8
router.put('/change-password', requireAuth,
  body('currentPassword').notEmpty(),
  body('newPassword')
    .isLength({ min: 8 })
    .matches(/[A-Z]/)
    .matches(/[0-9]/),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      await authService.changePassword(req.user.userId, req.body.currentPassword, req.body.newPassword);
      res.json({ message: 'Contraseña actualizada' });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message || 'Error interno' });
    }
  }
);

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
