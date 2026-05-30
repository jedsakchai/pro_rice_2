// routes/notifications.js
const express = require('express');
const pool = require('../config/database');
const { requireRole } = require('../middleware/ownerAuth');
const { loadStatusHistory, recordStatusHistory } = require('../utils/status-history');

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

const CANCELLATION_STATUS_LABELS = {
  pending_cancel: 'รอยืนยันการยกเลิก',
  approved_cancel: 'ยกเลิกสำเร็จแล้ว',
  rejected_cancel: 'ปฏิเสธคำขอยกเลิก',
};

function getCancellationTargetLabel(type) {
  return type === 'order' ? 'คำสั่งซื้อสินค้า' : 'คำขอสีข้าว';
}

function getCancellationResourceStatusLabel(type, status) {
  const value = String(status || '').trim();
  if (value === 'cancelled') {
    return type === 'order' ? 'ยกเลิกคำสั่งซื้อสินค้าแล้ว' : 'ยกเลิกคำขอสีข้าวแล้ว';
  }

  if (type === 'order') {
    const map = {
      pending: 'รอดำเนินการ',
      accepted: 'ยอมรับคำสั่งซื้อแล้ว',
      pending_payment: 'รอชำระเงิน',
      payment_review: 'รอตรวจสอบการชำระเงิน',
      paid: 'ชำระเงินแล้ว',
      preparing: 'กำลังเตรียมสินค้า',
      ready_to_ship: 'พร้อมจัดส่ง',
      shipping: 'จัดส่งแล้ว',
      completed: 'สำเร็จ',
    };
    return map[value] || value || '-';
  }

  const map = {
    pending_review: 'รอตรวจสอบ',
    accepted: 'รับคำสั่งแล้ว',
    awaiting_pickup: 'รอไปรับข้าว',
    received: 'รับข้าวแล้ว',
    queued: 'รอคิวสี',
    milling: 'กำลังสีข้าว',
    packing: 'กำลังแพ็ก',
    ready: 'พร้อมรับ/จัดส่ง',
    shipping: 'กำลังจัดส่ง',
    delivered: 'ส่งมอบแล้ว',
  };
  return map[value] || value || '-';
}

const CANCELLATION_CONFIG = {
  order: {
    table: 'orders',
    idColumn: 'order_id',
    ownerColumn: 'villager_id',
    millColumn: 'mill_id',
    cancelableStatuses: new Set(['pending', 'accepted', 'pending_payment', 'payment_review', 'paid', 'preparing']),
    typeLabel: 'คำสั่งซื้อ',
  },
  milling: {
    table: 'milling_requests',
    idColumn: 'request_id',
    ownerColumn: 'submitted_by',
    millColumn: 'mill_id',
    cancelableStatuses: new Set(['pending_review', 'accepted', 'awaiting_pickup']),
    typeLabel: 'คำขอสีข้าว',
  },
};

function normalizeCancellationType(type) {
  const value = String(type || '').trim();
  return value === 'order' || value === 'milling' ? value : null;
}

function normalizeCancellationStatus(status) {
  const value = String(status || '').trim();
  return ['pending_cancel', 'approved_cancel', 'rejected_cancel'].includes(value) ? value : null;
}

function cancellationLabel(status) {
  return CANCELLATION_STATUS_LABELS[status] || status || '-';
}

