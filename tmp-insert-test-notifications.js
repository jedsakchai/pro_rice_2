const mysql = require('mysql2/promise');
const config = require('./config/database');

(async () => {
  try {
    const pool = mysql.createPool(config);
    const conn = await pool.getConnection();
    
    // Insert test notifications for villager_id = 1
    await conn.execute(
      `INSERT INTO notifications (villager_id, type, resource_id, status, message, is_read, created_at) 
       VALUES (1, 'order', 1, 'pending', 'คำสั่งซื้อของคุณ', 0, NOW()),
              (1, 'milling', 1, 'pending', 'คำขอสีข้าวของคุณ', 0, NOW())`
    );
    
    const [rows] = await conn.query(
      `SELECT * FROM notifications WHERE villager_id = 1 ORDER BY created_at DESC LIMIT 5`
    );
    
    console.log('✅ Inserted test notifications:');
    rows.forEach(r => {
      console.log(`  - Type: ${r.type}, Resource: ${r.resource_id}, Status: ${r.status}`);
    });
    
    conn.release();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
