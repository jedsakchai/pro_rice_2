const { spawn } = require('child_process');
const path = require('path');

const CLEANUP_SCRIPT = path.join(__dirname, '..', 'cleanup-notifications.js');
const DAYS = process.env.CLEANUP_DAYS || '90';

function runCleanup(dryRun = false) {
  const args = [CLEANUP_SCRIPT, dryRun ? '--dry-run' : '', `--days=${DAYS}`].filter(Boolean);
  // Run with project root as cwd so dotenv can load .env from repo root
  const projectRoot = path.resolve(__dirname, '..', '..');
  const proc = spawn(process.execPath, args, { stdio: 'inherit', cwd: projectRoot });
  proc.on('exit', (code) => {
    console.log(`cleanup-notifications exited with code ${code}`);
  });
}

function msUntilNext(hour = 3, minute = 0) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next - now;
}

function scheduleDaily(hour = 3, minute = 0) {
  const firstDelay = msUntilNext(hour, minute);
  console.log(`Notifications cleanup scheduler: first run in ${Math.round(firstDelay / 1000)}s`);
  setTimeout(() => {
    runCleanup(true); // start with a dry-run
    // then run real cleanup
    runCleanup(false);
    // schedule subsequent runs every 24h
    setInterval(() => runCleanup(false), 24 * 60 * 60 * 1000);
  }, firstDelay);
}

// Start: run an immediate dry-run and schedule daily real runs at 03:00
runCleanup(true);
scheduleDaily(3, 0);

// keep process alive
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
