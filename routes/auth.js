const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = require('../config/database');

const router = express.Router();

function getJwtSecret() {
  return process.env.JWT_SECRET || process.env.SESSION_SECRET || 'dev-secret-change-me';
}

function isAlphaNum(value) {
  return /^[A-Za-z0-9]+$/.test(String(value || ''));
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined) return null;
  if (value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseSessionData(req) {
  let session = null;
  const raw = req.headers['x-session-data'];
  if (!raw) return null;

  try {
    const decoded = Buffer.from(String(raw), 'base64').toString('utf8');
    session = JSON.parse(decoded);
  } catch {
    try {
      session = JSON.parse(raw);
    } catch {
      session = null;
    }
  }

  return session;
}

function resolveMillIdFromName(name) {
  const raw = String(name || '').trim();
  if (!raw) return null;
  const compact = raw.replace(/\s+/g, '');
  const lower = raw.toLowerCase();

  const map = {
    'โรงสีบ้านบางกระวาน': 1,
    'โรงสีบางกระวาน': 1,
    'โรงสีกลาง': 1,
    'centralmill': 1,
    'CentralMill': 1,
    'โรงสีบ้านปรือคัน': 2,
    'โรงสีปรือคัน': 2,
    'โรงสีเหนือ': 2,
    'northernmill': 2,
    'NorthernMill': 2,
    'โรงสีบ้านเนินเเสง': 3,
    'โรงสีบ้านเนินแสง': 3,
    'โรงสีเนินแสง': 3,
    'โรงสีใต้': 3,
    'southernmill': 3,
    'SouthernMill': 3,
  };

  if (map[compact] !== undefined) return map[compact];
  if (raw.includes('กลาง') || lower.includes('central')) return 1;
  if (raw.includes('เหนือ') || lower.includes('north')) return 2;
  if (raw.includes('ใต้') || lower.includes('south')) return 3;
  return null;
}

async function ensureMillRow(millName) {
  const guessed = resolveMillIdFromName(millName);
  if (guessed) return guessed;

  // Avoid auto-creating new mills from arbitrary input (it makes owner pages look empty
  // because there are no milling_requests for that new mill yet).
  return null;
}

const VALID_ROLES = ['villager', 'owner'];

router.post('/register', async (req, res) => {
  const owner_name = (req.body && req.body.owner_name ? String(req.body.owner_name) : '').trim();
  const username = (req.body && (req.body.username || req.body.mill_name) ? String(req.body.username || req.body.mill_name) : '').trim();
  const password = req.body && req.body.password ? String(req.body.password) : '';
  const mill_id_raw = req.body && req.body.mill_id !== undefined ? Number(req.body.mill_id) : null;
  const role = (req.body && req.body.role ? String(req.body.role) : 'villager').trim().toLowerCase();

  // owner-only optional mill fields
  const mill_location_th = (req.body && req.body.mill_location_th ? String(req.body.mill_location_th) : '').trim();
  const mill_phone = (req.body && req.body.mill_phone ? String(req.body.mill_phone) : '').trim();
  const mill_email = (req.body && req.body.mill_email ? String(req.body.mill_email) : '').trim();
  const latitude = parseOptionalNumber(req.body && req.body.latitude !== undefined ? req.body.latitude : null);
  const longitude = parseOptionalNumber(req.body && req.body.longitude !== undefined ? req.body.longitude : null);
  // villager optional contact fields
  const villager_phone = (req.body && req.body.phone ? String(req.body.phone) : '').trim();
  const villager_address = (req.body && req.body.address ? String(req.body.address) : '').trim();

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ success: false, message: 'บทบาทไม่ถูกต้อง' });
  }

  if (!owner_name || !username || !password) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
  }

  if (!isAlphaNum(username)) {
    return res.status(400).json({ success: false, message: 'username ใช้ได้เฉพาะตัวอักษรภาษาอังกฤษและตัวเลข' });
  }

  if (!isAlphaNum(password)) {
    return res.status(400).json({ success: false, message: 'password ใช้ได้เฉพาะตัวอักษรภาษาอังกฤษและตัวเลข' });
  }

  if (role === 'owner') {
    if (mill_location_th.length > 255) {
      return res.status(400).json({ success: false, message: 'ที่อยู่โรงสียาวเกินไป' });
    }
    if (mill_phone.length > 30) {
      return res.status(400).json({ success: false, message: 'เบอร์โทรยาวเกินไป' });
    }
    if (mill_email.length > 120) {
      return res.status(400).json({ success: false, message: 'อีเมลยาวเกินไป' });
    }
    if (latitude !== null && (latitude < -90 || latitude > 90)) {
      return res.status(400).json({ success: false, message: 'Latitude ต้องอยู่ระหว่าง -90 ถึง 90' });
    }
    if (longitude !== null && (longitude < -180 || longitude > 180)) {
      return res.status(400).json({ success: false, message: 'Longitude ต้องอยู่ระหว่าง -180 ถึง 180' });
    }
  }
  if (role !== 'owner') {
    if (villager_phone && villager_phone.length > 30) {
      return res.status(400).json({ success: false, message: 'เบอร์โทรยาวเกินไป' });
    }
    if (villager_address && villager_address.length > 500) {
      return res.status(400).json({ success: false, message: 'ที่อยู่ยาวเกินไป' });
    }
  }

  try {
    const password_hash = await bcrypt.hash(password, 10);

    if (role === 'owner') {
      // --- เจ้าของโรงสี → ตาราง owners ---
      const mill_name = username;
      let mill_id = null;

      if (Number.isFinite(mill_id_raw) && mill_id_raw > 0) {
        mill_id = Number(mill_id_raw);
      } else {
        mill_id = await ensureMillRow(mill_name);
      }

      if (!Number.isFinite(mill_id) || mill_id <= 0) {
        return res.status(400).json({ success: false, message: 'เจ้าของโรงสีต้องเลือกโรงสี' });
      }

      const conn = await pool.getConnection();
      try {
        const [rows] = await conn.execute('SELECT mill_id FROM mills WHERE mill_id = ? LIMIT 1', [mill_id]);
        if (!rows || !rows[0]) {
          return res.status(400).json({ success: false, message: 'ไม่พบโรงสีที่เลือก' });
        }

        // Update mill details if provided (best-effort)
        const updateFields = [];
        const updateValues = [];

        if (mill_location_th) {
          updateFields.push('location_th = ?');
          updateValues.push(mill_location_th);
        }
        if (mill_phone) {
          updateFields.push('phone = ?');
          updateValues.push(mill_phone);
        }
        if (mill_email) {
          updateFields.push('email = ?');
          updateValues.push(mill_email);
        }
        if (latitude !== null) {
          updateFields.push('latitude = ?');
          updateValues.push(latitude);
        }
        if (longitude !== null) {
          updateFields.push('longitude = ?');
          updateValues.push(longitude);
        }

        if (updateFields.length > 0) {
          await conn.execute(
            `UPDATE mills SET ${updateFields.join(', ')} WHERE mill_id = ?`,
            [...updateValues, mill_id]
          );
        }

        // Check username uniqueness in owners
        const [dup] = await conn.execute('SELECT owner_id FROM owners WHERE mill_name = ? LIMIT 1', [username]);
        if (dup && dup[0]) {
          return res.status(409).json({ success: false, message: 'username นี้ถูกใช้แล้ว' });
        }
        await conn.execute(
          'INSERT INTO owners (owner_name, mill_name, mill_id, password_hash) VALUES (?, ?, ?, ?)',
          [owner_name, mill_name, mill_id, password_hash]
        );
      } finally {
        conn.release();
      }
    } else {
      // --- ชาวบ้าน → ตาราง villagers ---
      const conn = await pool.getConnection();
      try {
        const [dup] = await conn.execute('SELECT villager_id FROM villagers WHERE username = ? LIMIT 1', [username]);
        if (dup && dup[0]) {
          return res.status(409).json({ success: false, message: 'username นี้ถูกใช้แล้ว' });
        }
        await conn.execute(
          'INSERT INTO villagers (villager_name, username, phone, password_hash, address) VALUES (?, ?, ?, ?, ?)',
          [owner_name, username, villager_phone || '', password_hash, villager_address || '']
        );
      } finally {
        conn.release();
      }
    }

    return res.json({ success: true, message: 'สมัครสมาชิกสำเร็จ' });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'ข้อมูลซ้ำในระบบ (โปรดลองเปลี่ยนชื่อ หรือ username)' });
    }
    console.error(err);
    return res.status(500).json({ success: false, message: 'สมัครไม่สำเร็จ' });
  }
});

