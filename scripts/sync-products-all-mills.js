/**
 * sync-products-all-mills.js
 * Ensure every active mill has the full canonical product catalog.
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

const CATALOG = [
  {
    key: 'white-jasmine',
    aliases: ['ข้าวสาร', 'ข้าวหอมมะลิ'],
    category: 'white_rice',
    category_th: 'ข้าวสาร',
    product_name: 'Jasmine Rice',
    product_name_th: 'ข้าวหอมมะลิ',
    description: 'Premium jasmine rice',
    description_th: 'ข้าวหอมมะลิคุณภาพดี',
    price: 45.0,
    unit: '1 kg.',
    unit_th: '1 กก.',
    stock: 120,
    image_url: '/images/rice-1.jpg',
  },
  {
    key: 'white-family',
    aliases: ['ข้าวสารแพ็กครอบครัว'],
    category: 'white_rice',
    category_th: 'ข้าวสาร',
    product_name: 'White Rice Family Pack',
    product_name_th: 'ข้าวสารแพ็กครอบครัว',
    description: 'Large family pack of white rice',
    description_th: 'ข้าวสารแพ็กขนาดใหญ่สำหรับครอบครัว',
    price: 160.0,
    unit: '5 kg.',
    unit_th: '5 กก.',
    stock: 40,
    image_url: '/images/rice-1.jpg',
  },
  {
    key: 'white-sticky',
    aliases: ['ข้าวเหนียว'],
    category: 'white_rice',
    category_th: 'ข้าวสาร',
    product_name: 'Sticky Rice',
    product_name_th: 'ข้าวเหนียว',
    description: 'Sticky rice for cooking',
    description_th: 'ข้าวเหนียวคุณภาพดี',
    price: 50.0,
    unit: '1 kg.',
    unit_th: '1 กก.',
    stock: 80,
    image_url: '/images/rice-5.jpg',
  },
  {
    key: 'white-sticky-family',
    aliases: ['ข้าวเหนียวแพ็กครอบครัว'],
    category: 'white_rice',
    category_th: 'ข้าวสาร',
    product_name: 'Sticky Rice Family Pack',
    product_name_th: 'ข้าวเหนียวแพ็กครอบครัว',
    description: 'Family pack of sticky rice',
    description_th: 'ข้าวเหนียวแพ็กขนาดใหญ่สำหรับครอบครัว',
    price: 160.0,
    unit: '5 kg.',
    unit_th: '5 กก.',
    stock: 40,
    image_url: '/images/rice-5.jpg',
  },
  {
    key: 'broken-rice',
    aliases: ['ข้าวหัก', 'ปลายข้าว'],
    category: 'broken_rice',
    category_th: 'ปลายข้าว',
    product_name: 'Broken Rice',
    product_name_th: 'ปลายข้าว',
    description: 'Clean broken rice',
    description_th: 'ปลายข้าวสะอาดพร้อมใช้งาน',
    price: 18.0,
    unit: '1 kg.',
    unit_th: '1 กก.',
    stock: 150,
    image_url: '/images/rice-3.jpg',
  },
  {
    key: 'brown-rice',
    aliases: ['ข้าวกล้อง'],
    category: 'brown_rice',
    category_th: 'ข้าวกล้อง',
    product_name: 'Brown Rice',
    product_name_th: 'ข้าวกล้อง',
    description: 'Healthy brown rice',
    description_th: 'ข้าวกล้องคุณภาพ',
    price: 55.0,
    unit: '1 kg.',
    unit_th: '1 กก.',
    stock: 100,
    image_url: '/images/rice-6.jpg',
  },
  {
    key: 'brown-healthy',
    aliases: ['ข้าวกล้องเพื่อสุขภาพ'],
    category: 'brown_rice',
    category_th: 'ข้าวกล้อง',
    product_name: 'Healthy Brown Rice Pack',
    product_name_th: 'ข้าวกล้องเพื่อสุขภาพ',
    description: 'Healthy brown rice pack',
    description_th: 'ข้าวกล้องแพ็กเพื่อสุขภาพ',
    price: 120.0,
    unit: '3 kg.',
    unit_th: '3 กก.',
    stock: 35,
    image_url: '/images/rice-6.jpg',
  },
  {
    key: 'rice-bran',
    aliases: ['รำข้าว', 'รำข้าวสำหรับสัตว์เลี้ยง'],
    category: 'rice_bran',
    category_th: 'รำข้าว',
    product_name: 'Rice Bran',
    product_name_th: 'รำข้าว',
    description: 'Rice bran for animal feed',
    description_th: 'รำข้าวสำหรับสัตว์เลี้ยง',
    price: 20.0,
    unit: '5 kg.',
    unit_th: '5 กก.',
    stock: 90,
    image_url: '/images/rice-2.png',
  },
  {
    key: 'husk',
    aliases: ['แกลบ'],
    category: 'husk',
    category_th: 'แกลบ',
    product_name: 'Rice Husk',
    product_name_th: 'แกลบ',
    description: 'Husk for fuel or compost',
    description_th: 'แกลบใช้เป็นเชื้อเพลิงหรือปุ๋ย',
    price: 12.0,
    unit: '10 kg.',
    unit_th: '10 กก.',
    stock: 60,
    image_url: '/images/rice-4.jpg',
  },
];

function buildAliasQuery(aliases) {
  return aliases.map(() => 'product_name_th = ?').join(' OR ');
}

function buildAliasParams(aliases, millId) {
  return [millId, ...aliases];
}

async function upsertProductForMill(millId, item) {
  const [rows] = await pool.query(
    `SELECT product_id FROM products WHERE mill_id = ? AND (${buildAliasQuery(item.aliases)}) ORDER BY product_id LIMIT 1`,
    buildAliasParams(item.aliases, millId)
  );

  if (rows.length > 0) {
    const keepProductId = rows[0].product_id;
    const [dupeRows] = await pool.query(
      `SELECT product_id FROM products WHERE mill_id = ? AND (${buildAliasQuery(item.aliases)}) AND product_id <> ? ORDER BY product_id`,
      [millId, ...item.aliases, keepProductId]
    );

    await pool.query(
      `UPDATE products
       SET category = ?, category_th = ?, product_name = ?, product_name_th = ?, description = ?, description_th = ?, price = ?, unit = ?, unit_th = ?, stock = ?, image_url = ?, is_available = TRUE
       WHERE product_id = ?`,
      [
        item.category,
        item.category_th,
        item.product_name,
        item.product_name_th,
        item.description,
        item.description_th,
        item.price,
        item.unit,
        item.unit_th,
        item.stock,
        item.image_url,
        keepProductId,
      ]
    );

    if (dupeRows.length > 0) {
      const duplicateIds = dupeRows.map((row) => row.product_id);
      await pool.query(`DELETE FROM products WHERE product_id IN (${duplicateIds.map(() => '?').join(',')})`, duplicateIds);
    }

    return 'updated';
  }

  await pool.query(
    `INSERT INTO products (category, category_th, product_name, product_name_th, description, description_th, price, unit, unit_th, stock, image_url, mill_id, is_available)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
    [
      item.category,
      item.category_th,
      item.product_name,
      item.product_name_th,
      item.description,
      item.description_th,
      item.price,
      item.unit,
      item.unit_th,
      item.stock,
      item.image_url,
      millId,
    ]
  );
  return 'inserted';
}

async function removeNonCatalogProducts(millId) {
  const catalogNames = CATALOG.map((item) => item.product_name_th);
  const placeholders = catalogNames.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT product_id FROM products WHERE mill_id = ? AND product_name_th NOT IN (${placeholders})`,
    [millId, ...catalogNames]
  );

  if (rows.length === 0) {
    return 0;
  }

  const ids = rows.map((row) => row.product_id);
  await pool.query(`DELETE FROM products WHERE product_id IN (${ids.map(() => '?').join(',')})`, ids);
  return ids.length;
}

async function main() {
  try {
    console.log('📦 Syncing canonical products to every active mill...\n');

    const [mills] = await pool.query(
      'SELECT mill_id, mill_name_th, mill_name FROM mills WHERE is_active = TRUE ORDER BY mill_id'
    );
    console.log(`✅ Found active mills: ${mills.length}`);

    let inserted = 0;
    let updated = 0;
    let removed = 0;

    for (const mill of mills) {
      console.log(`\n🔄 Mill ${mill.mill_id}: ${mill.mill_name_th || mill.mill_name}`);
      for (const item of CATALOG) {
        const result = await upsertProductForMill(mill.mill_id, item);
        if (result === 'inserted') inserted++;
        if (result === 'updated') updated++;
      }
      removed += await removeNonCatalogProducts(mill.mill_id);
      console.log(`   ✅ Catalog ensured: ${CATALOG.length} items`);
    }

    console.log(`\n✨ Done. Inserted: ${inserted}, Updated: ${updated}, Removed: ${removed}`);
    await pool.end();
  } catch (err) {
    console.error('❌ Sync failed:', err.message);
    process.exit(1);
  }
}

main();
