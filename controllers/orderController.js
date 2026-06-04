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

function generateOrderPrefix(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `ORD${y}${m}${d}`;
}

async function getNextOrderNumber(conn, orderDate = new Date()) {
  const prefix = generateOrderPrefix(orderDate);
  const [rows] = await conn.query(
    'SELECT order_number FROM orders WHERE order_number LIKE ? ORDER BY order_id DESC LIMIT 1',
    [`${prefix}%`]
  );

  const lastNumber = rows && rows[0] ? String(rows[0].order_number || '') : '';
  const nextSequence = lastNumber && lastNumber.startsWith(prefix)
    ? Number(lastNumber.slice(prefix.length)) + 1
    : 1;

  return `${prefix}${padSequence(nextSequence)}`;
}

async function loadActiveProducts(conn) {
  const [rows] = await conn.query(
    `SELECT product_id, category, category_th, product_name, product_name_th, description, description_th, price, unit, unit_th, stock, image_url, mill_id
     FROM products
     WHERE (is_available = 1 OR is_available = TRUE)
     ORDER BY product_name_th, product_name`
  );

  return rows || [];
}

function normalizeOrderPayload(payload = {}) {
  return {
    line_user_id: String(payload.line_user_id || '').trim(),
    display_name: String(payload.display_name || payload.customer_name || '').trim(),
    customer_name: String(payload.customer_name || '').trim(),
    phone: String(payload.phone || '').trim(),
    address: String(payload.address || '').trim(),
    product_name: String(payload.product_name || '').trim(),
    product_id: Number(payload.product_id || 0) || null,
    quantity: Number(payload.quantity || 0) || 0,
    unit: String(payload.unit || 'kg').trim() || 'kg',
    note: String(payload.note || '').trim(),
    shipping_method: String(payload.shipping_method || 'delivery').trim() || 'delivery',
  };
}

async function resolveProductByName(conn, productName) {
  const name = String(productName || '').trim();
  if (!name) return null;

  const [rows] = await conn.query(
    `SELECT product_id, product_name, product_name_th, price, unit, unit_th
     FROM products
     WHERE (is_available = 1 OR is_available = TRUE)
       AND (product_name_th = ? OR product_name = ? OR product_name_th LIKE ? OR product_name LIKE ?)
     ORDER BY
       CASE WHEN product_name_th = ? OR product_name = ? THEN 0 ELSE 1 END,
       product_id ASC
     LIMIT 1`,
    [name, name, `%${name}%`, `%${name}%`, name, name]
  );

  return rows && rows[0] ? rows[0] : null;
}

function buildOrderSummaryText(order) {
  return [
    'ยืนยันคำสั่งซื้อสินค้า',
    '',
    `สินค้า : ${order.product_name || '-'}`,
    `จำนวน : ${order.quantity || '-'} ${order.unit || 'kg'}`,
    `ชื่อผู้สั่ง : ${order.customer_name || '-'}`,
    `เบอร์โทร : ${order.phone || '-'}`,
    `ที่อยู่จัดส่ง : ${order.address || '-'}`,
  ].join('\n');
}

async function createOrder(payload = {}) {
  const normalized = normalizeOrderPayload(payload);

  if (!normalized.product_name || !normalized.quantity || !normalized.customer_name || !normalized.phone || !normalized.address) {
    const error = new Error('Missing order information');
    error.statusCode = 400;
    throw error;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const product = normalized.product_id
      ? await (async () => {
          const [rows] = await conn.query(
            'SELECT product_id, product_name, product_name_th, price, unit, unit_th FROM products WHERE product_id = ? LIMIT 1',
            [normalized.product_id]
          );
          return rows && rows[0] ? rows[0] : null;
        })()
      : await resolveProductByName(conn, normalized.product_name);

    if (product) {
      normalized.product_id = product.product_id;
      normalized.product_name = product.product_name_th || product.product_name || normalized.product_name;
      normalized.unit = product.unit_th || product.unit || normalized.unit;
      if (!normalized.note) {
        normalized.note = product.category_th || product.category || '';
      }
      if (!normalized.quantity) {
        normalized.quantity = 1;
      }
    }

    const orderDate = new Date();
    const order_number = await getNextOrderNumber(conn, orderDate);

    const total = Number(product && product.price ? product.price * normalized.quantity : 0) || 0;

    const [result] = await conn.execute(
      `INSERT INTO orders (
        order_number, line_user_id, customer_name, phone, shipping_address, product_id, product_name,
        quantity, unit, unit_price, total_price, shipping_method, note, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())` ,
      [
        order_number,
        normalized.line_user_id || null,
        normalized.customer_name,
        normalized.phone,
        normalized.address,
        normalized.product_id,
        normalized.product_name,
        normalized.quantity,
        normalized.unit,
        product ? Number(product.price || 0) : null,
        total,
        normalized.shipping_method,
        normalized.note || null,
        'confirmed',
      ]
    );

    await conn.commit();

    return {
      order_id: result.insertId,
      order_number,
      ...normalized,
      unit_price: product ? Number(product.price || 0) : 0,
      total_price: total,
      total,
      status: 'confirmed',
      created_at: formatDisplayDate(orderDate),
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getProducts() {
  const conn = await pool.getConnection();
  try {
    return await loadActiveProducts(conn);
  } finally {
    conn.release();
  }
}

module.exports = {
  buildOrderSummaryText,
  createOrder,
  formatDisplayDate,
  getNextOrderNumber,
  getProducts,
  loadActiveProducts,
  normalizeOrderPayload,
  resolveProductByName,
};