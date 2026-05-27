const pool = require('../config/database');

async function migrate() {
  const conn = await pool.getConnection();
  try {
    console.log('ตรวจสอบคอลัมน์ villager_id ในตาราง orders...');
    
    // Check if villager_id column exists
    const [columns] = await conn.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'villager_id'"
    );
    
    if (columns.length > 0) {
      console.log('✓ คอลัมน์ villager_id มีอยู่แล้ว');
      return;
    }
    
    // Add villager_id column
    console.log('กำลังเพิ่มคอลัมน์ villager_id...');
    await conn.query(
      `ALTER TABLE orders 
       ADD COLUMN villager_id INT NULL DEFAULT NULL 
       AFTER customer_name`
    );
    console.log('✓ เพิ่มคอลัมน์ villager_id สำเร็จ');
    
    // Add foreign key constraint
    console.log('กำลังเพิ่ม foreign key...');
    await conn.query(
      `ALTER TABLE orders 
       ADD CONSTRAINT fk_orders_villager_id 
       FOREIGN KEY (villager_id) REFERENCES villagers(villager_id)
       ON DELETE SET NULL
       ON UPDATE CASCADE`
    );
    console.log('✓ เพิ่ม foreign key สำเร็จ');
    
    // Add index
    console.log('กำลังเพิ่ม index...');
    await conn.query(
      `ALTER TABLE orders ADD INDEX idx_orders_villager_id (villager_id)`
    );
    console.log('✓ เพิ่ม index สำเร็จ');
    
    console.log('✅ Migration สำเร็จ');
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    conn.release();
  }
}

migrate()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
