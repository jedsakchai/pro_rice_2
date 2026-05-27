const express = require('express');
const pool = require('../config/database');
const { requireRole } = require('../middleware/ownerAuth');

const router = express.Router();

// GET /api/owner/products?mill_id= — list products for owner's mill
router.get('/', requireRole('owner'), async (req, res) => {
  try {
    const millId = Number(req.query.mill_id || req.owner.mill_id || 0) || 0;
    if (!millId) return res.status(400).json({ success: false, message: 'Missing mill_id' });

    const [rows] = await pool.query(
      `SELECT product_id, category, category_th, product_name, product_name_th, description, description_th, price, unit, unit_th, stock, image_url, mill_id, is_available
       FROM products WHERE mill_id = ? ORDER BY product_name_th`,
      [millId]
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('owner products list failed', err);
    res.status(500).json({ success: false, message: 'ไม่สามารถดึงรายการสินค้าได้' });
  }
});

// POST /api/owner/products — create product (owner only)
router.post('/', requireRole('owner'), async (req, res) => {
  try {
    const body = req.body || {};
    const millId = Number(body.mill_id || req.owner.mill_id || 0) || 0;
    if (!millId) return res.status(400).json({ success: false, message: 'Missing mill_id' });

    const fields = [
      'category','category_th','product_name','product_name_th','description','description_th',
      'price','unit','unit_th','stock','image_url','is_available'
    ];

    const vals = fields.map(f => body[f] === undefined ? null : body[f]);
    // ensure numeric types
    vals[6] = Number(vals[6] || 0);
    vals[9] = Number(vals[9] || 0);
    vals[11] = Number(vals[11] == null ? 1 : vals[11]);

    const [result] = await pool.query(
      `INSERT INTO products (category, category_th, product_name, product_name_th, description, description_th, price, unit, unit_th, stock, image_url, mill_id, is_available)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...vals.slice(0,11), millId, vals[11]]
    );

    res.json({ success: true, product_id: result.insertId });
  } catch (err) {
    console.error('owner products create failed', err);
    res.status(500).json({ success: false, message: 'ไม่สามารถเพิ่มสินค้าได้' });
  }
});

// DELETE /api/owner/products/:id — delete product (owner only)
router.delete('/:id', requireRole('owner'), async (req, res) => {
  try {
    const id = Number(req.params.id || 0) || 0;
    if (!id) return res.status(400).json({ success: false, message: 'Missing product id' });

    const ownerMillId = Number(req.owner.mill_id || 0) || 0;
    // Ensure the product belongs to owner's mill
    const [rows] = await pool.query('SELECT mill_id FROM products WHERE product_id = ?', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบสินค้า' });
    const prodMillId = Number(rows[0].mill_id || 0);
    if (ownerMillId && prodMillId !== ownerMillId) return res.status(403).json({ success: false, message: 'ไม่อนุญาต' });

    await pool.query('DELETE FROM products WHERE product_id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('owner products delete failed', err);
    res.status(500).json({ success: false, message: 'ไม่สามารถลบสินค้าได้' });
  }
});

module.exports = router;
