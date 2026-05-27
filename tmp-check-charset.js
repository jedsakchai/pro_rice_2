require('dotenv').config({ override: true });
const pool = require('./config/database');

(async () => {
  const [rows] = await pool.query(
    "SELECT COLUMN_NAME, CHARACTER_SET_NAME, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mills' AND COLUMN_NAME IN ('location_th','mill_name_th','mill_name')"
  );
  console.log(rows);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
