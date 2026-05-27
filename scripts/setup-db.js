/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ override: true });

const mysql = require('mysql2/promise');

function readSchema() {
  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  return fs.readFileSync(schemaPath, 'utf8');
}

function stripComments(sql) {
  // Remove /* ... */ blocks
  let out = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove -- comments (line-based)
  out = out
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('--')) return '';
      return line;
    })
    .join('\n');
  return out;
}

function splitStatements(sql) {
  const statements = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let prev = '';

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];

    if (!inDouble && !inBacktick && ch === "'" && prev !== '\\') {
      inSingle = !inSingle;
    } else if (!inSingle && !inBacktick && ch === '"' && prev !== '\\') {
      inDouble = !inDouble;
    } else if (!inSingle && !inDouble && ch === '`' && prev !== '\\') {
      inBacktick = !inBacktick;
    }

    if (ch === ';' && !inSingle && !inDouble && !inBacktick) {
      const stmt = current.trim();
      if (stmt) statements.push(stmt);
      current = '';
    } else {
      current += ch;
    }

    prev = ch;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);

  return statements;
}

async function main() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';

  const raw = readSchema();
  const sql = stripComments(raw);
  const statements = splitStatements(sql);

  if (statements.length === 0) {
    throw new Error('No SQL statements found in db/schema.sql');
  }

  console.log(`🔧 Connecting to MySQL ${host}:${port} as ${user}...`);
  const conn = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: false,
  });

  try {
    for (const stmt of statements) {
      // Skip empty
      if (!stmt.trim()) continue;
      await conn.query(stmt);
    }
  } finally {
    await conn.end();
  }

  console.log('✅ Database setup completed from db/schema.sql');
}

main().catch((err) => {
  console.error('❌ Database setup failed:', err.message);
  process.exitCode = 1;
});
