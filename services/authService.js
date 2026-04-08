const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { getSession } = require('../config/neo4j');
const { client: redisClient } = require('../config/redis');
const { logEvent, logAudit } = require('./logService');
const { sendBlockedNotification, sendSuspiciousActivity, sendPasswordResetEmail } = require('./emailService');

const SESSION_TTL = parseInt(process.env.SESSION_TTL_SECONDS) || 86400;
const REMEMBER_TTL = parseInt(process.env.REMEMBER_ME_TTL_SECONDS) || 2592000;
const RESET_TTL = parseInt(process.env.RESET_TOKEN_TTL_SECONDS) || 900;
const LOCK_TTL = parseInt(process.env.LOCK_TTL_SECONDS) || 900;
const MAX_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;

const registerUser = async ({ username, password, fullName, birthDate, email, role, avatarFileId }) => {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);
  const userId = uuidv4();
  const now = new Date().toISOString();

  const session = getSession();
  try {
    await session.run(
      `CREATE (u:User {
        userId: $userId, username: $username, passwordHash: $passwordHash, salt: $salt,
        fullName: $fullName, birthDate: $birthDate, email: $email, role: $role,
        avatarFileId: $avatarFileId, blocked: false, blockedUntil: null, createdAt: $now
      })`,
      { userId, username, passwordHash, salt, fullName, birthDate, email,
        role: role || 'student', avatarFileId: avatarFileId || null, now }
    );
    await logAudit('User', userId, 'CREATE', userId, null, { userId, username, role });
    return { userId, username, role: role || 'student' };
  } finally {
    await session.close();
  }
};

const loginUser = async (username, password, ip, device) => {
  // 1. Verificar bloqueo
  const locked = await redisClient.get(`locked:${username}`);
  if (locked) {
    const err = new Error('Cuenta bloqueada temporalmente. Intenta de nuevo más tarde.');
    err.status = 403;
    throw err;
  }

  // 2. Buscar usuario en Neo4j
  const session = getSession();
  let user;
  try {
    const result = await session.run(
      `MATCH (u:User {username: $username}) RETURN u`,
      { username }
    );
    if (result.records.length === 0) {
      await _handleFailedAttempt(username, ip, device, null, null);
      const err = new Error('Credenciales inválidas');
      err.status = 401;
      throw err;
    }
    user = result.records[0].get('u').properties;
  } finally {
    await session.close();
  }

  // 3. Verificar hash
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    await _handleFailedAttempt(username, ip, device, user.userId, user.email);
    const err = new Error('Credenciales inválidas');
    err.status = 401;
    throw err;
  }

  // 4. Login exitoso — limpiar intentos
  await redisClient.del(`login_attempts:${username}`);

  /*
  // 5. Crear sesión en Redis
  const sessionId = uuidv4();
  const sessionData = {
    userId: user.userId,
    username: user.username,
    role: user.role,
    ip,
    device,
    createdAt: new Date().toISOString()
  };
  await redisClient.setEx(`session:${sessionId}`, SESSION_TTL, JSON.stringify(sessionData));

  // 6. Log
  await logEvent(user.userId, user.username, 'LOGIN_SUCCESS', ip, device, '');
  */

  return { sessionId, user: { userId: user.userId, username: user.username, role: user.role } };
};

const _handleFailedAttempt = async (username, ip, device, userId, email) => {
  const attemptsKey = `login_attempts:${username}`;
  const attempts = await redisClient.incr(attemptsKey);

  if (userId) {
    await logEvent(userId, username, 'LOGIN_FAIL', ip, device, `Intento ${attempts}`);
    // Actividad sospechosa desde primer intento
    if (email && attempts === 1) {
      sendSuspiciousActivity(email, username, ip, device).catch(() => {});
    }
  }

  if (attempts >= MAX_ATTEMPTS) {
    await redisClient.del(attemptsKey);
    await redisClient.setEx(`locked:${username}`, LOCK_TTL, '1');
    if (userId) {
      await logEvent(userId, username, 'BLOCKED', ip, device, `Bloqueado por ${MAX_ATTEMPTS} intentos fallidos`);
    }
    if (email) {
      sendBlockedNotification(email, username, ip).catch(() => {});
    }
  }
};

const createRememberToken = async (userId, username) => {
  const token = uuidv4();
  await redisClient.setEx(`remember:${token}`, REMEMBER_TTL, JSON.stringify({ userId, username }));
  return token;
};

const validateRememberToken = async (token) => {
  const data = await redisClient.get(`remember:${token}`);
  return data ? JSON.parse(data) : null;
};

const logoutUser = async (sessionId, userId, username, ip, device) => {
  await redisClient.del(`session:${sessionId}`);
  await logEvent(userId, username, 'LOGOUT', ip, device, '');
};

const generateResetToken = async (username) => {
  const session = getSession();
  let user;
  try {
    const result = await session.run(
      `MATCH (u:User {username: $username}) RETURN u`,
      { username }
    );
    if (result.records.length === 0) return null;
    user = result.records[0].get('u').properties;
  } finally {
    await session.close();
  }

  const token = uuidv4();
  await redisClient.setEx(`reset:${token}`, RESET_TTL, JSON.stringify({ userId: user.userId }));
  return { token, email: user.email };
};

const resetPassword = async (token, newPassword) => {
  const data = await redisClient.get(`reset:${token}`);
  if (!data) {
    const err = new Error('Token inválido o expirado');
    err.status = 400;
    throw err;
  }
  const { userId } = JSON.parse(data);

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(newPassword, salt);

  const session = getSession();
  try {
    await session.run(
      `MATCH (u:User {userId: $userId}) SET u.passwordHash = $passwordHash, u.salt = $salt`,
      { userId, passwordHash, salt }
    );
  } finally {
    await session.close();
  }

  await redisClient.del(`reset:${token}`);
  await logAudit('User', userId, 'UPDATE', userId, null, { action: 'reset_password' });
};

const changePassword = async (userId, currentPassword, newPassword) => {
  const session = getSession();
  let user;
  try {
    const result = await session.run(
      `MATCH (u:User {userId: $userId}) RETURN u`,
      { userId }
    );
    if (result.records.length === 0) {
      const err = new Error('Usuario no encontrado');
      err.status = 404;
      throw err;
    }
    user = result.records[0].get('u').properties;
  } finally {
    await session.close();
  }

  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) {
    const err = new Error('Contraseña actual incorrecta');
    err.status = 400;
    throw err;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(newPassword, salt);

  const session2 = getSession();
  try {
    await session2.run(
      `MATCH (u:User {userId: $userId}) SET u.passwordHash = $passwordHash, u.salt = $salt`,
      { userId, passwordHash, salt }
    );
  } finally {
    await session2.close();
  }

  await logAudit('User', userId, 'UPDATE', userId, null, { action: 'change_password' });
};

module.exports = {
  registerUser,
  loginUser,
  createRememberToken,
  validateRememberToken,
  logoutUser,
  generateResetToken,
  resetPassword,
  changePassword
};
