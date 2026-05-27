const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'root',
    database: 'rice',
    connectionLimit: 5
  });
  
  try {
    console.log('Inserting test unread notifications...');
    
    const conn = await pool.getConnection();
    
    // Clear old ones first
    await conn.query('DELETE FROM notifications WHERE villager_id = 1');
    
    // Insert test notifications
    await conn.query(
      `INSERT INTO notifications (villager_id, type, resource_id, status, message, is_read, created_at) 
       VALUES 
       (1, 'milling', 15, 'pending', 'คำขอสีข้าว #15', 0, NOW()),
       (1, 'milling', 12, 'in_progress', 'คำขอสีข้าว #12', 0, NOW()),
       (1, 'order', 4, 'pending', 'คำสั่งซื้อ #4', 0, NOW()),
       (1, 'order', 6, 'confirmed', 'คำสั่งซื้อ #6', 0, NOW())`
    );
    
    const [rows] = await conn.query('SELECT COUNT(*) as count FROM notifications WHERE villager_id = 1 AND is_read = 0');
    console.log(`✅ Inserted ${rows[0].count} unread notifications`);
    
    conn.release();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
