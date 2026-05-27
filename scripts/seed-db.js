/* eslint-disable no-console */

require('dotenv').config({ override: true });

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

function todayPlus(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'rice_mill_db';

  const conn = await mysql.createConnection({ host, port, user, password, database });

  try {
    // Owners (เจ้าของโรงสี)
    const [[{ c: ownersCount }]] = await conn.query('SELECT COUNT(*) AS c FROM owners');
    if (ownersCount === 0) {
      const password_hash = await bcrypt.hash('demo1234', 10);
      await conn.execute(
        'INSERT INTO owners (owner_name, mill_name, mill_id, password_hash) VALUES (?, ?, ?, ?)',
        ['demo', 'demo', 1, password_hash]
      );
      console.log('✅ Seeded owners: demo/demo1234 (owner)');
    } else {
      console.log('ℹ️ owners already has data; skipping');
    }

    // Villagers (ชาวบ้าน)
    const [[{ c: villagersCount }]] = await conn.query('SELECT COUNT(*) AS c FROM villagers');
    if (villagersCount === 0) {
      const villager_hash = await bcrypt.hash('village1234', 10);
      await conn.execute(
        'INSERT INTO villagers (villager_name, username, password_hash) VALUES (?, ?, ?)',
        ['ชาวบ้านตัวอย่าง', 'villager1', villager_hash]
      );
      console.log('✅ Seeded villagers: villager1/village1234 (villager)');
    } else {
      console.log('ℹ️ villagers already has data; skipping');
    }

    // Milling requests
    const [[{ c: reqCount }]] = await conn.query('SELECT COUNT(*) AS c FROM milling_requests');
    if (reqCount === 0) {
      await conn.execute(
        `INSERT INTO milling_requests
          (mill_id, rice_type, customer_name, phone, address, sacks, dropoff_date, status, review_status, notes)
         VALUES
          (1, 'white_rice', 'สมชาย ใจดี', '0812345678', '123/4 ต.ตัวอย่าง อ.ตัวอย่าง', 10, ?, 'pending', 'pending_review', 'ตัวอย่างคำขอ'),
          (2, 'brown_rice', 'สมหญิง ใจดี', '0891112222', '55 หมู่ 2 ต.บ้านใหม่', 6, ?, 'pending', 'pending_review', NULL),
          (3, 'sticky_rice', 'นายดำ', '0863334444', '9/9 ต.เมือง', 3, ?, 'pending', 'pending_review', 'โทรนัดล่วงหน้า')`,
        [todayPlus(1), todayPlus(2), todayPlus(3)]
      );
      console.log('✅ Seeded milling_requests (3 rows)');
    } else {
      console.log('ℹ️ milling_requests already has data; skipping');
    }

    // Inquiries
    const [[{ c: inqCount }]] = await conn.query('SELECT COUNT(*) AS c FROM inquiries');
    if (inqCount === 0) {
      await conn.execute(
        `INSERT INTO inquiries (subject, message, customer_name, phone, email, status)
         VALUES
          ('สอบถามราคา', 'สีข้าวขาว 10 กระสอบราคาเท่าไหร่?', 'สมชาย', '0812345678', 'somchai@example.com', 'new'),
          ('เวลารับข้าว', 'รับข้าวได้วันไหน?', 'สมหญิง', '0891112222', NULL, 'new')`
      );
      console.log('✅ Seeded inquiries (2 rows)');
    } else {
      console.log('ℹ️ inquiries already has data; skipping');
    }

    // Contacts
    const [[{ c: contactCount }]] = await conn.query('SELECT COUNT(*) AS c FROM contacts');
    if (contactCount === 0) {
      await conn.execute(
        `INSERT INTO contacts (name, email, phone, message, subject, status)
         VALUES (?, ?, ?, ?, ?, 'new')`,
        ['ผู้ใช้งานตัวอย่าง', 'demo@example.com', '0800000000', 'ทดสอบติดต่อ', 'ทดสอบ']
      );
      console.log('✅ Seeded contacts (1 row)');
    } else {
      console.log('ℹ️ contacts already has data; skipping');
    }

    // Products
    const [[{ c: productsCount }]] = await conn.query('SELECT COUNT(*) AS c FROM products');
    if (productsCount === 0) {
      await conn.execute(
        `INSERT INTO products
          (product_id, category, category_th, product_name, product_name_th, description, description_th, price, unit, unit_th, stock, image_url, mill_id)
         VALUES
            (1, 'white_rice', 'ข้าวสาร', 'Jasmine Rice', 'ข้าวหอมมะลิ', 'Premium jasmine rice', 'ข้าวหอมมะลิคุณภาพดี', 45.00, '1 kg.', '1 กก.', 120, '/images/rice-1.jpg', 1),
            (2, 'white_rice', 'ข้าวสาร', 'White Rice Family Pack', 'ข้าวสารแพ็กครอบครัว', 'Large family pack of white rice', 'ข้าวสารแพ็กขนาดใหญ่สำหรับครอบครัว', 160.00, '5 kg.', '5 กก.', 40, '/images/rice-1.jpg', 1),
            (3, 'white_rice', 'ข้าวสาร', 'Sticky Rice', 'ข้าวเหนียว', 'Sticky rice for cooking', 'ข้าวเหนียวคุณภาพดี', 50.00, '1 kg.', '1 กก.', 80, '/images/rice-5.jpg', 1),
            (4, 'white_rice', 'ข้าวสาร', 'Sticky Rice Family Pack', 'ข้าวเหนียวแพ็กครอบครัว', 'Family pack of sticky rice', 'ข้าวเหนียวแพ็กขนาดใหญ่สำหรับครอบครัว', 160.00, '5 kg.', '5 กก.', 40, '/images/rice-5.jpg', 1),
            (5, 'broken_rice', 'ปลายข้าว', 'Broken Rice', 'ปลายข้าว', 'Clean broken rice', 'ปลายข้าวสะอาดพร้อมใช้งาน', 18.00, '1 kg.', '1 กก.', 150, '/images/rice-3.jpg', 1),
            (6, 'brown_rice', 'ข้าวกล้อง', 'Brown Rice', 'ข้าวกล้อง', 'Healthy brown rice', 'ข้าวกล้องคุณภาพ', 55.00, '1 kg.', '1 กก.', 100, '/images/rice-6.jpg', 1),
            (7, 'brown_rice', 'ข้าวกล้อง', 'Healthy Brown Rice Pack', 'ข้าวกล้องเพื่อสุขภาพ', 'Healthy brown rice pack', 'ข้าวกล้องแพ็กเพื่อสุขภาพ', 120.00, '3 kg.', '3 กก.', 35, '/images/rice-6.jpg', 1),
            (8, 'rice_bran', 'รำข้าว', 'Rice Bran', 'รำข้าว', 'Rice bran for animal feed', 'รำข้าวสำหรับสัตว์เลี้ยง', 20.00, '5 kg.', '5 กก.', 90, '/images/rice-2.png', 1),
            (9, 'husk', 'แกลบ', 'Rice Husk', 'แกลบ', 'Husk for fuel or compost', 'แกลบใช้เป็นเชื้อเพลิงหรือปุ๋ย', 12.00, '10 kg.', '10 กก.', 60, '/images/rice-4.jpg', 1)`
      );
          console.log('✅ Seeded products (9 rows)');
    } else {
      console.log('ℹ️ products already has data; skipping');
    }

    console.log('✅ Seed completed');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exitCode = 1;
});
