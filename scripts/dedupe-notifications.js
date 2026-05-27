const pool = require('../config/database');

(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('Scanning for duplicate notifications (type, resource_id, villager_id)...');
    const [dups] = await conn.query(
      `SELECT type, resource_id, villager_id, COUNT(*) as cnt
       FROM notifications
       GROUP BY type, resource_id, villager_id
       HAVING COUNT(*) > 1`
    );

    console.log(`Found ${dups.length} duplicate groups`);
    for (const d of dups) {
      const type = d.type;
      const resource_id = d.resource_id;
      const villager_id = d.villager_id;

      const [rows] = await conn.query(
        `SELECT notification_id, created_at
         FROM notifications
         WHERE type = ? AND resource_id = ? AND villager_id = ?
         ORDER BY created_at DESC, notification_id DESC`,
        [type, resource_id, villager_id]
      );

      if (rows.length <= 1) continue;
      const keep = rows[0].notification_id;
      const toDelete = rows.slice(1).map(r => r.notification_id);

      console.log(`Keeping ${keep} and deleting ${toDelete.length} duplicates for ${type}-${resource_id} (villager ${villager_id})`);
      await conn.query('DELETE FROM notifications WHERE notification_id IN (?)', [toDelete]);
    }

    // Summary after cleanup
    const [[{ total_before }]] = await conn.query('SELECT COUNT(*) AS total_before FROM notifications');
    const [groups] = await conn.query('SELECT type, resource_id, villager_id, COUNT(*) as cnt FROM notifications GROUP BY type, resource_id, villager_id HAVING COUNT(*) > 1');
    console.log('Duplicates remaining:', groups.length);

    conn.release();
    await pool.end();
    console.log('Done.');
  } catch (e) {
    console.error('Error during dedupe:', e && e.message);
    process.exit(1);
  }
})();
