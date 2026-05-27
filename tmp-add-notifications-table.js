const mysql = require('mysql2/promise');

(async () => {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'root',
    database: 'rice',
    connectionLimit: 5,
    enableTimeout: false,
    waitForConnections: true,
    queueLimit: 0
  });
  
  try {
    console.log('Creating notifications table...');
    
    const sql = `
CREATE TABLE IF NOT EXISTS notifications (
  notification_id INT PRIMARY KEY AUTO_INCREMENT,
  villager_id INT NULL,
  type ENUM('order','milling') NOT NULL,
  resource_id INT NOT NULL,
  status VARCHAR(60) NULL,
  message VARCHAR(255) NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_villager (villager_id),
  CONSTRAINT fk_notifications_villager FOREIGN KEY (villager_id) REFERENCES villagers(villager_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    
    const conn = await pool.getConnection();
    await conn.query(sql);
    conn.release();
    
    console.log('✅ Notifications table created');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
