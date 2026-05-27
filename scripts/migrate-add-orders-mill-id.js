const mysql = require('mysql2/promise');
require('dotenv').config({ override: true });

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'rice_mill_db'
  });

  try {
    const [rows] = await conn.execute("SHOW COLUMNS FROM orders LIKE 'mill_id'");
    if (rows && rows.length > 0) {
      console.log('Column `mill_id` already exists on `orders`');
      return;
    }

    console.log('Adding `mill_id` column to `orders` table...');
    await conn.execute('ALTER TABLE orders ADD COLUMN mill_id INT NULL AFTER order_number');
    await conn.execute('CREATE INDEX idx_orders_mill_id ON orders (mill_id)');
    await conn.execute('CREATE INDEX idx_orders_status ON orders (status)');
    await conn.execute('ALTER TABLE orders ADD CONSTRAINT fk_orders_mill_id FOREIGN KEY (mill_id) REFERENCES mills(mill_id) ON DELETE SET NULL ON UPDATE CASCADE');
    console.log('Added `mill_id` column successfully');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
})();
