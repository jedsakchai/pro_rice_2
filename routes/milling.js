const express = require('express');

const pool = require('../config/database');
const { optionalOwnerAuth, requireAuth, requireRole } = require('../middleware/ownerAuth');
const { recordStatusHistory } = require('../utils/status-history');

const router = express.Router();

function stringifyCancelReason(value) {
  if (Array.isArray(value)) return JSON.stringify(value.filter(Boolean));
  if (value && typeof value === 'object') return JSON.stringify(value);
  const text = String(value || '').trim();
  return text ? JSON.stringify([text]) : null;
}

const toInt = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function normalizeMillingStatus(value) {
  const status = String(value || '').trim();
  const aliases = {
    pending: 'pending_review',
    in_progress: 'milling',
    completed: 'delivered',
  };
  const canonical = aliases[status] || status;
  const allowed = new Set(['pending_review', 'accepted', 'awaiting_pickup', 'received', 'queued', 'milling', 'packing', 'ready', 'shipping', 'delivered', 'cancelled']);
  return allowed.has(canonical) ? canonical : 'pending_review';
}

async function syncVillagerContact(conn, villagerId, payload) {
  const id = Number(villagerId || 0);
  if (!Number.isFinite(id) || id <= 0) return;

  const updates = [];
  const values = [];

  const name = String(payload.customer_name || '').trim();
  const phone = String(payload.phone || '').trim();
  const address = String(payload.address || '').trim();

  if (name) {
    updates.push('villager_name = ?');
    values.push(name);
  }
  if (phone) {
    updates.push('phone = ?');
    values.push(phone);
  }
  if (address) {
    updates.push('address = ?');
    values.push(address);
  }

  if (updates.length === 0) return;

  await conn.execute(
    `UPDATE villagers SET ${updates.join(', ')} WHERE villager_id = ?`,
    [...values, id]
  );
}

