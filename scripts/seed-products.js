const pool = require('../config/database');

const CATALOG = [
  {
    product_id: 1,
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
    mill_id: 1,
    is_available: 1,
  },
  {
    product_id: 2,
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
    mill_id: 1,
    is_available: 1,
  },
  {
    product_id: 3,
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
    mill_id: 1,
    is_available: 1,
  },
  {
    product_id: 4,
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
    mill_id: 1,
    is_available: 1,
  },
  {
    product_id: 5,
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
    mill_id: 1,
    is_available: 1,
  },
  {
    product_id: 6,
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
    mill_id: 1,
    is_available: 1,
  },
  {
    product_id: 7,
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
    mill_id: 1,
    is_available: 1,
  },
  {
    product_id: 8,
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
    mill_id: 1,
    is_available: 1,
  },
  {
    product_id: 9,
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
    mill_id: 1,
    is_available: 1,
  },
];

async function main() {
  const products = CATALOG;

  try {
    await pool.query('DELETE FROM products');
    for (const p of products) {
      await pool.query(
        `INSERT INTO products (
          product_id, category, category_th, product_name, product_name_th,
          description, description_th, price, unit, unit_th, stock,
          image_url, mill_id, is_available
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.product_id,
          p.category,
          p.category_th,
          p.product_name,
          p.product_name_th,
          p.description,
          p.description_th,
          p.price,
          p.unit,
          p.unit_th,
          p.stock,
          p.image_url,
          p.mill_id,
          p.is_available,
        ]
      );
    }

    console.log(`Seeded ${products.length} products.`);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
