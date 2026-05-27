const pool = require('../config/database');

const INDEX_NAME = 'uq_notifications_type_resource_villager';

async function dedupeNotifications(conn) {
  const [groups] = await conn.query(
    `SELECT type, resource_id, villager_id, COUNT(*) AS cnt
     FROM notifications
     GROUP BY type, resource_id, villager_id
     HAVING COUNT(*) > 1`
  );

  for (const group of groups) {
    const [rows] = await conn.query(
      `SELECT notification_id
       FROM notifications
       WHERE type = ? AND resource_id = ? AND villager_id <=> ?
       ORDER BY created_at DESC, notification_id DESC`,
      [group.type, group.resource_id, group.villager_id]
    );

    if (rows.length <= 1) continue;

    const keepId = rows[0].notification_id;
    const deleteIds = rows.slice(1).map((row) => row.notification_id);
    console.log(`Keeping notification ${keepId}; deleting ${deleteIds.length} duplicates for ${group.type}-${group.resource_id}`);
    await conn.query('DELETE FROM notifications WHERE notification_id IN (?)', [deleteIds]);
  }
}

async function migrate() {
  const conn = await pool.getConnection();
  try {
    console.log('Checking duplicate notification rows...');
    await dedupeNotifications(conn);

    const [indexes] = await conn.query(
      `SELECT INDEX_NAME
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'notifications'
         AND INDEX_NAME = ?`,
      [INDEX_NAME]
    );

    if (indexes.length > 0) {
      console.log(`✓ Unique index already exists: ${INDEX_NAME}`);
      return;
    }

    console.log(`Adding unique index ${INDEX_NAME} on notifications(type, resource_id, villager_id)...`);
    await conn.query(
      `ALTER TABLE notifications
       ADD UNIQUE KEY ${INDEX_NAME} (type, resource_id, villager_id)`
    );
    console.log('✅ Unique index added successfully');
  } catch (error) {
    console.error('❌ Notifications unique-index migration failed:', error.message);
    throw error;
  } finally {
    conn.release();
  }
}

migrate()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));