function parseCancellationReasons(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [String(value)];
  } catch {
    return String(value)
      .split(/[,|]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
}

function stringifyCancellationReasons(choices) {
  return JSON.stringify(Array.isArray(choices) ? choices : []);
}

function buildCancellationMessage(type, status) {
  if (status === 'approved_cancel') {
    return type === 'order' ? 'ยกเลิกคำสั่งซื้อสินค้าแล้ว' : 'ยกเลิกคำขอสีข้าวแล้ว';
  }
  if (status === 'rejected_cancel') {
    return 'ปฏิเสธคำขอยกเลิก';
  }
  return status === 'pending_cancel'
    ? `รอยืนยันการยกเลิก${getCancellationTargetLabel(type)}`
    : cancellationLabel(status);
}

function buildOwnerCancellationMessage(type, cancelReason) {
  const reasonText = String(cancelReason || '').trim();
  if (reasonText) {
    return type === 'order'
      ? `ออเดอร์ถูกยกเลิกโดยเจ้าของโรงสี: ${reasonText}`
      : `คำขอสีข้าวถูกยกเลิกโดยเจ้าของโรงสี: ${reasonText}`;
  }

  return type === 'order'
    ? 'ออเดอร์ถูกยกเลิกโดยเจ้าของโรงสี'
    : 'คำขอสีข้าวถูกยกเลิกโดยเจ้าของโรงสี';
}

async function loadCancellationResource(conn, type, resourceId) {
  const config = CANCELLATION_CONFIG[type];
  if (!config) return null;

  const [rows] = await conn.query(
    `SELECT ${config.idColumn} AS resource_id, ${config.ownerColumn} AS owner_id, ${config.millColumn} AS mill_id, status, cancel_reason, cancelled_at
     FROM ${config.table}
     WHERE ${config.idColumn} = ?
     LIMIT 1`,
    [resourceId]
  );

  return rows && rows[0] ? rows[0] : null;
}

async function upsertCancellationNotification(conn, villagerId, type, resourceId, status) {
  await conn.execute(
    'INSERT INTO notifications (villager_id, type, resource_id, status, message) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status), message = VALUES(message), is_read = FALSE, created_at = CURRENT_TIMESTAMP',
    [villagerId, type, resourceId, status, buildCancellationMessage(type, status)]
  );
}

async function createCancellationRequest(conn, { type, resourceId, villagerId, choices, additionalNote }) {
  const normalizedType = normalizeCancellationType(type);
  const resourceIdValue = Number(resourceId);
  const villagerIdValue = Number(villagerId);

  if (!normalizedType || !Number.isFinite(resourceIdValue) || !Number.isFinite(villagerIdValue)) {
    const error = new Error('Invalid request');
    error.statusCode = 400;
    throw error;
  }

  const config = CANCELLATION_CONFIG[normalizedType];
  const resource = await loadCancellationResource(conn, normalizedType, resourceIdValue);
  if (!resource) {
    const error = new Error('Resource not found');
    error.statusCode = 404;
    throw error;
  }

  if (Number(resource.owner_id) !== villagerIdValue) {
    const error = new Error('Forbidden');
    error.statusCode = 403;
    throw error;
  }

  if (!config.cancelableStatuses.has(String(resource.status || '').trim())) {
    const error = new Error(`${config.typeLabel} cannot be cancelled at this stage`);
    error.statusCode = 400;
    throw error;
  }

  const parsedChoices = parseCancellationReasons(choices);
  if (parsedChoices.length === 0) {
    const error = new Error('Please select at least one reason');
    error.statusCode = 400;
    throw error;
  }

  const reasonText = stringifyCancellationReasons(parsedChoices);
  const noteText = String(additionalNote || '').trim();
  const resourceStatus = String(resource.status || '').trim() || null;

  await conn.execute(
    `INSERT INTO cancellation_requests (order_id, milling_request_id, user_id, cancellation_reason, additional_note, resource_status, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending_cancel')
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       cancellation_reason = VALUES(cancellation_reason),
       additional_note = VALUES(additional_note),
       resource_status = VALUES(resource_status),
       status = 'pending_cancel',
       updated_at = CURRENT_TIMESTAMP`,
    [normalizedType === 'order' ? resourceIdValue : null, normalizedType === 'milling' ? resourceIdValue : null, villagerIdValue, reasonText, noteText || null, resourceStatus]
  );

  const [rows] = await conn.query(
    `SELECT id, order_id, milling_request_id, user_id, cancellation_reason, additional_note, resource_status, status, created_at, updated_at
     FROM cancellation_requests
     WHERE ${normalizedType === 'order' ? 'order_id' : 'milling_request_id'} = ?
     LIMIT 1`,
    [resourceIdValue]
  );

  const request = rows && rows[0] ? rows[0] : null;
  if (!request) {
    const error = new Error('Unable to create cancellation request');
    error.statusCode = 500;
    throw error;
  }

  await upsertCancellationNotification(conn, villagerIdValue, normalizedType, resourceIdValue, 'pending_cancel');

  return {
    ...request,
    type: normalizedType,
    reason_choices: parseCancellationReasons(request.cancellation_reason),
  };
}

async function updateCancellationRequestStatus(conn, { cancellationId, status, ownerId }) {
  const normalizedStatus = normalizeCancellationStatus(status);
  const cancellationIdValue = Number(cancellationId);
  const ownerIdValue = Number(ownerId);

  if (!normalizedStatus || !Number.isFinite(cancellationIdValue) || !Number.isFinite(ownerIdValue)) {
    const error = new Error('Invalid request');
    error.statusCode = 400;
    throw error;
  }

  const [rows] = await conn.query(
    `SELECT id, order_id, milling_request_id, user_id, cancellation_reason, additional_note, status, created_at, updated_at
     FROM cancellation_requests
     WHERE id = ?
     LIMIT 1`,
    [cancellationIdValue]
  );

  const request = rows && rows[0] ? rows[0] : null;
  if (!request) {
    const error = new Error('Cancellation request not found');
    error.statusCode = 404;
    throw error;
  }

  const type = request.order_id ? 'order' : 'milling';
  const resourceId = request.order_id || request.milling_request_id;
  const resource = await loadCancellationResource(conn, type, resourceId);
  if (!resource) {
    const error = new Error('Resource not found');
    error.statusCode = 404;
    throw error;
  }

  if (Number(resource.mill_id || 0) !== ownerIdValue) {
    const error = new Error('Forbidden');
    error.statusCode = 403;
    throw error;
  }

  await conn.execute(
    'UPDATE cancellation_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [normalizedStatus, cancellationIdValue]
  );

  if (normalizedStatus === 'approved_cancel') {
    const reasonText = JSON.stringify({
      reasons: parseCancellationReasons(request.cancellation_reason),
      additional_note: request.additional_note || '',
    });

    if (type === 'order') {
      await recordStatusHistory(conn, {
        resourceType: 'order',
        resourceId,
        fromStatus: resource.status,
        toStatus: 'cancelled',
      });
      await conn.execute('UPDATE orders SET status = ?, cancel_reason = ?, cancelled_at = CURRENT_TIMESTAMP WHERE order_id = ?', ['cancelled', reasonText, resourceId]);
    } else {
      await recordStatusHistory(conn, {
        resourceType: 'milling',
        resourceId,
        fromStatus: resource.status,
        toStatus: 'cancelled',
      });
      await conn.execute('UPDATE milling_requests SET status = ?, cancel_reason = ?, cancelled_at = CURRENT_TIMESTAMP WHERE request_id = ?', ['cancelled', reasonText, resourceId]);
    }
  }

  await upsertCancellationNotification(conn, Number(request.user_id || 0), type, resourceId, normalizedStatus);

  return {
    ...request,
    type,
    status: normalizedStatus,
    reason_choices: parseCancellationReasons(request.cancellation_reason),
  };
}

// GET /api/notifications/cancellations — owner view of pending cancellation requests
router.get('/cancellations', async (req, res) => {
  try {
    const session = parseSessionFromHeader(req);
    if (session?.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const ownerMillId = Number(session?.mill_id || 0);
    if (!ownerMillId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const conn = await pool.getConnection();
    try {
      const [orderRows] = await conn.query(
        `SELECT
            cr.id AS cancellation_id,
            'order' AS type,
            o.order_id AS resource_id,
            o.order_number AS resource_number,
            o.customer_name,
            o.status AS current_status,
            cr.status AS cancellation_status,
            cr.cancellation_reason,
            cr.additional_note,
            cr.created_at AS cancellation_created_at,
            o.created_at AS resource_created_at
         FROM cancellation_requests cr
         INNER JOIN orders o ON o.order_id = cr.order_id
         WHERE o.mill_id = ? AND cr.status = 'pending_cancel'
         ORDER BY cr.created_at DESC, cr.id DESC`,
        [ownerMillId]
      );

      const [millingRows] = await conn.query(
        `SELECT
            cr.id AS cancellation_id,
            'milling' AS type,
            m.request_id AS resource_id,
            CAST(m.request_id AS CHAR) AS resource_number,
            m.customer_name,
            m.status AS current_status,
            cr.status AS cancellation_status,
            cr.cancellation_reason,
            cr.additional_note,
            cr.created_at AS cancellation_created_at,
            m.created_at AS resource_created_at
         FROM cancellation_requests cr
         INNER JOIN milling_requests m ON m.request_id = cr.milling_request_id
         WHERE m.mill_id = ? AND cr.status = 'pending_cancel'
         ORDER BY cr.created_at DESC, cr.id DESC`,
        [ownerMillId]
      );

      const rows = [...(orderRows || []), ...(millingRows || [])]
        .sort((a, b) => new Date(b.cancellation_created_at) - new Date(a.cancellation_created_at))
        .map((row) => ({
          ...row,
          reason_choices: parseCancellationReasons(row.cancellation_reason),
          target_label: getCancellationTargetLabel(row.type),
          current_status_label: getCancellationResourceStatusLabel(row.type, row.current_status),
          cancellation_status_label: cancellationLabel(row.cancellation_status),
        }));

      return res.json({ success: true, data: rows });
    } finally {
      try { conn.release(); } catch (e) { /* ignore */ }
    }
  } catch (err) {
    console.error('list cancellation requests error:', err);
    return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Unable to load cancellation requests' });
  }
});

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

    // Count order threads that still have customer-visible notifications
    const [orderRows] = await pool.query(
      `SELECT COUNT(*) as count FROM orders 
       WHERE villager_id = ? AND status NOT IN ('cancelled')`,
      [villager_id]
    );
    const pending_orders = (orderRows && orderRows[0] && orderRows[0].count) || 0;

    // Count milling threads that still have customer-visible notifications
    const [millingRows] = await pool.query(
      `SELECT COUNT(*) as count FROM milling_requests 
       WHERE submitted_by = ? AND status NOT IN ('cancelled')`,
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

// GET /api/notifications/items — ดึงรายละเอียดการแจ้งเตือนทั้งหมด (orders + milling requests)
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
      const mapped = [];
      const latestRows = dedupeLatestByThread(Array.isArray(notes) ? notes : []);

      for (const row of latestRows) {
        let message = row.message;
        if (String(row.status || '').trim() === 'cancelled') {
          const resource = await loadCancellationResource(pool, row.type, row.resource_id);
          if (resource) {
            message = buildOwnerCancellationMessage(row.type, resource.cancel_reason);
          }
        }

        mapped.push({
          id: threadKey(row.type, row.resource_id),
          type: row.type,
          resource_id: row.resource_id,
          status: row.status,
          message,
          is_read: !!row.is_read,
          created_at: row.created_at,
        });
      }
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
      WHERE villager_id = ? AND status NOT IN ('cancelled')
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
      WHERE submitted_by = ? AND status NOT IN ('cancelled')
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

// GET /api/notifications/cancellations/:type/:resourceId — fetch the current cancellation request
router.get('/cancellations/:type/:resourceId', async (req, res) => {
  try {
    const session = parseSessionFromHeader(req);
    const type = normalizeCancellationType(req.params.type);
    const resourceId = Number(req.params.resourceId);
    if (!type || !Number.isFinite(resourceId)) {
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    const conn = await pool.getConnection();
    try {
      const resource = await loadCancellationResource(conn, type, resourceId);
      if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' });

      const villagerId = Number(session?.villager_id || 0);
      const ownerId = Number(resource.owner_id || 0);
      const isOwner = session?.role === 'owner' && Number(session?.mill_id || 0) === Number(resource.mill_id || 0);
      if (!isOwner && (!villagerId || villagerId !== ownerId)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      const columnName = type === 'order' ? 'order_id' : 'milling_request_id';
      const [rows] = await conn.query(
        `SELECT id, order_id, milling_request_id, user_id, cancellation_reason, additional_note, status, created_at, updated_at
         FROM cancellation_requests
         WHERE ${columnName} = ?
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [resourceId]
      );

      return res.json({ success: true, data: rows && rows[0] ? {
        ...rows[0],
        type,
        reason_choices: parseCancellationReasons(rows[0].cancellation_reason),
        status_label: cancellationLabel(rows[0].status),
      } : null });
    } finally {
      try { conn.release(); } catch (e) { /* ignore */ }
    }
  } catch (err) {
    console.error('get cancellation status error:', err);
    return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Unable to load cancellation status' });
  }
});

// POST /api/notifications/cancellations — create a new cancellation request
router.post('/cancellations', async (req, res) => {
  try {
    const session = parseSessionFromHeader(req);
    const villagerId = Number(session?.villager_id || 0);
    if (!villagerId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const payload = req.body || {};
    const conn = await pool.getConnection();
    try {
      const created = await createCancellationRequest(conn, {
        type: payload.type,
        resourceId: payload.resource_id,
        villagerId,
        choices: payload.choices,
        additionalNote: payload.additional_note,
      });

      return res.json({ success: true, data: created });
    } finally {
      try { conn.release(); } catch (e) { /* ignore */ }
    }
  } catch (err) {
    console.error('create cancellation request error:', err);
    return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Unable to create cancellation request' });
  }
});

// PATCH /api/notifications/cancellations/:id/status — owner/admin update
router.patch('/cancellations/:id/status', async (req, res) => {
  try {
    const session = parseSessionFromHeader(req);
    if (session?.role !== 'owner') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const ownerMillId = Number(session?.mill_id || 0);
    if (!ownerMillId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const payload = req.body || {};
    const conn = await pool.getConnection();
    try {
      const updated = await updateCancellationRequestStatus(conn, {
        cancellationId: req.params.id,
        status: payload.status,
        ownerId: ownerMillId,
      });

      return res.json({ success: true, data: updated });
    } finally {
      try { conn.release(); } catch (e) { /* ignore */ }
    }
  } catch (err) {
    console.error('update cancellation status error:', err);
    return res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Unable to update cancellation status' });
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

    const conn = await pool.getConnection();
    try {
      const history = await loadStatusHistory(conn, { resourceType: type, resourceId });
      if (history.length > 0) {
        return res.json({
          success: true,
          data: {
            type,
            resource_id: resourceId,
            items: history.map((row) => ({
              history_id: row.history_id,
              type,
              resource_id: Number(row.resource_id),
              status: row.to_status,
              message: getCancellationResourceStatusLabel(type, row.to_status),
              is_read: true,
              created_at: row.created_at,
            }))
          }
        });
      }

      const resource = await loadCancellationResource(conn, type, resourceId);

      const [rows] = await conn.query(
        `SELECT notification_id, type, resource_id, status, message, is_read, created_at
         FROM notifications
         WHERE villager_id = ? AND type = ? AND resource_id = ?
         ORDER BY created_at ASC, notification_id ASC`,
        [villager_id, type, resourceId]
      );

      if (rows && rows.length > 0) {
        return res.json({
          success: true,
          data: {
            type,
            resource_id: resourceId,
            items: rows || []
          }
        });
      }

      if (resource && String(resource.status || '').trim() === 'cancelled') {
        const [cancelRows] = await conn.query(
          `SELECT resource_status, updated_at, created_at
           FROM cancellation_requests
           WHERE ${type === 'order' ? 'order_id' : 'milling_request_id'} = ?
           ORDER BY updated_at DESC, id DESC
           LIMIT 1`,
          [resourceId]
        );

        const cancelRequest = cancelRows && cancelRows[0] ? cancelRows[0] : null;
        const preCancelStatus = String(cancelRequest?.resource_status || '').trim();
        if (preCancelStatus) {
          const fallbackAt = cancelRequest.updated_at || cancelRequest.created_at || resource.updated_at || resource.created_at || new Date().toISOString();
          return res.json({
            success: true,
            data: {
              type,
              resource_id: resourceId,
              items: [
                {
                  notification_id: null,
                  type,
                  resource_id: resourceId,
                  status: preCancelStatus,
                  message: getCancellationResourceStatusLabel(type, preCancelStatus),
                  is_read: true,
                  created_at: resource.created_at || fallbackAt,
                },
                {
                  notification_id: null,
                  type,
                  resource_id: resourceId,
                  status: 'cancelled',
                  message: getCancellationResourceStatusLabel(type, 'cancelled'),
                  is_read: true,
                  created_at: fallbackAt,
                }
              ]
            }
          });
        }
      }

      return res.json({
        success: true,
        data: {
          type,
          resource_id: resourceId,
          items: rows || []
        }
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('notification timeline error:', err);
    return res.status(500).json({ success: false, message: 'Unable to load timeline' });
  }
});

// POST /api/notifications/:type/:resourceId/cancel — compatibility wrapper
router.post('/:type/:resourceId/cancel', async (req, res) => {
  try {
    const session = parseSessionFromHeader(req);
    const villagerId = Number(session?.villager_id || 0);
    if (!villagerId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const conn = await pool.getConnection();
    try {
      const created = await createCancellationRequest(conn, {
        type: req.params.type,
        resourceId: req.params.resourceId,
        villagerId,
        choices: req.body?.choices,
        additionalNote: req.body?.note,
      });

      return res.json({ success: true, data: created });
    } finally {
      try { conn.release(); } catch (e) { /* ignore */ }
    }
  } catch (err) {
    console.error('cancel notification error:', err);
    return res.status(err.statusCode || 500).json({ success: false, message: String(err && err.message ? err.message : 'Unable to cancel') });
  }
});
