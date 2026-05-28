const pool = require('../config/database');

async function tableExists(conn, tableName) {
  const [rows] = await conn.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    [tableName]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function migrate() {
  const conn = await pool.getConnection();
  try {
    const exists = await tableExists(conn, 'cancellation_requests');
    if (exists) {
      console.log('cancellation_requests table already exists');
      return;
    }

    console.log('Creating cancellation_requests table...');
    await conn.query(`
      CREATE TABLE cancellation_requests (
        id INT PRIMARY KEY AUTO_INCREMENT,
        order_id INT NULL,
        milling_request_id INT NULL,
        user_id INT NOT NULL,
        cancellation_reason TEXT NOT NULL,
        additional_note TEXT NULL,
        status ENUM('pending_cancel', 'approved_cancel', 'rejected_cancel') NOT NULL DEFAULT 'pending_cancel',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_cancellation_order_id (order_id),
        UNIQUE KEY uq_cancellation_milling_request_id (milling_request_id),
        INDEX idx_cancellation_status (status),
        INDEX idx_cancellation_user (user_id),
        CONSTRAINT fk_cancellation_requests_order FOREIGN KEY (order_id) REFERENCES orders(order_id)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_cancellation_requests_milling FOREIGN KEY (milling_request_id) REFERENCES milling_requests(request_id)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT fk_cancellation_requests_user FOREIGN KEY (user_id) REFERENCES villagers(villager_id)
          ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT chk_cancellation_exactly_one_target CHECK (
          (order_id IS NOT NULL AND milling_request_id IS NULL)
          OR (order_id IS NULL AND milling_request_id IS NOT NULL)
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ cancellation_requests table created');
  } catch (err) {
    console.error('❌ Cancellation requests migration failed:', err.message);
    throw err;
  } finally {
    try { conn.release(); } catch (e) { /* ignore */ }
  }
}

migrate()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