router.post('/login', async (req, res) => {
  const username = (req.body && (req.body.username || req.body.mill_name || req.body.owner_name)
    ? String(req.body.username || req.body.mill_name || req.body.owner_name)
    : '').trim();
  const password = req.body && req.body.password ? String(req.body.password) : '';

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  if (!isAlphaNum(username)) {
    return res.status(400).json({ success: false, message: 'username ใช้ได้เฉพาะตัวอักษรภาษาอังกฤษและตัวเลข' });
  }

  if (!isAlphaNum(password)) {
    return res.status(400).json({ success: false, message: 'password ใช้ได้เฉพาะตัวอักษรภาษาอังกฤษและตัวเลข' });
  }

  try {
    const conn = await pool.getConnection();
    let user = null;
    let role = null;
    try {
      // 1) ค้นหาในตาราง owners (เจ้าของโรงสี) — by mill_name (username)
      let rows;
      [rows] = await conn.execute(
        'SELECT owner_id, owner_name, mill_name, mill_id, password_hash FROM owners WHERE mill_name = ? LIMIT 1',
        [username]
      );
      if (rows && rows[0]) {
        user = rows[0];
        role = 'owner';
      }

      // fallback: by owner_name
      if (!user) {
        [rows] = await conn.execute(
          'SELECT owner_id, owner_name, mill_name, mill_id, password_hash FROM owners WHERE owner_name = ? LIMIT 1',
          [username]
        );
        if (rows && rows[0]) {
          user = rows[0];
          role = 'owner';
        }
      }

      // 2) ค้นหาในตาราง villagers (ชาวบ้าน)
      if (!user) {
        [rows] = await conn.execute(
          'SELECT villager_id, villager_name, username, phone, address, password_hash FROM villagers WHERE username = ? LIMIT 1',
          [username]
        );
        if (rows && rows[0]) {
          user = rows[0];
          role = 'villager';
        }
      }

      // fallback: by villager_name
      if (!user) {
        [rows] = await conn.execute(
          'SELECT villager_id, villager_name, username, phone, address, password_hash FROM villagers WHERE villager_name = ? LIMIT 1',
          [username]
        );
        if (rows && rows[0]) {
          user = rows[0];
          role = 'villager';
        }
      }
    } finally {
      conn.release();
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    let tokenPayload, responseData;

    if (role === 'owner') {
      tokenPayload = {
        owner_id: user.owner_id,
        owner_name: user.owner_name,
        mill_name: user.mill_name,
        mill_id: user.mill_id,
        role: 'owner',
      };
      responseData = { ...tokenPayload };
    } else {
      tokenPayload = {
        villager_id: user.villager_id,
        villager_name: user.villager_name,
        username: user.username,
        role: 'villager',
      };
      responseData = {
        ...tokenPayload,
        phone: user.phone || '',
        address: user.address || '',
      };
    }

    const token = jwt.sign(tokenPayload, getJwtSecret(), { expiresIn: '1d' });

    return res.json({ success: true, token, data: responseData });
  } catch (err) {
    console.error(err);
    return res.status(503).json({ success: false, message: 'ระบบฐานข้อมูลไม่พร้อมใช้งาน' });
  }
});

router.get('/me', async (req, res) => {
  const session = parseSessionData(req);
  const villagerId = Number(session?.villager_id || 0);
  const ownerId = Number(session?.owner_id || 0);

  if (!villagerId && !ownerId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const conn = await pool.getConnection();
    try {
      if (session?.role === 'owner' && ownerId) {
        const [rows] = await conn.execute(
          `SELECT o.owner_id, o.owner_name, o.mill_name, o.mill_id, m.location_th AS mill_location_th, m.phone AS mill_phone, m.email AS mill_email
           FROM owners o
           LEFT JOIN mills m ON m.mill_id = o.mill_id
           WHERE o.owner_id = ? LIMIT 1`,
          [ownerId]
        );
        const row = rows && rows[0];
        if (!row) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้' });
        return res.json({ success: true, data: { ...row, role: 'owner' } });
      }

      const [rows] = await conn.execute(
        'SELECT villager_id, villager_name, username, phone, address FROM villagers WHERE villager_id = ? LIMIT 1',
        [villagerId]
      );
      const row = rows && rows[0];
      if (!row) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูลผู้ใช้' });
      return res.json({ success: true, data: { ...row, role: 'villager' } });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('auth me error:', err);
    return res.status(503).json({ success: false, message: 'ไม่สามารถดึงข้อมูลโปรไฟล์ได้' });
  }
});

module.exports = router;
