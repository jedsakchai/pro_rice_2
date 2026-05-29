const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');
const { optionalOwnerAuth } = require('../middleware/ownerAuth');
const { recordStatusHistory } = require('../utils/status-history');

const router = express.Router();

// Storage for uploaded slips
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

function stringifyCancelReason(value) {
  if (Array.isArray(value)) return JSON.stringify(value.filter(Boolean));
  if (value && typeof value === 'object') return JSON.stringify(value);
  const text = String(value || '').trim();
  return text ? JSON.stringify([text]) : null;
}

function generateOrderNumber() {
  const now = Date.now();
  const r = Math.floor(Math.random() * 9000) + 1000;
  return `ORD-${now}-${r}`;
}

function normalizeStatus(value) {
  const status = String(value || '').trim();
  const aliases = {
    pending: 'pending',
    accepted: 'accepted',
    awaiting_payment: 'payment_review',
    confirmed: 'accepted',
    shipped: 'shipping',
  };
  const canonical = aliases[status] || status;
  const allowed = new Set(['pending', 'accepted', 'pending_payment', 'payment_review', 'paid', 'preparing', 'ready_to_ship', 'shipping', 'completed', 'cancelled']);
  return allowed.has(canonical) ? canonical : 'pending';
}

async function resolveMillIdForItems(conn, items) {
  const productIds = Array.from(new Set(items.map((item) => Number(item && item.product_id)).filter((id) => Number.isFinite(id) && id > 0)));
  if (productIds.length === 0) return null;

  const [rows] = await conn.query(
    `SELECT product_id, mill_id
     FROM products
     WHERE product_id IN (?)`,
    [productIds]
  );

  const millIds = rows
    .map((row) => Number(row && row.mill_id))
    .filter((millId) => Number.isFinite(millId) && millId > 0);

  if (millIds.length === 0) return null;

  const uniqueMillIds = Array.from(new Set(millIds));
  return uniqueMillIds[0];
}

function groupItemsByMill(items) {
  const groups = new Map();

  for (const item of items || []) {
    const millId = Number(item && item.mill_id);
    const key = Number.isFinite(millId) && millId > 0 ? millId : 'unknown';
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  }

  return Array.from(groups.entries()).map(([millId, groupItems]) => ({ millId, items: groupItems }));
}

