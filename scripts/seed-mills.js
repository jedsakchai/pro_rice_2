const pool = require('../config/database');

async function main() {
  const mills = [
    {
      mill_id: 1,
      mill_name: 'Central Mill',
      mill_name_th: 'โรงสีกลาง',
      location: '123 Thep Satit Rd., Udon Thani',
      location_th: '123 ถนนเทพสถิต จังหวัดอุดรธานี',
      phone: '081-234-5678',
      email: 'central@ricemillsite.com',
      capacity_per_day: 500,
      operating_hours_start: '06:00:00',
      operating_hours_end: '20:00:00',
    },
    {
      mill_id: 2,
      mill_name: 'Northern Mill',
      mill_name_th: 'โรงสีเหนือ',
      location: '456 Chiang Mai Rd., Chiang Mai',
      location_th: '456 ถนนเชียงใหม่ จังหวัดเชียงใหม่',
      phone: '085-987-6543',
      email: 'north@ricemillsite.com',
      capacity_per_day: 300,
      operating_hours_start: '07:00:00',
      operating_hours_end: '19:00:00',
    },
    {
      mill_id: 3,
      mill_name: 'Southern Mill',
      mill_name_th: 'โรงสีใต้ พรีเมียม',
      location: '789 Petchkasem Rd., Songkhla',
      location_th: '789 ถนนเพชรเกษม จังหวัดสงขลา',
      phone: '086-456-7890',
      email: 'south@ricemillsite.com',
      capacity_per_day: 450,
      operating_hours_start: '06:00:00',
      operating_hours_end: '19:00:00',
    },
  ];

  try {
    for (const mill of mills) {
      await pool.query(
        `UPDATE mills
         SET mill_name = ?, mill_name_th = ?, location = ?, location_th = ?,
             phone = ?, email = ?, capacity_per_day = ?, operating_hours_start = ?, operating_hours_end = ?
         WHERE mill_id = ?`,
        [
          mill.mill_name,
          mill.mill_name_th,
          mill.location,
          mill.location_th,
          mill.phone,
          mill.email,
          mill.capacity_per_day,
          mill.operating_hours_start,
          mill.operating_hours_end,
          mill.mill_id,
        ]
      );
    }

    console.log(`Updated ${mills.length} mills.`);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
