const pool = require('../config/database');

async function main() {
  const conn = await pool.getConnection();
  try {
    console.log('Updating status enums and normalizing existing rows...');

    const ordersLegacyAndNew = [
      'pending',
      'accepted',
      'awaiting_payment',
      'confirmed',
      'preparing',
      'shipped',
      'completed',
      'cancelled',
      'pending_payment',
      'payment_review',
      'paid',
      'ready_to_ship',
      'awaiting_pickup',
      'shipping',
    ];
    const millingLegacyAndNew = [
      'pending',
      'in_progress',
      'completed',
      'cancelled',
      'pending_review',
      'accepted',
      'awaiting_pickup',
      'received',
      'queued',
      'milling',
      'packing',
      'ready',
      'shipping',
      'delivered',
    ];

    await conn.execute(`
      ALTER TABLE orders
      MODIFY status ENUM(${ordersLegacyAndNew.map((s) => `'${s}'`).join(',')}) NOT NULL DEFAULT 'pending_payment'
    `);

    await conn.execute(`
      ALTER TABLE milling_requests
      MODIFY status ENUM(${millingLegacyAndNew.map((s) => `'${s}'`).join(',')}) NOT NULL DEFAULT 'pending_review'
    `);

    await conn.execute(`
      UPDATE orders
      SET status = CASE status
        WHEN 'pending' THEN 'pending'
        WHEN 'confirmed' THEN 'accepted'
        WHEN 'awaiting_payment' THEN 'payment_review'
        WHEN 'shipped' THEN 'shipping'
        ELSE status
      END
    `);

    await conn.execute(`
      UPDATE milling_requests
      SET status = CASE status
        WHEN 'pending' THEN 'pending_review'
        WHEN 'in_progress' THEN 'milling'
        WHEN 'completed' THEN 'delivered'
        ELSE status
      END
    `);

    await conn.execute(`
      UPDATE notifications
      SET status = CASE
        WHEN type = 'order' THEN CASE status
          WHEN 'pending' THEN 'pending_payment'
          WHEN 'confirmed' THEN 'accepted'
          WHEN 'awaiting_payment' THEN 'payment_review'
          WHEN 'shipped' THEN 'shipping'
          ELSE status
        END
        WHEN type = 'milling' THEN CASE status
          WHEN 'pending' THEN 'pending_review'
          WHEN 'in_progress' THEN 'milling'
          WHEN 'completed' THEN 'delivered'
          ELSE status
        END
        ELSE status
      END
    `);

    await conn.execute(`
      ALTER TABLE orders
      MODIFY status ENUM('pending','accepted','pending_payment','payment_review','paid','preparing','awaiting_pickup','ready_to_ship','shipping','completed','cancelled') NOT NULL DEFAULT 'pending'
    `);

    await conn.execute(`
      ALTER TABLE milling_requests
      MODIFY status ENUM('pending_review','accepted','awaiting_pickup','received','queued','milling','packing','ready','shipping','delivered','cancelled') NOT NULL DEFAULT 'pending_review'
    `);

    console.log('✅ Status enums updated successfully');
  } catch (err) {
    console.error('❌ Status enum migration failed:', err.message);
    throw err;
  } finally {
    conn.release();
  }
}

main().then(() => process.exit(0)).catch(() => process.exit(1));
