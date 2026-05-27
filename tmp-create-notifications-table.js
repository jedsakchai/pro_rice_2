const mysql = require('mysql2/promise');
const config = require('./config/database');

(async () => {
  try {
    const pool = mysql.createPool(config);
    
    // Create notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        notification_id INT AUTO_INCREMENT PRIMARY KEY,
        villager_id INT NOT NULL,
        type VARCHAR(20) NOT NULL COMMENT 'order or milling',
        resource_id INT NOT NULL COMMENT 'order_id or request_id',
        status VARCHAR(50),
        message TEXT,
        is_read TINYINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (villager_id) REFERENCES villagers(villager_id),
        INDEX (villager_id, is_read)
      )
    `);
    
    console.log('✅ Created notifications table');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
