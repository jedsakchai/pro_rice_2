/* rename-khak-to-tail.js
 * เปลี่ยนชื่อสินค้า "ข้าวหัก" เป็น "ปลายข้าว" และอัปเดตรูปเป็น /images/rice-3.jpg
 */
const mysql = require('mysql2/promise');
require('dotenv').config({ override: true });

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'rice_mill_db',
  charset: 'utf8mb4',
});

async function main(){
  try{
    console.log('🔁 Updating products: ข้าวหัก → ปลายข้าว, image -> /images/rice-3.jpg');

    const [res] = await pool.query("UPDATE products SET product_name_th = ?, image_url = ? WHERE product_name_th = ?", ['ปลายข้าว', '/images/rice-3.jpg', 'ข้าวหัก']);
    console.log(`✅ Rows affected: ${res.affectedRows}`);

    // Show some rows after update
    const [rows] = await pool.query("SELECT product_id, product_name_th, image_url, mill_id FROM products WHERE product_name_th = ? ORDER BY mill_id", ['ปลายข้าว']);
    console.log('Sample rows:');
    console.log(rows.slice(0,50));

    await pool.end();
    process.exit(0);
  }catch(err){
    console.error('Error:', err.message || err);
    process.exit(1);
  }
}

main();
