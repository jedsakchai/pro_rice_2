const express = require('express');

const pool = require('../config/database');

const router = express.Router();

router.post('/', async (req, res) => {
  const body = req.body || {};
  const name = (body.name ? String(body.name) : '').trim();
  const email = (body.email ? String(body.email) : '').trim();
  const phone = (body.phone ? String(body.phone) : '').trim();
  const message = (body.message ? String(body.message) : '').trim();
  const subject = (body.subject ? String(body.subject) : '').trim();

  if (!name || !email || !message) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบถ้วน' });
  }

  try {
    const conn = await pool.getConnection();
    try {
      const [result] = await conn.execute(
        `INSERT INTO contacts (name, email, phone, message, subject)
         VALUES (?, ?, ?, ?, ?)`,
        [name, email, phone || null, message, subject || null]
      );

      return res.status(201).json({ success: true, data: { contact_id: Number(result.insertId) } });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    return res.status(503).json({ success: false, message: 'ไม่สามารถบันทึกข้อมูลได้' });
  }
});

module.exports = router;
