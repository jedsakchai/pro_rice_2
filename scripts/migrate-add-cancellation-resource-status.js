const pool = require('../config/database');

async function columnExists(conn, tableName, columnName) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function migrate() {
  const conn = await pool.getConnection();
  try {
    const exists = await columnExists(conn, 'cancellation_requests', 'resource_status');
    if (exists) {
      console.log('cancellation_requests.resource_status already exists');
      return;
    }

    console.log('Adding cancellation_requests.resource_status...');
    await conn.query(
      'ALTER TABLE cancellation_requests ADD COLUMN resource_status VARCHAR(60) NULL AFTER additional_note'
    );
    console.log('✅ cancellation_requests.resource_status added');
  } catch (err) {
    console.error('❌ cancellation resource status migration failed:', err.message);
    throw err;
  } finally {
    try { conn.release(); } catch (e) { /* ignore */ }
  }
}

migrate()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));