/**
 * Migration: แยกตาราง villagers ออกจาก owners
 *
 * 1. สร้างตาราง villagers
 * 2. ย้ายข้อมูล role='villager' จาก owners ไป villagers
 * 3. อัปเดต milling_requests.submitted_by ให้ชี้ไป villager_id
 * 4. ลบแถว villager ออกจาก owners
 * 5. ลบคอลัมน์ role ออกจาก owners
 */

require('dotenv').config({ override: true });
const mysql = require('mysql2/promise');

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    // 1. สร้างตาราง villagers
    await c.query(`
      CREATE TABLE IF NOT EXISTS villagers (
        villager_id INT PRIMARY KEY AUTO_INCREMENT,
        villager_name VARCHAR(120) NOT NULL,
        username VARCHAR(120) NOT NULL,
        phone VARCHAR(30) NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_villager_name (villager_name),
        UNIQUE KEY uq_villager_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('1. ตาราง villagers สร้างแล้ว');

    // 2. ย้ายข้อมูล villager จาก owners → villagers
    const [villagerRows] = await c.query(
      "SELECT owner_id, owner_name, mill_name, password_hash, created_at FROM owners WHERE role = 'villager'"
    );
    console.log(`   พบชาวบ้านใน owners: ${villagerRows.length} คน`);

    // map: old owner_id → new villager_id
    const idMap = {};

    for (const v of villagerRows) {
      try {
        const [result] = await c.execute(
          'INSERT INTO villagers (villager_name, username, password_hash, created_at) VALUES (?, ?, ?, ?)',
          [v.owner_name, v.mill_name, v.password_hash, v.created_at]
        );
        idMap[v.owner_id] = result.insertId;
        console.log(`   ย้าย: ${v.owner_name} (owner_id=${v.owner_id}) → villager_id=${result.insertId}`);
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          // already migrated
          const [existing] = await c.execute(
            'SELECT villager_id FROM villagers WHERE username = ? LIMIT 1',
            [v.mill_name]
          );
          if (existing[0]) {
            idMap[v.owner_id] = existing[0].villager_id;
            console.log(`   ข้าม (มีแล้ว): ${v.owner_name} → villager_id=${existing[0].villager_id}`);
          }
        } else {
          throw e;
        }
      }
    }

    // 3. เพิ่มคอลัมน์ submitted_by_villager ใน milling_requests
    try {
      await c.query('ALTER TABLE milling_requests ADD COLUMN submitted_by_villager INT NULL AFTER submitted_by');
      console.log('2. เพิ่มคอลัมน์ submitted_by_villager แล้ว');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log('2. คอลัมน์ submitted_by_villager มีอยู่แล้ว');
      else throw e;
    }

    // 4. อัปเดต submitted_by_villager จาก mapping
    for (const [oldId, newId] of Object.entries(idMap)) {
      await c.execute(
        'UPDATE milling_requests SET submitted_by_villager = ? WHERE submitted_by = ?',
        [newId, Number(oldId)]
      );
    }
    console.log('3. อัปเดต submitted_by_villager ตาม mapping แล้ว');

    // 5. ลบ FK เก่า submitted_by → owners
    try {
      await c.query('ALTER TABLE milling_requests DROP FOREIGN KEY fk_milling_requests_submitted_by');
      console.log('4. ลบ FK submitted_by → owners แล้ว');
    } catch (e) {
      console.log('4. FK submitted_by ไม่มี หรือลบไปแล้ว:', e.code);
    }

    // 6. ลบคอลัมน์ submitted_by เก่า แล้ว rename submitted_by_villager → submitted_by
    try {
      await c.query('ALTER TABLE milling_requests DROP INDEX idx_submitted_by');
    } catch (e) { /* ok */ }
    try {
      await c.query('ALTER TABLE milling_requests DROP COLUMN submitted_by');
      console.log('5. ลบคอลัมน์ submitted_by เก่าแล้ว');
    } catch (e) {
      console.log('5. submitted_by เก่าลบไม่ได้:', e.code);
    }

    try {
      await c.query('ALTER TABLE milling_requests CHANGE submitted_by_villager submitted_by INT NULL');
      console.log('6. Rename submitted_by_villager → submitted_by แล้ว');
    } catch (e) {
      console.log('6. Rename ข้าม:', e.code);
    }

    // 7. เพิ่ม FK ใหม่ submitted_by → villagers
    try {
      await c.query('ALTER TABLE milling_requests ADD INDEX idx_submitted_by (submitted_by)');
    } catch (e) { /* ok */ }
    try {
      await c.query(`ALTER TABLE milling_requests 
        ADD CONSTRAINT fk_milling_submitted_villager 
        FOREIGN KEY (submitted_by) REFERENCES villagers(villager_id) 
        ON DELETE SET NULL ON UPDATE CASCADE`);
      console.log('7. เพิ่ม FK submitted_by → villagers แล้ว');
    } catch (e) {
      if (e.code === 'ER_FK_DUP_NAME') console.log('7. FK มีอยู่แล้ว');
      else console.log('7. FK:', e.code, e.message);
    }

    // 8. ลบแถว villager ออกจาก owners
    const [delResult] = await c.query("DELETE FROM owners WHERE role = 'villager'");
    console.log(`8. ลบชาวบ้านออกจาก owners: ${delResult.affectedRows} แถว`);

    // 9. ลบคอลัมน์ role ออกจาก owners
    try {
      await c.query('ALTER TABLE owners DROP COLUMN role');
      console.log('9. ลบคอลัมน์ role ออกจาก owners แล้ว');
    } catch (e) {
      console.log('9. ลบ role:', e.code);
    }

    console.log('\n✅ Migration เสร็จสิ้น — owners = เจ้าของโรงสี, villagers = ชาวบ้าน');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await c.end();
  }
})();
