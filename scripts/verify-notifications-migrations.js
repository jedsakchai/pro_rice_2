const pool = require('../config/database');

(async () => {
  try {
    const conn = await pool.getConnection();
    const [idx] = await conn.query(
      `SELECT INDEX_NAME, NON_UNIQUE
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'notifications'
         AND INDEX_NAME = 'uq_notifications_type_resource_villager'`
    );
    const [triggers] = await conn.query(
      `SELECT TRIGGER_NAME
       FROM INFORMATION_SCHEMA.TRIGGERS
       WHERE TRIGGER_SCHEMA = DATABASE()
         AND TRIGGER_NAME IN ('trg_orders_notifications_sync', 'trg_milling_notifications_sync')`
    );
    console.table(idx);
    console.table(triggers);
    conn.release();
    await pool.end();
  } catch (e) {
    console.error('Verification failed:', e.message);
    process.exit(1);
  }
})();
