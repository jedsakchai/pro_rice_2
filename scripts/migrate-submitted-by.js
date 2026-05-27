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
    await c.query("ALTER TABLE milling_requests ADD COLUMN submitted_by INT NULL AFTER mill_id");
    console.log('column submitted_by added');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('column submitted_by already exists');
    else throw e;
  }

  // Add FK constraint (ignore if already exists)
  try {
    await c.query("ALTER TABLE milling_requests ADD CONSTRAINT fk_milling_requests_submitted_by FOREIGN KEY (submitted_by) REFERENCES owners(owner_id) ON DELETE SET NULL ON UPDATE CASCADE");
    console.log('FK constraint added');
  } catch (e) {
    if (e.code === 'ER_FK_DUP_NAME' || e.code === 'ER_DUP_KEYNAME') console.log('FK already exists');
    else console.log('FK skipped:', e.code);
  }

  // Add index
  try {
    await c.query("ALTER TABLE milling_requests ADD INDEX idx_submitted_by (submitted_by)");
    console.log('index added');
  } catch (e) {
    if (e.code === 'ER_DUP_KEYNAME') console.log('index already exists');
    else console.log('index skipped:', e.code);
  }

  await c.end();
  console.log('migration done');
})();
