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
    await c.query("ALTER TABLE owners ADD COLUMN role ENUM('villager','owner') NOT NULL DEFAULT 'villager' AFTER mill_id");
    console.log('column added');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('column already exists');
    else throw e;
  }

  await c.query("UPDATE owners SET role = 'owner' WHERE mill_id IS NOT NULL AND role = 'villager'");
  console.log('existing owners updated to role=owner');

  await c.end();
})();
