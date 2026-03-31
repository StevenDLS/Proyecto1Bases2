const { client: redisClient } = require('../config/redis');
const { getSession } = require('../config/neo4j');
const { logAudit } = require('./logService');

const CART_TTL = parseInt(process.env.CART_TTL_SECONDS) || 1800;

const _getCart = async (userId) => {
  const data = await redisClient.get(`cart:${userId}`);
  return data ? JSON.parse(data) : { courses: [], updatedAt: null };
};

const _saveCart = async (userId, cart) => {
  cart.updatedAt = new Date().toISOString();
  await redisClient.setEx(`cart:${userId}`, CART_TTL, JSON.stringify(cart));
};

const addToCart = async (userId, courseId) => {
  const cart = await _getCart(userId);
  if (!cart.courses.includes(courseId)) {
    cart.courses.push(courseId);
  }
  await _saveCart(userId, cart);
  return cart;
};

const removeFromCart = async (userId, courseId) => {
  const cart = await _getCart(userId);
  cart.courses = cart.courses.filter(id => id !== courseId);
  await _saveCart(userId, cart);
  return cart;
};

const getCart = async (userId) => {
  return _getCart(userId);
};

const confirmEnrollment = async (userId) => {
  const cart = await _getCart(userId);
  if (!cart.courses || cart.courses.length === 0) {
    const err = new Error('Carrito vacío');
    err.status = 400;
    throw err;
  }

  const session = getSession();
  const now = new Date().toISOString();
  try {
    for (const courseId of cart.courses) {
      // Verificar que el curso está publicado y el estudiante no está ya matriculado
      const check = await session.run(
        `MATCH (c:Course {courseId: $courseId, published: true})
         OPTIONAL MATCH (u:User {userId: $userId})-[r:ENROLLED_IN]->(c)
         RETURN c, r`,
        { courseId, userId }
      );
      if (check.records.length === 0) continue;
      const alreadyEnrolled = check.records[0].get('r');
      if (alreadyEnrolled) continue;

      await session.run(
        `MATCH (u:User {userId: $userId}), (c:Course {courseId: $courseId})
         CREATE (u)-[:ENROLLED_IN {enrolledAt: $now, status: 'active'}]->(c)`,
        { userId, courseId, now }
      );
      await logAudit('Enrollment', userId, 'ENROLL', courseId, null, { userId, courseId });
    }
  } finally {
    await session.close();
  }

  await redisClient.del(`cart:${userId}`);
  return { enrolled: cart.courses };
};

const getEnrolledCourses = async (userId) => {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (u:User {userId: $userId})-[r:ENROLLED_IN]->(c:Course)
       OPTIONAL MATCH (t:User)-[:TEACHES]->(c)
       RETURN c, r.enrolledAt as enrolledAt, r.status as status, t.fullName as teacherName
       ORDER BY r.enrolledAt DESC`,
      { userId }
    );
    return result.records.map(r => ({
      ...r.get('c').properties,
      enrolledAt: r.get('enrolledAt'),
      status: r.get('status'),
      teacherName: r.get('teacherName')
    }));
  } finally {
    await session.close();
  }
};

const getCourseStudentsForEnrolled = async (courseId, requesterId) => {
  const session = getSession();
  try {
    // Verificar que el requester está matriculado
    const check = await session.run(
      `MATCH (u:User {userId: $requesterId})-[:ENROLLED_IN]->(c:Course {courseId: $courseId}) RETURN c`,
      { requesterId, courseId }
    );
    if (check.records.length === 0) {
      const err = new Error('No matriculado en este curso');
      err.status = 403;
      throw err;
    }
    const result = await session.run(
      `MATCH (s:User)-[:ENROLLED_IN]->(c:Course {courseId: $courseId})
       RETURN s.userId as userId, s.fullName as fullName, s.username as username`,
      { courseId }
    );
    return result.records.map(r => ({
      userId: r.get('userId'),
      fullName: r.get('fullName'),
      username: r.get('username')
    }));
  } finally {
    await session.close();
  }
};

module.exports = {
  addToCart, removeFromCart, getCart,
  confirmEnrollment, getEnrolledCourses, getCourseStudentsForEnrolled
};
