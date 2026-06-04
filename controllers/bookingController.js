const pool = require('../database/mysql');

function padSequence(value) {
  return String(value || 0).padStart(4, '0');
}

function formatIsoDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(dateValue) {
  const iso = formatIsoDate(dateValue);
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function generateBookingNumber(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `RM${y}${m}${d}`;
}

async function getNextBookingNumber(conn, bookingDate = new Date()) {
  const prefix = generateBookingNumber(bookingDate);
  const [rows] = await conn.query(
    'SELECT booking_number FROM bookings WHERE booking_number LIKE ? ORDER BY booking_id DESC LIMIT 1',
    [`${prefix}%`]
  );

  const lastNumber = rows && rows[0] ? String(rows[0].booking_number || '') : '';
  const nextSequence = lastNumber && lastNumber.startsWith(prefix)
    ? Number(lastNumber.slice(prefix.length)) + 1
    : 1;

  return `${prefix}${padSequence(nextSequence)}`;
}

async function upsertUserByLineId(conn, payload = {}) {
  const lineUserId = String(payload.line_user_id || '').trim();
  if (!lineUserId) return null;

  await conn.execute(
    `INSERT INTO users (line_user_id, display_name, phone, role, chat_state_json, pending_intent, pending_payload_json, last_active_at)
     VALUES (?, ?, ?, 'customer', ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       display_name = COALESCE(NULLIF(VALUES(display_name), ''), display_name),
       phone = COALESCE(NULLIF(VALUES(phone), ''), phone),
       chat_state_json = VALUES(chat_state_json),
       pending_intent = VALUES(pending_intent),
       pending_payload_json = VALUES(pending_payload_json),
       last_active_at = VALUES(last_active_at)` ,
    [
      lineUserId,
      String(payload.display_name || '').trim(),
      String(payload.phone || '').trim(),
      payload.chat_state_json ? JSON.stringify(payload.chat_state_json) : null,
      String(payload.pending_intent || '').trim() || null,
      payload.pending_payload_json ? JSON.stringify(payload.pending_payload_json) : null,
    ]
  );

  const [rows] = await conn.query('SELECT * FROM users WHERE line_user_id = ? LIMIT 1', [lineUserId]);
  return rows && rows[0] ? rows[0] : null;
}

async function loadUserByLineId(conn, lineUserId) {
  const [rows] = await conn.query('SELECT * FROM users WHERE line_user_id = ? LIMIT 1', [String(lineUserId || '').trim()]);
  return rows && rows[0] ? rows[0] : null;
}

async function saveConversationState(conn, lineUserId, state) {
  if (!lineUserId) return null;
  const [rows] = await conn.query('SELECT * FROM users WHERE line_user_id = ? LIMIT 1', [String(lineUserId).trim()]);
  const current = rows && rows[0] ? rows[0] : null;
  const displayName = current ? current.display_name : '';
  const phone = current ? current.phone : '';

  return upsertUserByLineId(conn, {
    line_user_id: lineUserId,
    display_name: displayName,
    phone,
    chat_state_json: state,
    pending_intent: state && state.intent ? state.intent : null,
    pending_payload_json: state && state.data ? state.data : null,
  });
}

function normalizeBookingPayload(payload = {}) {
  const customer_name = String(payload.customer_name || '').trim();
  const phone = String(payload.phone || '').trim();
  const rice_type = String(payload.rice_type || '').trim();
  const quantity_kg = Number(payload.quantity_kg || 0) || 0;
  const desired_date = formatIsoDate(payload.desired_date) || String(payload.desired_date || '').trim();
  const dropoff_time = String(payload.dropoff_time || '').trim();
  const line_user_id = String(payload.line_user_id || '').trim();
  const display_name = String(payload.display_name || customer_name || '').trim();

  return {
    line_user_id,
    display_name,
    customer_name,
    phone,
    rice_type,
    quantity_kg,
    desired_date,
    dropoff_time,
    note: String(payload.note || '').trim(),
    status: 'confirmed',
  };
}

function buildBookingSummaryText(booking) {
  return [
    'ยืนยันการจองคิวสีข้าว',
    '',
    `ชื่อ : ${booking.customer_name || '-'}`,
    `เบอร์โทร : ${booking.phone || '-'}`,
    `ประเภทข้าว : ${booking.rice_type || '-'}`,
    `จำนวน : ${booking.quantity_kg || '-'} กิโลกรัม`,
    `วันที่ : ${booking.desired_date || '-'}`,
    `เวลา : ${booking.dropoff_time || '-'}`,
  ].join('\n');
}

async function createBooking(payload = {}) {
  const normalized = normalizeBookingPayload(payload);

  if (!normalized.customer_name || !normalized.phone || !normalized.rice_type || !normalized.quantity_kg || !normalized.desired_date || !normalized.dropoff_time) {
    const error = new Error('Missing booking information');
    error.statusCode = 400;
    throw error;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await upsertUserByLineId(conn, {
      line_user_id: normalized.line_user_id,
      display_name: normalized.display_name,
      phone: normalized.phone,
    });

    const bookingDate = new Date(normalized.desired_date);
    const booking_number = await getNextBookingNumber(conn, bookingDate);

    const [result] = await conn.execute(
      `INSERT INTO bookings (
        booking_number, line_user_id, customer_name, phone, rice_type, quantity_kg,
        desired_date, dropoff_time, status, note, summary_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        booking_number,
        normalized.line_user_id || null,
        normalized.customer_name,
        normalized.phone,
        normalized.rice_type,
        normalized.quantity_kg,
        normalized.desired_date,
        normalized.dropoff_time,
        'confirmed',
        normalized.note || null,
        JSON.stringify(normalized),
      ]
    );

    const booking = {
      booking_id: result.insertId,
      booking_number,
      ...normalized,
      desired_date: formatDisplayDate(normalized.desired_date) || normalized.desired_date,
      status: 'confirmed',
    };

    await conn.commit();
    return booking;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getBooking(query = {}) {
  const bookingNumber = String(query.booking_number || '').trim();
  const lineUserId = String(query.line_user_id || '').trim();
  const phone = String(query.phone || '').trim();
  const conn = await pool.getConnection();

  try {
    let rows;
    if (bookingNumber) {
      [rows] = await conn.query('SELECT * FROM bookings WHERE booking_number = ? LIMIT 1', [bookingNumber]);
    } else if (phone) {
      [rows] = await conn.query('SELECT * FROM bookings WHERE phone = ? ORDER BY booking_id DESC LIMIT 5', [phone]);
    } else if (lineUserId) {
      [rows] = await conn.query('SELECT * FROM bookings WHERE line_user_id = ? ORDER BY booking_id DESC LIMIT 5', [lineUserId]);
    } else {
      rows = [];
    }

    return rows || [];
  } finally {
    conn.release();
  }
}

async function cancelBooking(query = {}) {
  const bookingNumber = String(query.booking_number || '').trim();
  const lineUserId = String(query.line_user_id || '').trim();
  const reason = String(query.reason || '').trim() || 'ยกเลิกโดยผู้ใช้งาน';
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    let booking = null;
    if (bookingNumber) {
      const [rows] = await conn.query('SELECT * FROM bookings WHERE booking_number = ? LIMIT 1 FOR UPDATE', [bookingNumber]);
      booking = rows && rows[0] ? rows[0] : null;
    } else if (lineUserId) {
      const [rows] = await conn.query('SELECT * FROM bookings WHERE line_user_id = ? ORDER BY booking_id DESC LIMIT 1 FOR UPDATE', [lineUserId]);
      booking = rows && rows[0] ? rows[0] : null;
    }

    if (!booking) {
      const error = new Error('Booking not found');
      error.statusCode = 404;
      throw error;
    }

    await conn.execute(
      'UPDATE bookings SET status = ?, cancel_reason = ?, cancelled_at = NOW(), updated_at = NOW() WHERE booking_id = ?',
      ['cancelled', reason, booking.booking_id]
    );

    await conn.commit();
    return {
      ...booking,
      status: 'cancelled',
      cancel_reason: reason,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  buildBookingSummaryText,
  cancelBooking,
  createBooking,
  formatDisplayDate,
  getBooking,
  getNextBookingNumber,
  loadUserByLineId,
  normalizeBookingPayload,
  saveConversationState,
  upsertUserByLineId,
};