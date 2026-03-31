const { logEvent } = require('../services/logService');

const activityLogger = async (req, res, next) => {
  if (req.user) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const device = req.headers['user-agent'] || 'unknown';
    logEvent(req.user.userId, req.user.username, 'REQUEST', ip, device,
      `${req.method} ${req.path}`).catch(() => {});
  }
  next();
};

module.exports = { activityLogger };
