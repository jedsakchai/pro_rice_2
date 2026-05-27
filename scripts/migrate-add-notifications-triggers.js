const pool = require('../config/database');

async function createTriggers(conn) {
  await conn.query('DROP TRIGGER IF EXISTS trg_orders_notifications_sync');
  await conn.query('DROP TRIGGER IF EXISTS trg_milling_notifications_sync');

  await conn.query(`
    CREATE TRIGGER trg_orders_notifications_sync
    AFTER UPDATE ON orders
    FOR EACH ROW
    BEGIN
      IF (NEW.status <> OLD.status) AND NEW.villager_id IS NOT NULL THEN
        INSERT INTO notifications (villager_id, type, resource_id, status, message, is_read, created_at)
        VALUES (
          NEW.villager_id,
          'order',
          NEW.order_id,
          NEW.status,
          CONCAT('สถานะคำสั่งซื้อเปลี่ยนเป็น ', NEW.status),
          0,
          NOW()
        )
        ON DUPLICATE KEY UPDATE
          status = VALUES(status),
          message = VALUES(message),
          is_read = 0,
          created_at = NOW();
      END IF;
    END
  `);

  await conn.query(`
    CREATE TRIGGER trg_milling_notifications_sync
    AFTER UPDATE ON milling_requests
    FOR EACH ROW
    BEGIN
      IF (NEW.status <> OLD.status) AND NEW.submitted_by IS NOT NULL THEN
        INSERT INTO notifications (villager_id, type, resource_id, status, message, is_read, created_at)
        VALUES (
          NEW.submitted_by,
          'milling',
          NEW.request_id,
          NEW.status,
          CONCAT('สถานะคำขอสีข้าวเปลี่ยนเป็น ', NEW.status),
          0,
          NOW()
        )
        ON DUPLICATE KEY UPDATE
          status = VALUES(status),
          message = VALUES(message),
          is_read = 0,
          created_at = NOW();
      END IF;
    END
  `);
}

async function migrate() {
  const conn = await pool.getConnection();
  try {
    console.log('Creating notification sync triggers...');
    await createTriggers(conn);
    console.log('✅ Notification sync triggers created');
  } catch (error) {
    console.error('❌ Notifications trigger migration failed:', error.message);
    throw error;
  } finally {
    conn.release();
  }
}

migrate()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));