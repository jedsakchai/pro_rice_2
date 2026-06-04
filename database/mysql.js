const mysql = require('mysql2/promise');
require('dotenv').config({ override: true });

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'rice_mill_db',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
});

pool.on('connection', (connection) => {
  try {
    connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
    connection.query("SET SESSION CHARACTER_SET_CLIENT = utf8mb4");
    connection.query("SET SESSION CHARACTER_SET_CONNECTION = utf8mb4");
    connection.query("SET SESSION CHARACTER_SET_RESULTS = utf8mb4");
  } catch {
    // ignore
  }
});

try {
  const pw = process.env.DB_PASSWORD || '';
  console.log(`🧩 DB config: host=${process.env.DB_HOST || '127.0.0.1'} port=${process.env.DB_PORT || 3306} user=${process.env.DB_USER || 'root'} db=${process.env.DB_NAME || 'rice_mill_db'} password_set=${pw.length > 0}`);
} catch {
  // ignore
}

pool.getConnection()
  .then((conn) => {
    console.log('✅ MySQL connected');
    conn.release();
  })
  .catch((err) => {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('   Check DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME in .env');
  });

module.exports = pool;