/*
 * fix-all-product-images.js
 * Fix all product images according to correct mapping:
 * 1. rice-6 = ข้าวกล้อง (+ ข้าวกล้องเพื่อสุขภาพ)
 * 2. rice-1 = ข้าวสาร (+ ข้าวสารแพ็กครอบครัว, ข้าวหอมมะลิ)
 * 3. rice-3 = ปลายข้าว
 * 4. rice-2 = รำข้าว
 * 5. rice-4 = แกลบ
 * 6. rice-5 = ข้าวเหนียว
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

const correctMapping = {
  'ข้าวกล้อง': '/images/rice-6.jpg',
  'ข้าวกล้องเพื่อสุขภาพ': '/images/rice-6.jpg',
  'ข้าวสาร': '/images/rice-1.jpg',
  'ข้าวสารแพ็กครอบครัว': '/images/rice-1.jpg',
  'ข้าวหอมมะลิ': '/images/rice-1.jpg',
  'ข้าวเหนียวแพ็กครอบครัว': '/images/rice-5.jpg',
  'ปลายข้าว': '/images/rice-3.jpg',
  'ข้าวหัก': '/images/rice-3.jpg',
  'แกลบ': '/images/rice-4.jpg',
  'ข้าวเหนียว': '/images/rice-5.jpg',
};

async function main(){
  try{
    console.log('🔧 Fixing all product images to correct mapping...\n');

    let updated = 0;
    for (const [name, imageUrl] of Object.entries(correctMapping)){
      const [res] = await pool.query(
        'UPDATE products SET image_url = ? WHERE product_name_th = ?',
        [imageUrl, name]
      );
      if (res && res.affectedRows > 0){
        console.log(`  ✅ ${name} (${res.affectedRows} rows) → ${imageUrl}`);
        updated += res.affectedRows;
      }
    }

    console.log(`\n📦 Total updated: ${updated} rows`);

    // Ensure แกลบ exists for all active mills
    const [mills] = await pool.query('SELECT mill_id FROM mills WHERE is_active = TRUE');
    let huskAdded = 0;
    
    console.log('\n🛠️  Checking แกลบ for all mills...');
    for (const m of mills){
      const [exists] = await pool.query(
        'SELECT 1 FROM products WHERE mill_id = ? AND product_name_th = ? LIMIT 1',
        [m.mill_id, 'แกลบ']
      );
      if (exists && exists.length > 0) continue;

      // Get template from existing product
      const [template] = await pool.query(
        'SELECT category, category_th, description, description_th, price, unit, unit_th, stock FROM products WHERE mill_id = ? LIMIT 1',
        [m.mill_id]
      );
      
      const t = template && template[0] ? template[0] : {};
      
      await pool.query(
        `INSERT INTO products (category, category_th, product_name, product_name_th, description, description_th, price, unit, unit_th, stock, image_url, mill_id, is_available)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
        [
          t.category || 'อื่นๆ',
          t.category_th || 'อื่นๆ',
          'Husk',
          'แกลบ',
          t.description || 'เปลือกข้าว',
          t.description_th || 'เปลือกข้าว',
          20,
          t.unit || '5 kg',
          t.unit_th || '5 กก.',
          50,
          '/images/rice-4.jpg',
          m.mill_id
        ]
      );
      console.log(`  ➕ Added แกลบ for mill ${m.mill_id}`);
      huskAdded++;
    }

    console.log(`\n✨ Done! Images fixed: ${updated} rows, แกลบ added: ${huskAdded} mills`);
    await pool.end();
    process.exit(0);
  }catch(err){
    console.error('Error:', err.message || err);
    process.exit(1);
  }
}

main();
