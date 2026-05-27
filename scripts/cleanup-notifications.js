const pool = require('../config/database');

const FINAL_STATUSES = ['completed', 'cancelled'];
const DEFAULT_DAYS = 90;

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const daysArg = args.find((arg) => arg.startsWith('--days='));
  const days = daysArg ? Number(daysArg.split('=')[1]) : Number(process.env.NOTIFICATION_CLEANUP_DAYS || DEFAULT_DAYS);

  return {
    dryRun,
    days: Number.isFinite(days) && days > 0 ? days : DEFAULT_DAYS,
  };
}

async function main() {
  const { dryRun, days } = parseArgs();
  const conn = await pool.getConnection();
  try {
    const [summaryRows] = await conn.query(
      `SELECT COUNT(*) AS total
       FROM notifications
       WHERE status IN (?)
         AND created_at < (NOW() - INTERVAL ? DAY)`,
      [FINAL_STATUSES, days]
    );

    const total = Number(summaryRows?.[0]?.total || 0);
    console.log(`Found ${total} final notifications older than ${days} days`);

    if (dryRun) {
      console.log('Dry run mode: no rows deleted');
      return;
    }

    const [result] = await conn.query(
      `DELETE FROM notifications
       WHERE status IN (?)
         AND created_at < (NOW() - INTERVAL ? DAY)`,
      [FINAL_STATUSES, days]
    );

    console.log(`✅ Deleted ${result.affectedRows || 0} old notification rows`);
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    throw error;
  } finally {
    conn.release();
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));