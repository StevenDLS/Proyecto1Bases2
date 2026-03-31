const { getClient } = require('../config/cassandra');

const logEvent = async (userId, username, eventType, ip, device, details = '') => {
  const client = getClient();
  const now = new Date();
  const logDate = now.toISOString().split('T')[0];

  await client.execute(
    `INSERT INTO session_logs (user_id, log_date, log_time, event_type, ip, device, details)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, logDate, now, eventType, ip, device, details],
    { prepare: true }
  );

  await client.execute(
    `INSERT INTO system_logs (log_date, log_time, user_id, username, event_type, ip, device, details)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [logDate, now, userId, username, eventType, ip, device, details],
    { prepare: true }
  );
};

const logAudit = async (entityType, userId, operation, entityId, oldValue = null, newValue = null) => {
  const client = getClient();
  const now = new Date();
  const opDate = now.toISOString().split('T')[0];

  await client.execute(
    `INSERT INTO audit_trail (entity_type, operation_date, operation_time, user_id, operation, entity_id, old_value, new_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entityType,
      opDate,
      now,
      userId,
      operation,
      entityId,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null
    ],
    { prepare: true }
  );
};

module.exports = { logEvent, logAudit };