router.get('/count', optionalOwnerAuth, async (req, res) => {
  const millId = req.owner && req.owner.mill_id ? Number(req.owner.mill_id) : null;

  if (!millId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM milling_requests
       WHERE mill_id = ?
        AND status NOT IN ('cancelled', 'delivered')
         AND COALESCE(review_status, 'pending_review') = 'pending_review'`,
      [millId]
    );

    const count = rows && rows[0] ? Number(rows[0].count) || 0 : 0;
    return res.json({ success: true, data: { count } });
  } catch (err) {
    console.error('milling count failed', err);
    return res.status(500).json({ success: false, message: 'ไม่สามารถดึงจำนวนคำขอได้' });
  }
});

router.get('/', optionalOwnerAuth, async (req, res) => {
  const limit = Math.min(Math.max(toInt(req.query.limit, 50), 1), 200);
  const offset = Math.max(toInt(req.query.offset, 0), 0);

  const view = (req.query.view ? String(req.query.view) : '').trim().toLowerCase();

  // If authenticated owner, force mill_id to the owner's mill
  const millId = req.owner && req.owner.mill_id ? Number(req.owner.mill_id) : (req.query.mill_id ? Number(req.query.mill_id) : null);

  try {
    const conn = await pool.getConnection();
    try {
      const params = [];
      const conditions = [];

      if (millId) {
        conditions.push('mr.mill_id = ?');
        params.push(millId);
      }

      // Support fixed views used by owner pages
      // - view=check: pending items that still need review
      // - view=results: reviewed/completed items
      if (view === 'check') {
        conditions.push("mr.status NOT IN ('cancelled', 'delivered')");
        conditions.push("COALESCE(mr.review_status, 'pending_review') = 'pending_review'");
      } else if (view === 'results') {
        conditions.push("mr.status IN ('delivered', 'cancelled', 'completed')");
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const [rows] = await conn.execute(
        `SELECT
            mr.request_id,
            mr.mill_id,
            m.mill_name,
            m.mill_name_th,
            mr.rice_type,
            mr.customer_name,
            mr.phone,
            mr.address,
            mr.sacks,
            mr.dropoff_date,
            mr.expected_return_date,
            mr.status,
            mr.review_status,
            mr.notes,
            mr.created_at,
            mr.updated_at
         FROM milling_requests mr
         LEFT JOIN mills m ON m.mill_id = mr.mill_id
         ${where}
         ORDER BY mr.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      return res.json({ success: true, data: rows || [] });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    return res.status(503).json({ success: false, message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' });
  }
});

// ดึง villager_id จาก JWT (รองรับทั้ง token ใหม่และเก่า)
async function resolveVillagerId(owner) {
  if (!owner) return null;
  if (owner.villager_id) return owner.villager_id;
  // token เก่าอาจมีแค่ owner_id — ค้นจาก username/mill_name
  const uname = owner.username || owner.mill_name;
  if (!uname) return null;
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.execute('SELECT villager_id FROM villagers WHERE username = ? LIMIT 1', [uname]);
    return rows && rows[0] ? rows[0].villager_id : null;
  } finally {
    conn.release();
  }
}

// GET /my-requests — ดึงรายการสีข้าวที่ชาวบ้านส่งเอง (สนับสนุน filter status)
router.get('/my-requests', requireAuth, async (req, res) => {
  try {
    const vid = await resolveVillagerId(req.owner);
    if (!vid) return res.json({ success: true, data: [] });

    const status = String(req.query.status || '').trim();
    const limit = Math.min(Number(req.query.limit || 100) || 100, 200);
    const offset = Math.max(Number(req.query.offset || 0) || 0, 0);

    const conn = await pool.getConnection();
    try {
      let whereClause = 'WHERE mr.submitted_by = ?';
      let params = [vid];
      
      if (status) {
        whereClause += ' AND mr.status = ?';
        params.push(status);
      }
      
      params.push(limit, offset);

      const [rows] = await conn.execute(
        `SELECT
            mr.request_id,
            mr.mill_id,
            m.mill_name,
            m.mill_name_th,
            mr.rice_type,
            mr.customer_name,
            mr.phone,
            mr.sacks,
            mr.dropoff_date,
            mr.expected_return_date,
            mr.status,
            mr.review_status,
            mr.notes,
            mr.created_at
         FROM milling_requests mr
         LEFT JOIN mills m ON m.mill_id = mr.mill_id
         ${whereClause}
         ORDER BY mr.created_at DESC
         LIMIT ? OFFSET ?`,
        params
      );
      return res.json({ success: true, data: rows || [] });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    return res.status(503).json({ success: false, message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' });
  }
});

router.get('/:id', optionalOwnerAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid id' });

  try {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        `SELECT
            mr.*,
            m.mill_name,
            m.mill_name_th
         FROM milling_requests mr
         LEFT JOIN mills m ON m.mill_id = mr.mill_id
         WHERE mr.request_id = ?
         LIMIT 1`,
        [id]
      );

      const row = rows && rows[0];
      if (!row) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูล' });

      if (req.owner && req.owner.mill_id && Number(row.mill_id) !== Number(req.owner.mill_id)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      return res.json({ success: true, data: row });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    return res.status(503).json({ success: false, message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' });
  }
});

router.post('/', optionalOwnerAuth, async (req, res) => {
  const body = req.body || {};

  const mill_id = body.mill_id ? Number(body.mill_id) : null;
  const rice_type = (body.rice_type ? String(body.rice_type) : '').trim();
  const customer_name = (body.customer_name ? String(body.customer_name) : '').trim();
  const phone = (body.phone ? String(body.phone) : '').trim();
  const address = (body.address ? String(body.address) : '').trim();
  const sacks = body.sacks !== undefined ? Number(body.sacks) : NaN;
  const dropoff_date = (body.dropoff_date ? String(body.dropoff_date) : '').trim();
  const submitted_by = req.owner ? await resolveVillagerId(req.owner) : (body.villager_id ? Number(body.villager_id) : null);

  if (!rice_type || !customer_name || !phone || !address || !Number.isFinite(sacks) || sacks <= 0 || !dropoff_date) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วนหรือไม่ถูกต้อง' });
  }

  try {
    const conn = await pool.getConnection();
    try {
      const [result] = await conn.execute(
        `INSERT INTO milling_requests
          (mill_id, rice_type, customer_name, phone, address, sacks, dropoff_date, submitted_by, status, review_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [mill_id, rice_type, customer_name, phone, address, sacks, dropoff_date, submitted_by, 'pending_review', 'pending_review']
      );

      await syncVillagerContact(conn, submitted_by, {
        customer_name,
        phone,
        address,
      });

      await recordStatusHistory(conn, {
        resourceType: 'milling',
        resourceId: result.insertId,
        fromStatus: null,
        toStatus: 'pending_review',
      });

      // Create initial notification for the submitting villager
      try {
        if (submitted_by) {
          const message = `คำขอสีข้าวถูกสร้าง: #${result.insertId}`;
          await conn.execute('INSERT INTO notifications (villager_id, type, resource_id, status, message) VALUES (?, ?, ?, ?, ?)', [submitted_by, 'milling', result.insertId, 'pending_review', message]);
        }
      } catch (e) {
        console.error('create initial notification (milling) error:', e && e.message);
      }

      return res.status(201).json({
        success: true,
        message: 'ขอบคุณ! ส่งคำขอสีข้าวสำเร็จ',
        data: { request_id: Number(result.insertId), status: 'pending_review' },
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    return res.status(503).json({ success: false, message: 'ไม่สามารถบันทึกข้อมูลได้' });
  }
});

router.put('/:id', requireRole('owner'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid id' });

  const payload = req.body || {};
  const allowed = {};
  if (payload.status) allowed.status = normalizeMillingStatus(payload.status);
  if (payload.review_status) allowed.review_status = String(payload.review_status);
  if (String(payload.status || '').trim() === 'cancelled') {
    allowed.cancel_reason = stringifyCancelReason(payload.cancel_reason);
    allowed.cancelled_at = null;
  }

  const keys = Object.keys(allowed);
  if (keys.length === 0) return res.status(400).json({ success: false, message: 'ไม่มีข้อมูลให้แก้ไข' });

  try {
    const conn = await pool.getConnection();
    try {
      // Ensure owner can only modify their own mill
      const [rows] = await conn.execute('SELECT mill_id, status, submitted_by FROM milling_requests WHERE request_id = ? LIMIT 1', [id]);
      const row = rows && rows[0];
      if (!row) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูล' });
      if (Number(row.mill_id) !== Number(req.owner.mill_id)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      const sets = keys.map((k) => `${k} = ${k === 'cancelled_at' ? 'CURRENT_TIMESTAMP' : '?'}`).join(', ');
      const values = keys.filter((k) => k !== 'cancelled_at').map((k) => allowed[k]);

      await conn.execute(
        `UPDATE milling_requests SET ${sets} WHERE request_id = ?`,
        [...values, id]
      );

      if (String(row.status || '').trim() !== String(allowed.status || row.status || '').trim()) {
        await recordStatusHistory(conn, {
          resourceType: 'milling',
          resourceId: id,
          fromStatus: row.status,
          toStatus: allowed.status || row.status,
        });
      }

      const [updatedRows] = await conn.execute(
        'SELECT * FROM milling_requests WHERE request_id = ? LIMIT 1',
        [id]
      );

      // Record a new notification event for the submitting villager
      try {
        const updated = updatedRows && updatedRows[0];
        if (updated && updated.submitted_by) {
          const vid = Number(updated.submitted_by) || null;
          const message = String(updated.status || '') === 'cancelled'
            ? 'ยกเลิกคำขอสีข้าวแล้ว'
            : `สถานะคำขอสีข้าวเปลี่ยนเป็น ${String(updated.status || '')}`;
          try {
            await conn.execute(
              'INSERT INTO notifications (villager_id, type, resource_id, status, message) VALUES (?, ?, ?, ?, ?)',
              [vid, 'milling', id, updated.status, message]
            );
          } catch (ne) {
            console.error('sync notification (milling) error:', ne && ne.message);
          }
        }
      } catch (e) {
        console.error('create notification (milling) error:', e);
      }

      return res.json({ success: true, data: updatedRows && updatedRows[0] });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    return res.status(503).json({ success: false, message: 'อัปเดตไม่สำเร็จ' });
  }
});

router.delete('/:id', requireRole('owner'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid id' });

  try {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute('SELECT mill_id FROM milling_requests WHERE request_id = ? LIMIT 1', [id]);
      const row = rows && rows[0];
      if (!row) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูล' });
      if (Number(row.mill_id) !== Number(req.owner.mill_id)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      await conn.execute('DELETE FROM milling_requests WHERE request_id = ?', [id]);
      return res.json({ success: true });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    return res.status(503).json({ success: false, message: 'ลบไม่สำเร็จ' });
  }
});

module.exports = router;
