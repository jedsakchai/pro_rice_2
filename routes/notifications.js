// routes/notifications.js
const express = require('express');
const pool = require('../config/database');
const { requireRole } = require('../middleware/ownerAuth');

const router = express.Router();

function parseSessionFromHeader(req) {
  let session = null;
  const raw = req.headers['x-session-data'];
  if (raw) {
    try {
      const dec = Buffer.from(String(raw), 'base64').toString('utf8');
      session = JSON.parse(dec);
    } catch (e) {
      try { session = JSON.parse(raw); } catch (e2) { session = null; }
    }
  }
  return session;
}

function threadKey(type, resourceId) {
  return `${String(type || '').trim()}-${Number(resourceId)}`;
}

function dedupeLatestByThread(rows) {
  const seen = new Set();
  const list = [];
  for (const row of rows || []) {
    const key = threadKey(row.type, row.resource_id);
    if (!seen.has(key)) {
      seen.add(key);
      list.push(row);
    }
  }
  return list;
}

// GET /api/notifications/count — ดึงจำนวนการแจ้งเตือนที่ยังไม่ได้อ่าน
router.get('/count', async (req, res) => {
    try {
    const session = parseSessionFromHeader(req);
    const villager_id = session?.villager_id || null;

    if (!villager_id) {
      return res.json({ success: true, data: { pending_orders: 0, pending_milling: 0, total: 0 } });
    }

    // Prefer unread latest thread items from notifications table when available
    try {
      const [notificationRows] = await pool.query(
        `SELECT notification_id, villager_id, type, resource_id, status, message, is_read, created_at
         FROM notifications
         WHERE villager_id = ?
         ORDER BY created_at DESC, notification_id DESC
         LIMIT 500`,
        [villager_id]
      );
      const unread = dedupeLatestByThread(notificationRows)
        .filter((row) => !Number(row.is_read))
        .filter((row) => !['completed', 'cancelled', 'delivered'].includes(String(row.status || '')))
        .length;
      return res.json({
        success: true,
        data: {
          pending_orders: 0,
          pending_milling: 0,
          total: Number(unread),
        }
      });
    } catch (tableErr) {
      console.error('notifications unread count fallback:', tableErr && tableErr.message);
    }

    // Count non-final orders (not completed or cancelled)
    const [orderRows] = await pool.query(
      `SELECT COUNT(*) as count FROM orders 
       WHERE villager_id = ? AND status NOT IN ('completed', 'cancelled')`,
      [villager_id]
    );
    const pending_orders = (orderRows && orderRows[0] && orderRows[0].count) || 0;

    // Count non-final milling requests (not completed or cancelled)
    const [millingRows] = await pool.query(
      `SELECT COUNT(*) as count FROM milling_requests 
       WHERE submitted_by = ? AND status NOT IN ('completed', 'cancelled')`,
      [villager_id]
    );
    const pending_milling = (millingRows && millingRows[0] && millingRows[0].count) || 0;

    const total = Number(pending_orders) + Number(pending_milling);

    res.json({
      success: true,
      data: {
        pending_orders: Number(pending_orders),
        pending_milling: Number(pending_milling),
        total: total
      }
    });
  } catch (err) {
    console.error('notifications count error:', err);
    res.json({ success: true, data: { pending_orders: 0, pending_milling: 0, total: 0 } });
  }
});

