const express = require('express');

const pool = require('../config/database');
const { optionalOwnerAuth, requireRole } = require('../middleware/ownerAuth');

const router = express.Router();

const toInt = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// Public: create inquiry
router.post('/', async (req, res) => {
  const body = req.body || {};
  const subject = (body.subject ? String(body.subject) : '').trim();
  const message = (body.message ? String(body.message) : '').trim();
  const customer_name = (body.customer_name ? String(body.customer_name) : '').trim();
  const phone = (body.phone ? String(body.phone) : '').trim();
  const email = (body.email ? String(body.email) : '').trim();

  if (!subject || !message || !customer_name || !phone) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
  }

  try {
    const conn = await pool.getConnection();
    try {
      const [result] = await conn.execute(
        `INSERT INTO inquiries (subject, message, customer_name, phone, email)
         VALUES (?, ?, ?, ?, ?)`,
        [subject, message, customer_name, phone, email || null]
      );

      return res.status(201).json({ success: true, data: { inquiry_id: Number(result.insertId) } });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    return res.status(503).json({ success: false, message: 'ไม่สามารถบันทึกข้อมูลได้' });
  }
});

// Public: list inquiries (used by inquiry.html table)
router.get('/', optionalOwnerAuth, async (req, res) => {
  const limit = Math.min(Math.max(toInt(req.query.limit, 50), 1), 200);
  const offset = Math.max(toInt(req.query.offset, 0), 0);

  try {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        `SELECT inquiry_id, subject, message, customer_name, phone, email, status,
                reply_message, replied_at,
                created_at, updated_at
         FROM inquiries
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      return res.json({ success: true, data: rows || [] });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    return res.status(503).json({ success: false, message: 'ไม่สามารถดึงข้อมูลได้' });
  }
});

// Public: reply to an inquiry (used by inquiry.html table)
router.post('/:id/reply', requireRole('owner'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid id' });

  const reply_message = (req.body && req.body.reply_message ? String(req.body.reply_message) : '').trim();
  if (!reply_message) return res.status(400).json({ success: false, message: 'กรุณากรอกข้อความตอบกลับ' });

  try {
    const conn = await pool.getConnection();
    try {
      const [result] = await conn.execute(
        `UPDATE inquiries
         SET reply_message = ?, replied_at = NOW(), status = 'replied'
         WHERE inquiry_id = ?`,
        [reply_message, id]
      );

      if (!result || result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'ไม่พบข้อมูล' });
      }

      return res.json({ success: true });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    return res.status(503).json({ success: false, message: 'บันทึกคำตอบไม่สำเร็จ' });
  }
});

// Owner: delete inquiry
router.delete('/:id', requireRole('owner'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid id' });

  try {
    const conn = await pool.getConnection();
    try {
      const [result] = await conn.execute('DELETE FROM inquiries WHERE inquiry_id = ?', [id]);
      if (!result || result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: 'ไม่พบข้อมูล' });
      }
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