async function createOrderRecord(conn, payload, items, options = {}) {
  const orderNumber = generateOrderNumber();
  const orderStatus = 'pending';
  const subtotal = items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
  const shipping_fee = Number(options.shipping_fee ?? payload.shipping_fee ?? 0) || 0;
  const total = Number(options.total ?? (subtotal + shipping_fee)) || (subtotal + shipping_fee);
  const mill_id = Number(options.mill_id ?? payload.mill_id ?? null) || null;

  const [result] = await conn.execute(
    `INSERT INTO orders (order_number, mill_id, villager_id, customer_name, phone, address, shipping_method, shipping_fee, payment_method, note, total, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderNumber,
      mill_id,
      payload.villager_id,
      payload.customer_name,
      payload.phone,
      payload.address,
      payload.shipping_method,
      shipping_fee,
      payload.payment_method,
      payload.note,
      total,
      orderStatus,
    ]
  );

  const orderId = result.insertId;
  const itemPromises = items.map((it) => {
    const pid = Number(it.product_id || 0);
    const pname = String(it.product_name_th || it.product_name || '').trim();
    const price = Number(it.price || 0) || 0;
    const qty = Number(it.quantity || 0) || 0;
    const subtotalItem = Number(it.subtotal || (price * qty)) || (price * qty);
    return conn.execute(
      'INSERT INTO order_items (order_id, product_id, product_name_th, price, quantity, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
      [orderId, pid, pname, price, qty, subtotalItem]
    );
  });

  await Promise.all(itemPromises);

  await recordStatusHistory(conn, {
    resourceType: 'order',
    resourceId: orderId,
    fromStatus: null,
    toStatus: orderStatus,
  });

  return { order_id: orderId, order_number: orderNumber, mill_id, total, shipping_fee };
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

// When creating an order, also insert a notification for the villager (if provided)

// Create order
router.post('/', async (req, res) => {
  const body = req.body || {};
  const customer_name = String(body.customer_name || '').trim();
  const phone = String(body.phone || '').trim();
  const address = String(body.address || '').trim();
  const shipping_method = body.shipping_method === 'pickup' ? 'pickup' : 'delivery';
  const shipping_fee = Number(body.shipping_fee || 0) || 0;
  const payment_method = ['bank_transfer','cod','promptpay'].includes(body.payment_method) ? body.payment_method : 'bank_transfer';
  const note = String(body.note || '').trim();
  const items = Array.isArray(body.items) ? body.items : [];
  const total = Number(body.total || 0) || 0;
  const villager_id = Number(body.villager_id || 0) || null;

  if (!customer_name || !phone || !address) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อ เบอร์ และที่อยู่' });
  }
  const hasGroupedOrders = Array.isArray(body.orders) && body.orders.length > 0;
  if ((!Array.isArray(items) || items.length === 0) && !hasGroupedOrders) {
    return res.status(400).json({ success: false, message: 'ตะกร้าสินค้าเปล่า' });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

      const groupedOrders = Array.isArray(body.orders) && body.orders.length > 0
        ? body.orders
        : null;

      if (groupedOrders && groupedOrders.length > 1) {
        const createdOrders = [];
        for (let index = 0; index < groupedOrders.length; index += 1) {
          const group = groupedOrders[index] || {};
          const groupItems = Array.isArray(group.items) ? group.items : [];
          if (groupItems.length === 0) continue;

          const baseShippingFee = Number(index === 0 ? (group.shipping_fee ?? shipping_fee) : 0) || 0;
          const created = await createOrderRecord(conn, {
            customer_name,
            phone,
            address,
            shipping_method,
            payment_method,
            note,
            villager_id,
            mill_id: group.mill_id || null,
          }, groupItems, {
            shipping_fee: baseShippingFee,
            total: Number(group.total ?? (groupItems.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0) + baseShippingFee)) || 0,
            mill_id: group.mill_id || null,
          });
          createdOrders.push(created);
        }

        await conn.commit();
        return res.json({ success: true, orders: createdOrders });
      }

      const mill_id = await resolveMillIdForItems(conn, items);

      await syncVillagerContact(conn, villager_id, {
        customer_name,
        phone,
        address,
      });

      const created = await createOrderRecord(conn, {
        customer_name,
        phone,
        address,
        shipping_method,
        shipping_fee,
        payment_method,
        note,
        villager_id,
        mill_id,
      }, items, {
        shipping_fee,
        total,
        mill_id,
      });

      // Create initial notification for the created order(s)
      try {
        if (created && created.order_id) {
          const message = `คำสั่งซื้อถูกสร้าง: #${created.order_number}`;
          await conn.execute(
            'INSERT INTO notifications (villager_id, type, resource_id, status, message) VALUES (?, ?, ?, ?, ?)',
            [villager_id, 'order', created.order_id, 'pending', message]
          );
        } else if (Array.isArray(created)) {
          for (const c of created) {
            try {
              const message = `คำสั่งซื้อถูกสร้าง: #${c.order_number}`;
              await conn.execute('INSERT INTO notifications (villager_id, type, resource_id, status, message) VALUES (?, ?, ?, ?, ?)', [villager_id, 'order', c.order_id, 'pending', message]);
            } catch (e) { /* ignore per-order errors */ }
          }
        }
      } catch (e) {
        console.error('create initial notification (order) error:', e && e.message);
      }

      await conn.commit();
      res.json({ success: true, order_id: created.order_id, order_number: created.order_number });
  } catch (err) {
    console.error('create order failed', err);
    try {
      if (conn) {
        await conn.rollback();
      }
    } catch {
      // ignore rollback issues
    }
    res.status(500).json({ success: false, message: 'สร้างคำสั่งซื้อไม่สำเร็จ' });
  } finally {
    if (conn) conn.release();
  }
});

// List orders for owner dashboard or villager history
router.get('/count', optionalOwnerAuth, async (req, res) => {
  const millId = req.owner && req.owner.mill_id ? Number(req.owner.mill_id) : null;

  if (!millId) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM orders
       WHERE mill_id = ?
         AND status IN ('pending', 'accepted', 'pending_payment', 'payment_review')`,
      [millId]
    );

    const count = rows && rows[0] ? Number(rows[0].count) || 0 : 0;
    return res.json({ success: true, data: { count } });
  } catch (err) {
    console.error('order count failed', err);
    return res.status(500).json({ success: false, message: 'ไม่สามารถดึงจำนวนคำสั่งซื้อได้' });
  }
});

// List orders for owner dashboard or villager history
router.get('/', async (req, res) => {
  const sessionMillId = req.query.mill_id ? Number(req.query.mill_id) : null;
  const sessionVillagerId = req.query.villager_id ? Number(req.query.villager_id) : null;
  const status = String(req.query.status || '').trim();
  const limit = Math.min(Number(req.query.limit || 100) || 100, 200);
  const offset = Math.max(Number(req.query.offset || 0) || 0, 0);

  try {
    const conn = await pool.getConnection();
    try {
      const where = [];
      const params = [];

      // Filter by mill_id (owner view)
      if (Number.isFinite(sessionMillId) && sessionMillId > 0) {
        where.push('o.mill_id = ?');
        params.push(sessionMillId);
      }
      
      // Filter by villager_id (villager view)
      if (Number.isFinite(sessionVillagerId) && sessionVillagerId > 0) {
        where.push('o.villager_id = ?');
        params.push(sessionVillagerId);
      }
      
      if (status) {
        where.push('o.status = ?');
        params.push(status);
      }

      const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const [rows] = await conn.execute(
        `SELECT
           o.order_id,
           o.order_number,
           o.mill_id,
           o.villager_id,
           o.customer_name,
           o.phone,
           o.address,
           o.shipping_method,
           o.shipping_fee,
           o.payment_method,
           o.payment_proof_url,
           o.note,
           o.total,
           o.status,
           o.created_at,
           o.updated_at,
           COALESCE(m.mill_name_th, m.mill_name, '') AS mill_name_th,
           COALESCE(m.mill_name, '') AS mill_name,
           COUNT(oi.order_item_id) AS item_count,
           SUM(oi.quantity) AS total_quantity,
           MIN(oi.product_name_th) AS first_item_name
         FROM orders o
         LEFT JOIN mills m ON m.mill_id = o.mill_id
         LEFT JOIN order_items oi ON oi.order_id = o.order_id
         ${whereSql}
         GROUP BY o.order_id
         ORDER BY o.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      res.json({ success: true, data: rows || [] });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('list orders failed', err);
    res.status(500).json({ success: false, message: 'ไม่สามารถดึงรายการคำสั่งซื้อได้' });
  }
});