// GET /api/notifications/items — ดึงรายละเอียดการแจ้งเตือนทั้งหมด (orders + milling requests ที่ยังไม่เสร็จ)
router.get('/items', async (req, res) => {
    try {
    const session = parseSessionFromHeader(req);
    const villager_id = session?.villager_id || null;

    if (!villager_id) {
      return res.json({ success: true, data: [] });
    }

    // Prefer persistent notifications table if available, return the latest item for each thread.
    try {
      const [notes] = await pool.query(
        `SELECT notification_id, villager_id, type, resource_id, status, message, is_read, created_at
         FROM notifications
          WHERE villager_id = ?
         ORDER BY created_at DESC, notification_id DESC
         LIMIT 200`,
        [villager_id]
      );

      // Return only the latest notification for each type/resource thread.
      const mapped = dedupeLatestByThread(Array.isArray(notes) ? notes : [])
        .filter((r) => !['completed', 'cancelled', 'delivered'].includes(String(r.status || '')))
        .map((r) => ({
        id: threadKey(r.type, r.resource_id),
        type: r.type,
        resource_id: r.resource_id,
        status: r.status,
        message: r.message,
        is_read: !!r.is_read,
        created_at: r.created_at
      }));
      return res.json({ success: true, data: mapped });
    } catch (e) {
      // If notifications table doesn't exist, fall back to derived queries
      console.error('notifications table query failed, falling back:', e && e.message);
    }

    // Fallback: derive from current orders and milling_requests (older behavior)
    const [orders] = await pool.query(
      `SELECT 
        order_id as resource_id, 
        total, 
        status, 
        created_at,
        'order' as type
       FROM orders 
      WHERE villager_id = ? AND status NOT IN ('completed', 'cancelled', 'delivered')
       ORDER BY created_at DESC`,
      [villager_id]
    );

    const [millings] = await pool.query(
      `SELECT 
        request_id as resource_id,
        rice_type,
        sacks,
        status,
        created_at,
        'milling' as type
       FROM milling_requests 
      WHERE submitted_by = ? AND status NOT IN ('delivered', 'cancelled', 'completed')
       ORDER BY created_at DESC`,
      [villager_id]
    );

    // Combine and sort by created_at
    const items = [...orders, ...millings].sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );

    // If no non-final items found, include recent orders (any status) so user sees order statuses
    if ((!items || items.length === 0)) {
      try {
        const [recentOrders] = await pool.query(
          `SELECT order_id as resource_id, total, status, created_at, 'order' as type
           FROM orders
           WHERE villager_id = ?
           ORDER BY created_at DESC
           LIMIT 50`,
          [villager_id]
        );

        if (Array.isArray(recentOrders) && recentOrders.length > 0) {
          return res.json({ success: true, data: recentOrders });
        }
      } catch (e) {
        console.error('fallback recent orders failed:', e && e.message);
      }
    }

    res.json({ success: true, data: items });
  } catch (err) {
    console.error('notifications items error:', err);
    res.json({ success: true, data: [] });
  }
});

module.exports = router;

// Mark a single notification thread as read
router.post('/:id/read', async (req, res) => {
  try {
    const session = parseSessionFromHeader(req);
    const villager_id = session?.villager_id || null;
    if (!villager_id) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const idParam = String(req.params.id);
    let query = 'UPDATE notifications SET is_read = TRUE WHERE villager_id = ?';
    let params = [villager_id];
    
    // Check if idParam is numeric (notification_id) or pseudo-id like "type-resource_id"
    const numId = Number(idParam);
    if (Number.isFinite(numId)) {
      // Numeric notification_id
      query += ' AND notification_id = ?';
      params.push(numId);
    } else if (idParam.includes('-')) {
      // Pseudo-id like "order-4" or "milling-15"
      const [type, resourceId] = idParam.split('-');
      if (['order', 'milling'].includes(type)) {
        const resId = Number(resourceId);
        if (!Number.isFinite(resId)) return res.status(400).json({ success: false, message: 'Invalid resource id' });
        query += ' AND type = ? AND resource_id = ?';
        params.push(type, resId);
      } else {
        return res.status(400).json({ success: false, message: 'Invalid id format' });
      }
    } else {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }

    await pool.query(query, params);
    return res.json({ success: true });
  } catch (err) {
    console.error('mark notification read error:', err);
    return res.status(500).json({ success: false, message: 'Unable to mark read' });
  }
});

// Mark all notifications for this villager as read
router.post('/mark-all-read', async (req, res) => {
  try {
    const session = parseSessionFromHeader(req);
    const villager_id = session?.villager_id || null;
    if (!villager_id) return res.status(401).json({ success: false, message: 'Unauthorized' });

    await pool.query('UPDATE notifications SET is_read = TRUE WHERE villager_id = ?', [villager_id]);
    return res.json({ success: true });
  } catch (err) {
    console.error('mark all read error:', err);
    return res.status(500).json({ success: false, message: 'Unable to mark all read' });
  }
});

// GET /api/notifications/:type/:resourceId/timeline — show full status timeline for a thread
router.get('/:type/:resourceId/timeline', async (req, res) => {
  try {
    const session = parseSessionFromHeader(req);
    const villager_id = session?.villager_id || null;
    const type = String(req.params.type || '').trim();
    const resourceId = Number(req.params.resourceId);

    if (!villager_id) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!['order', 'milling'].includes(type) || !Number.isFinite(resourceId)) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    const [rows] = await pool.query(
      `SELECT notification_id, type, resource_id, status, message, is_read, created_at
       FROM notifications
       WHERE villager_id = ? AND type = ? AND resource_id = ?
       ORDER BY created_at DESC, notification_id DESC`,
      [villager_id, type, resourceId]
    );

    return res.json({
      success: true,
      data: {
        type,
        resource_id: resourceId,
        items: rows || []
      }
    });
  } catch (err) {
    console.error('notification timeline error:', err);
    return res.status(500).json({ success: false, message: 'Unable to load timeline' });
  }
});

