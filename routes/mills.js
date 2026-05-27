const express = require('express');
const pool = require('../config/database');
const { optionalOwnerAuth } = require('../middleware/ownerAuth');

const router = express.Router();

// GET /api/mills — ดึงรายการโรงสี
// owner: เฉพาะโรงสีตัวเอง, อื่นๆ: ทุกโรงสีที่ active
router.get('/', optionalOwnerAuth, async (req, res) => {
  try {
    let rows;
    if (req.owner && req.owner.role === 'owner' && req.owner.mill_id) {
      [rows] = await pool.query(
        `SELECT mill_id, mill_name, mill_name_th, location_th, phone, email, latitude, longitude, capacity_per_day
          FROM mills
          WHERE mill_id = ? AND is_active = TRUE`,
        [req.owner.mill_id]
      );
    } else {
      [rows] = await pool.query(
        `SELECT mill_id, mill_name, mill_name_th, location_th, phone, email, latitude, longitude, capacity_per_day
          FROM mills
          WHERE is_active = TRUE
          ORDER BY mill_id`
      );
    }
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(503).json({ success: false, message: 'ไม่สามารถดึงข้อมูลได้' });
  }
});

module.exports = router;
