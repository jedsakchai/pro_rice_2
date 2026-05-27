require('dotenv').config({ override: true });
const pool = require('./config/database');

(async () => {
  const value = 'ที่อยู่ทดสอบ ภาษาไทย';
  await pool.execute('UPDATE mills SET location_th = ? WHERE mill_id = 1', [value]);
  const [rows] = await pool.query('SELECT mill_id, location_th FROM mills WHERE mill_id = 1');
  console.log(rows);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
