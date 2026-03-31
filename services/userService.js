const { getSession } = require('../config/neo4j');

const searchUsers = async (query) => {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (u:User) WHERE toLower(u.username) CONTAINS toLower($query) OR toLower(u.fullName) CONTAINS toLower($query)
       RETURN u.userId as userId, u.username as username, u.fullName as fullName, u.role as role, u.avatarFileId as avatarFileId
       LIMIT 50`,
      { query: query || '' }
    );
    return result.records.map(r => ({
      userId: r.get('userId'), username: r.get('username'),
      fullName: r.get('fullName'), role: r.get('role'),
      avatarFileId: r.get('avatarFileId')
    }));
  } finally {
    await session.close();
  }
};

const getUserProfile = async (userId, requesterId) => {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (u:User {userId: $userId})
       RETURN u`,
      { userId }
    );
    if (result.records.length === 0) return null;
    const user = result.records[0].get('u').properties;
    // No exponer datos sensibles
    const profile = {
      userId: user.userId, username: user.username, fullName: user.fullName,
      role: user.role, avatarFileId: user.avatarFileId, createdAt: user.createdAt
    };

    // Si son amigos, mostrar cursos
    if (requesterId && requesterId !== userId) {
      const friendCheck = await session.run(
        `MATCH (a:User {userId: $requesterId})-[:FRIENDS_WITH]->(b:User {userId: $userId}) RETURN b`,
        { requesterId, userId }
      );
      if (friendCheck.records.length > 0) {
        const enrolledResult = await session.run(
          `MATCH (u:User {userId: $userId})-[:ENROLLED_IN]->(c:Course) RETURN c.courseId as courseId, c.name as name`,
          { userId }
        );
        const teachingResult = await session.run(
          `MATCH (u:User {userId: $userId})-[:TEACHES]->(c:Course) RETURN c.courseId as courseId, c.name as name`,
          { userId }
        );
        profile.enrolledCourses = enrolledResult.records.map(r => ({ courseId: r.get('courseId'), name: r.get('name') }));
        profile.teachingCourses = teachingResult.records.map(r => ({ courseId: r.get('courseId'), name: r.get('name') }));
        profile.isFriend = true;
      } else {
        profile.isFriend = false;
      }

      // Ver si hay solicitud pendiente
      const reqCheck = await session.run(
        `MATCH (a:User {userId: $requesterId})-[:FRIEND_REQUEST]->(b:User {userId: $userId}) RETURN b`,
        { requesterId, userId }
      );
      profile.hasPendingRequest = reqCheck.records.length > 0;
    }

    return profile;
  } finally {
    await session.close();
  }
};

const sendFriendRequest = async (fromId, toId) => {
  const session = getSession();
  try {
    // Verificar que no son ya amigos
    const check = await session.run(
      `MATCH (a:User {userId: $fromId})-[:FRIENDS_WITH]->(b:User {userId: $toId}) RETURN b`,
      { fromId, toId }
    );
    if (check.records.length > 0) {
      const err = new Error('Ya son amigos');
      err.status = 409;
      throw err;
    }
    await session.run(
      `MATCH (a:User {userId: $fromId}), (b:User {userId: $toId})
       MERGE (a)-[:FRIEND_REQUEST]->(b)`,
      { fromId, toId }
    );
  } finally {
    await session.close();
  }
};

const acceptFriendRequest = async (fromId, toId) => {
  const session = getSession();
  try {
    const check = await session.run(
      `MATCH (a:User {userId: $fromId})-[r:FRIEND_REQUEST]->(b:User {userId: $toId}) RETURN r`,
      { fromId, toId }
    );
    if (check.records.length === 0) {
      const err = new Error('No existe solicitud de amistad');
      err.status = 404;
      throw err;
    }
    const now = new Date().toISOString();
    await session.run(
      `MATCH (a:User {userId: $fromId})-[r:FRIEND_REQUEST]->(b:User {userId: $toId})
       DELETE r
       CREATE (a)-[:FRIENDS_WITH {since: $now}]->(b)
       CREATE (b)-[:FRIENDS_WITH {since: $now}]->(a)`,
      { fromId, toId, now }
    );
  } finally {
    await session.close();
  }
};

const getFriends = async (userId) => {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (u:User {userId: $userId})-[:FRIENDS_WITH]->(f:User)
       RETURN f.userId as userId, f.username as username, f.fullName as fullName, f.avatarFileId as avatarFileId`,
      { userId }
    );
    return result.records.map(r => ({
      userId: r.get('userId'), username: r.get('username'),
      fullName: r.get('fullName'), avatarFileId: r.get('avatarFileId')
    }));
  } finally {
    await session.close();
  }
};

const getPendingRequests = async (userId) => {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (f:User)-[:FRIEND_REQUEST]->(u:User {userId: $userId})
       RETURN f.userId as userId, f.username as username, f.fullName as fullName`,
      { userId }
    );
    return result.records.map(r => ({
      userId: r.get('userId'), username: r.get('username'), fullName: r.get('fullName')
    }));
  } finally {
    await session.close();
  }
};

module.exports = { searchUsers, getUserProfile, sendFriendRequest, acceptFriendRequest, getFriends, getPendingRequests };
