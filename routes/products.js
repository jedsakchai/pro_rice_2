const express = require('express');
const pool = require('../config/database');

const router = express.Router();

// GET /api/products — ดึงรายการผลิตภัณฑ์
// สามารถกรองตามหมวดหมู่ได้
router.get('/', async (req, res) => {
  try {
    const category = req.query.category ? String(req.query.category).trim() : '';
    let rows;

    if (category) {
      [rows] = await pool.query(
        `SELECT p.product_id, p.category, p.category_th, p.product_name, p.product_name_th, 
                p.description, p.description_th, p.price, p.unit, p.unit_th, p.stock, p.image_url, p.mill_id,
                (p.image_data IS NOT NULL AND p.image_data != '') AS has_image,
                COALESCE(m.mill_name_th, m.mill_name, '') AS mill_name_th,
                COALESCE(m.mill_name, '') AS mill_name
         FROM products p
         LEFT JOIN mills m ON m.mill_id = p.mill_id
         WHERE p.is_available = TRUE AND p.category = ?
         ORDER BY p.product_name_th`,
        [category]
      );
    } else {
      [rows] = await pool.query(
        `SELECT p.product_id, p.category, p.category_th, p.product_name, p.product_name_th, 
                p.description, p.description_th, p.price, p.unit, p.unit_th, p.stock, p.image_url, p.mill_id,
                (p.image_data IS NOT NULL AND p.image_data != '') AS has_image,
                COALESCE(m.mill_name_th, m.mill_name, '') AS mill_name_th,
                COALESCE(m.mill_name, '') AS mill_name
         FROM products p
         LEFT JOIN mills m ON m.mill_id = p.mill_id
         WHERE p.is_available = TRUE
         ORDER BY p.category, p.product_name_th`
      );
    }

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(503).json({ success: false, message: 'ไม่สามารถดึงข้อมูลสินค้าได้' });
  }
});

// GET /api/products/:id — ดึงผลิตภัณฑ์ตามไอดี
router.get('/:id', async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT p.product_id, p.category, p.category_th, p.product_name, p.product_name_th, 
              p.description, p.description_th, p.price, p.unit, p.unit_th, p.stock, p.image_url, p.mill_id,
              (p.image_data IS NOT NULL AND p.image_data != '') AS has_image,
              COALESCE(m.mill_name_th, m.mill_name, '') AS mill_name_th,
              COALESCE(m.mill_name, '') AS mill_name
       FROM products p
       LEFT JOIN mills m ON m.mill_id = p.mill_id
       WHERE p.product_id = ? AND p.is_available = TRUE`,
      [productId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'ไม่พบสินค้า' });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(503).json({ success: false, message: 'ไม่สามารถดึงข้อมูลสินค้าได้' });
  }
});

// GET /api/products/:id/image — ดึงรูปภาพสินค้า
router.get('/:id/image', async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT image_data, image_mime_type 
       FROM products 
       WHERE product_id = ? AND is_available = TRUE`,
      [productId]
    );

    if (!rows || rows.length === 0 || !rows[0].image_data) {
      return res.status(404).send(null); // Return 404 if no image
    }

    res.set('Content-Type', rows[0].image_mime_type || 'image/jpeg');
    res.send(rows[0].image_data);
  } catch (err) {
    console.error('get product image failed', err);
    res.status(500).json({ success: false, message: 'ไม่สามารถดึงรูปภาพได้' });
  }
});

// GET /api/products/categories — ดึงรายการหมวดหมู่
router.get('/categories/list', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT category, category_th 
       FROM products 
       WHERE is_available = TRUE 
       ORDER BY category`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    return res.status(503).json({ success: false, message: 'ไม่สามารถดึงข้อมูลหมวดหมู่ได้' });
  }
});

module.exports = router;
