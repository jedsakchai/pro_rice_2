const jwt = require('jsonwebtoken');

function getJwtSecret() {
  return process.env.JWT_SECRET || process.env.SESSION_SECRET || 'dev-secret-change-me';
}

function parseBearerToken(req) {
  const header = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!header || typeof header !== 'string') return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token.trim();
}

function optionalOwnerAuth(req, res, next) {
  const token = parseBearerToken(req);
  if (!token) return next();

  try {
    const payload = jwt.verify(token, getJwtSecret());
    req.owner = payload;
    return next();
  } catch {
    return next();
  }
}

function requireOwnerAuth(req, res, next) {
  const token = parseBearerToken(req);
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, getJwtSecret());
    req.owner = payload;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

// requireAuth: ยืนยันว่าล็อกอินแล้ว (ไม่สนบทบาท — ใช้ได้ทั้ง villager & owner)
function requireAuth(req, res, next) {
  const token = parseBearerToken(req);
  if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

  try {
    const payload = jwt.verify(token, getJwtSecret());
    req.owner = payload;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

// requireRole(role): ตรวจว่าล็อกอินแล้ว + บทบาทตรงกัน
// ใช้ได้ทั้งค่าเดียว requireRole('owner') หรือหลายค่า requireRole('owner','villager')
function requireRole(...roles) {
  return (req, res, next) => {
    const token = parseBearerToken(req);
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

    try {
      const payload = jwt.verify(token, getJwtSecret());
      req.owner = payload;
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    if (!roles.includes(req.owner.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient privileges' });
    }

    return next();
  };
}

module.exports = {
  optionalOwnerAuth,
  requireOwnerAuth,
  requireAuth,
  requireRole,
};
