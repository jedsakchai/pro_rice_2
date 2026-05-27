/*
 Update product images and add "แกลบ" product to mills missing it.
 Uses project's .env for DB credentials.
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

const mapping = {
  'ข้าวกล้อง': 'rice-6.jpg',
  'ข้าวสาร': 'rice-1.jpg',
  'ข้าวสารแพ็กครอบครัว': 'rice-1.jpg',
  'ข้าวหอมมะลิ': 'rice-1.jpg',
  'ข้าวเหนียวแพ็กครอบครัว': 'rice-5.jpg',
  'ข้าวหัก': 'rice-3.jpg',
  'ปลายข้าว': 'rice-3.jpg',
  'รำข้าว': 'rice-2.png',
  'ข้าวเหนียว': 'rice-5.jpg',
  'ข้าวกล้องเพื่อสุขภาพ': 'rice-6.jpg',
  'รำข้าว': 'rice-2.png',
  'รำข้าวสำหรับสัตว์เลี้ยง': 'rice-2.png',
  'รำข้าว': 'rice-2.png'
};

async function main(){
  try {
    console.log('🔧 Updating product images according to mapping...');

    // Update existing products
    let updated = 0;
    for (const [nameTh, filename] of Object.entries(mapping)){
      const imageUrl = '/images/' + filename;
      const [res] = await pool.query('UPDATE products SET image_url = ? WHERE product_name_th = ?', [imageUrl, nameTh]);
      if (res && typeof res.affectedRows === 'number' && res.affectedRows > 0){
        updated += res.affectedRows;
        console.log(`  ✅ Updated ${res.affectedRows} rows for "${nameTh}" -> ${filename}`);
      }
    }

    console.log(`\nTotal image updates: ${updated}`);

    // Ensure "แกลบ" exists for every active mill. Use template from existing "รำข้าว" or fallback values.
    const [mills] = await pool.query('SELECT mill_id FROM mills WHERE is_active = TRUE');
    const [templateRows] = await pool.query('SELECT category, category_th, description, description_th, price, unit, unit_th, stock FROM products WHERE product_name_th = ? LIMIT 1', ['รำข้าว']);
    const template = templateRows && templateRows[0] ? templateRows[0] : null;

    let added = 0;
    for (const m of mills){
      const millId = m.mill_id;
      const [exists] = await pool.query('SELECT 1 FROM products WHERE mill_id = ? AND product_name_th = ? LIMIT 1', [millId, 'แกลบ']);
      if (exists && exists.length > 0) continue;

      const fields = template ? [template.category || '', template.category_th || '','แกลบ','แกลบ', template.description || '', template.description_th || '', template.price || 20, template.unit || '5 กก.', template.unit_th || '5 กก.', template.stock || 50, '/images/rice-4.jpg', millId] : ['อื่นๆ','อื่นๆ','แกลบ','แกลบ','แกลบ','แกลบ',20,'5 กก.','5 กก.',50,'/images/rice-4.jpg', millId];

      await pool.query(`INSERT INTO products (category, category_th, product_name, product_name_th, description, description_th, price, unit, unit_th, stock, image_url, mill_id, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`, fields);
      added++;
      console.log(`  ➕ Added แกลบ for mill ${millId}`);
    }

    console.log(`\nDone. Images updated: ${updated}, แกลบ added: ${added}`);
    await pool.end();
  } catch (err){
    console.error('Error:', err.message || err);
    process.exit(1);
  }
}

main();