// POST /api/notifications/:type/:resourceId/cancel — allow villager to cancel their order/milling
router.post('/:type/:resourceId/cancel', async (req, res) => {
  try {
    const session = parseSessionFromHeader(req);
    const villager_id = session?.villager_id || null;
    if (!villager_id) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const type = String(req.params.type || '').trim();
    const resourceId = Number(req.params.resourceId);
    if (!['order','milling'].includes(type) || !Number.isFinite(resourceId)) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    const payload = req.body || {};
    const choices = Array.isArray(payload.choices) ? payload.choices.map(String) : [];
    const note = payload.note ? String(payload.note).trim() : '';

    const conn = await pool.getConnection();
    try {
      if (type === 'order') {
        // verify ownership
        const [rows] = await conn.execute('SELECT villager_id, status FROM orders WHERE order_id = ? LIMIT 1', [resourceId]);
        const order = rows && rows[0];
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        if (Number(order.villager_id) !== Number(villager_id)) return res.status(403).json({ success: false, message: 'Forbidden' });

        const cancelable = new Set(['pending','accepted','pending_payment','payment_review','paid','preparing']);
        if (!cancelable.has(String(order.status || ''))) {
          return res.status(400).json({ success: false, message: 'Order cannot be cancelled at this stage' });
        }

        const reasonParts = [];
        if (choices.length) reasonParts.push(`ตัวเลือก: ${choices.join(', ')}`);
        if (note) reasonParts.push(`หมายเหตุ: ${note}`);
        const reasonText = reasonParts.length ? (`ยกเลิกโดยลูกค้า — ${reasonParts.join(' | ')}`) : 'ยกเลิกโดยลูกค้า';

        await conn.execute('UPDATE orders SET status = ?, cancel_reason = ?, cancelled_at = CURRENT_TIMESTAMP WHERE order_id = ?', ['cancelled', reasonText, resourceId]);

        await conn.execute(
          'INSERT INTO notifications (villager_id, type, resource_id, status, message) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), message = VALUES(message), is_read = FALSE, created_at = CURRENT_TIMESTAMP',
          [villager_id, 'order', resourceId, 'cancelled', reasonText]
        );
        return res.json({ success: true });
      }

      // milling
      const [mrows] = await conn.execute('SELECT submitted_by, status FROM milling_requests WHERE request_id = ? LIMIT 1', [resourceId]);
      const mreq = mrows && mrows[0];
      if (!mreq) return res.status(404).json({ success: false, message: 'Request not found' });
      if (Number(mreq.submitted_by) !== Number(villager_id)) return res.status(403).json({ success: false, message: 'Forbidden' });

      const millingCancelable = new Set(['pending_review','accepted','awaiting_pickup']);
      if (!millingCancelable.has(String(mreq.status || ''))) {
        return res.status(400).json({ success: false, message: 'Milling request cannot be cancelled at this stage' });
      }

      const reasonParts = [];
      if (choices.length) reasonParts.push(`ตัวเลือก: ${choices.join(', ')}`);
      if (note) reasonParts.push(`หมายเหตุ: ${note}`);
      const reasonText = reasonParts.length ? (`ยกเลิกโดยลูกค้า — ${reasonParts.join(' | ')}`) : 'ยกเลิกโดยลูกค้า';

      await conn.execute('UPDATE milling_requests SET status = ?, cancel_reason = ?, cancelled_at = CURRENT_TIMESTAMP WHERE request_id = ?', ['cancelled', reasonText, resourceId]);

      await conn.execute(
        'INSERT INTO notifications (villager_id, type, resource_id, status, message) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), message = VALUES(message), is_read = FALSE, created_at = CURRENT_TIMESTAMP',
        [villager_id, 'milling', resourceId, 'cancelled', reasonText]
      );
      return res.json({ success: true });
    } finally {
      try { if (conn) conn.release(); } catch (e) { /* ignore */ }
    }
  } catch (err) {
    console.error('cancel notification error:', err);
    return res.status(500).json({ success: false, message: String(err && err.message ? err.message : 'Unable to cancel'), stack: err && err.stack });
  }
});
