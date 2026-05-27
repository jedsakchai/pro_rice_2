const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'rice_mill_db'
  });

  try {
    // Check if column exists
    const [rows] = await conn.execute("SHOW COLUMNS FROM villagers LIKE 'address'");
    if (rows && rows.length > 0) {
      console.log('Column `address` already exists on `villagers`');
    } else {
      console.log('Adding `address` column to `villagers` table...');
      await conn.execute("ALTER TABLE villagers ADD COLUMN address VARCHAR(500) NULL AFTER phone");
      console.log('Added `address` column successfully');
    }
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
})();
