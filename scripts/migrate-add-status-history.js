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
    const exists = await tableExists(conn, 'status_history');
    if (exists) {
      console.log('status_history table already exists');
      return;
    }

    console.log('Creating status_history table...');
    await conn.query(`
      CREATE TABLE status_history (
        history_id INT PRIMARY KEY AUTO_INCREMENT,
        resource_type ENUM('order','milling') NOT NULL,
        resource_id INT NOT NULL,
        from_status VARCHAR(60) NULL,
        to_status VARCHAR(60) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_status_history_lookup (resource_type, resource_id, created_at),
        INDEX idx_status_history_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ status_history table created');
  } catch (err) {
    console.error('❌ status_history migration failed:', err.message);
    throw err;
  } finally {
    try { conn.release(); } catch (e) { /* ignore */ }
  }
}

migrate()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));