// Upload payment slip
router.post('/:id/upload-slip', upload.single('slip'), async (req, res) => {
  const id = Number(req.params.id);
  if (!req.file) return res.status(400).json({ success: false, message: 'ไม่มีไฟล์แนบ' });
  const urlPath = `/uploads/${req.file.filename}`;

  try {
    const conn = await pool.getConnection();
    try {
      await conn.execute('UPDATE orders SET payment_proof_url = ?, status = ? WHERE order_id = ?', [urlPath, 'payment_review', id]);
      res.json({ success: true, url: urlPath });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('upload slip failed', err);
    res.status(500).json({ success: false, message: 'อัปโหลดไม่สำเร็จ' });
  }
});

// Update order status/details
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const status = normalizeStatus(req.body && req.body.status);
  const payment_proof_url = req.body && req.body.payment_proof_url ? String(req.body.payment_proof_url).trim() : '';
  const cancelReason = stringifyCancelReason(req.body && req.body.cancel_reason);

  try {
    const conn = await pool.getConnection();
    try {
      const [beforeRows] = await conn.execute('SELECT status, villager_id FROM orders WHERE order_id = ? LIMIT 1', [id]);
      const before = beforeRows && beforeRows[0] ? beforeRows[0] : null;

      const sets = ['status = ?'];
      const values = [status];

      if (payment_proof_url) {
        sets.push('payment_proof_url = ?');
        values.push(payment_proof_url);
      }

      if (status === 'cancelled') {
        sets.push('cancel_reason = ?');
        values.push(cancelReason);
        sets.push('cancelled_at = CURRENT_TIMESTAMP');
      }

      values.push(id);
      const [result] = await conn.execute(`UPDATE orders SET ${sets.join(', ')} WHERE order_id = ?`, values);
      if (!result.affectedRows) {
        return res.status(404).json({ success: false, message: 'ไม่พบคำสั่งซื้อ' });
      }

      if (before && String(before.status || '').trim() !== status) {
        await recordStatusHistory(conn, {
          resourceType: 'order',
          resourceId: id,
          fromStatus: before.status,
          toStatus: status,
        });
      }

      // Record a new notification event for the villager about this status change
      try {
        const order = before;
        if (order && order.villager_id) {
          const message = status === 'cancelled' ? 'ยกเลิกคำสั่งซื้อสินค้าแล้ว' : `สถานะคำสั่งซื้อเปลี่ยนเป็น ${String(status)}`;
          try {
            await conn.execute(
              'INSERT INTO notifications (villager_id, type, resource_id, status, message) VALUES (?, ?, ?, ?, ?)',
              [order.villager_id, 'order', id, status, message]
            );
          } catch (ne) {
            console.error('sync notification (order) error:', ne && ne.message);
          }
        }
      } catch (e) {
        // Ignore notification errors (don't break update)
        console.error('create notification error:', e);
      }

      res.json({ success: true });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('update order failed', err);
    res.status(500).json({ success: false, message: 'อัปเดตคำสั่งซื้อไม่สำเร็จ' });
  }
});

// Get order by id
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute('SELECT * FROM orders WHERE order_id = ? LIMIT 1', [id]);
      if (!rows || !rows[0]) return res.status(404).json({ success: false, message: 'ไม่พบคำสั่งซื้อ' });
      const order = rows[0];
      const [items] = await conn.execute('SELECT * FROM order_items WHERE order_id = ?', [id]);
      order.items = items || [];
      res.json({ success: true, data: order });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('get order failed', err);
    res.status(500).json({ success: false, message: 'ไม่สามารถดึงคำสั่งซื้อได้' });
  }
});

module.exports = router;
