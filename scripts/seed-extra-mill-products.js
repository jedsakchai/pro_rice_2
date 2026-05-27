const pool = require('../config/database');

async function ensure() {
  const conn = await pool.getConnection();
  try {
    // Check if any products exist for mill 2 and 3
    const [r2] = await conn.execute('SELECT COUNT(*) AS c FROM products WHERE mill_id = 2');
    const [r3] = await conn.execute('SELECT COUNT(*) AS c FROM products WHERE mill_id = 3');

    if (r2[0].c === 0) {
      console.log('Inserting sample products for mill 2');
      await conn.execute(
        `INSERT INTO products (category, category_th, product_name, product_name_th, description, description_th, price, unit, unit_th, stock, image_url, mill_id, is_available)
         VALUES
         (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
         (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'white_rice', 'ข้าวสาร', 'Northern Jasmine', 'ข้าวหอมมะลิเหนือ', 'Fragrant rice from northern mill', 'ข้าวหอมมะลิจากโรงสีเหนือ', '48.00', '1 kg.', '1 กก.', 80, '/images/rice-1.jpg', 2, 1,
          'broken_rice', 'ปลายข้าว', 'Northern Broken', 'ปลายข้าวเหนือ', 'Broken rice from northern mill', 'ปลายข้าวจากโรงสีเหนือ', '20.00', '1 kg.', '1 กก.', 120, '/images/rice-3.jpg', 2, 1
        ]
      );
    } else {
      console.log('Products exist for mill 2');
    }

    if (r3[0].c === 0) {
      console.log('Inserting sample products for mill 3');
      await conn.execute(
        `INSERT INTO products (category, category_th, product_name, product_name_th, description, description_th, price, unit, unit_th, stock, image_url, mill_id, is_available)
         VALUES
         (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
         (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'husk', 'แกลบ', 'Southern Husk', 'แกลบใต้', 'Rice husk from southern mill', 'แกลบจากโรงสีใต้', '14.00', '1 sack', '1 กระสอบ', 50, '/images/rice-4.jpg', 3, 1,
          'rice_bran', 'รำข้าว', 'Southern Bran', 'รำข้าวใต้', 'Rice bran from southern mill', 'รำข้าวจากโรงสีใต้', '22.00', '1 kg.', '1 กก.', 70, '/images/rice-2.png', 3, 1
        ]
      );
    } else {
      console.log('Products exist for mill 3');
    }

    console.log('Seeding extra mill products done');
  } catch (err) {
    console.error('Seeding failed', err);
  } finally {
    if (conn) conn.release();
    process.exit(0);
  }
}

ensure();
