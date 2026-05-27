const pool = require('../config/database');

async function migrate() {
  const conn = await pool.getConnection();
  try {
    console.log('Checking orders table for cancel columns...');
    const [cols] = await conn.query("SHOW COLUMNS FROM orders LIKE 'cancel_reason'");
    if (!cols || cols.length === 0) {
      console.log('Adding cancel_reason and cancelled_at to orders...');
      await conn.query("ALTER TABLE orders ADD COLUMN cancel_reason TEXT NULL, ADD COLUMN cancelled_at TIMESTAMP NULL");
      console.log('✅ Added cancel columns to orders');
    } else {
      console.log('orders already has cancel columns');
    }

    console.log('Checking milling_requests table for cancel columns...');
    const [mcols] = await conn.query("SHOW COLUMNS FROM milling_requests LIKE 'cancel_reason'");
    if (!mcols || mcols.length === 0) {
      console.log('Adding cancel_reason and cancelled_at to milling_requests...');
      await conn.query("ALTER TABLE milling_requests ADD COLUMN cancel_reason TEXT NULL, ADD COLUMN cancelled_at TIMESTAMP NULL");
      console.log('✅ Added cancel columns to milling_requests');
    } else {
      console.log('milling_requests already has cancel columns');
    }
  } catch (err) {
    console.error('Migration failed:', err && err.message);
    throw err;
  } finally {
    try { if (conn) conn.release(); } catch (e) {}
  }
}

migrate().then(()=>process.exit(0)).catch(()=>process.exit(1));
