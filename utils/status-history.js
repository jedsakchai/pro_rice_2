function shouldIgnoreHistoryError(err) {
  const code = err && err.code ? String(err.code) : '';
  return ['ER_NO_SUCH_TABLE', 'ER_BAD_TABLE_ERROR', 'ER_NO_SUCH_FIELD', 'ER_BAD_FIELD_ERROR'].includes(code);
}

async function recordStatusHistory(conn, { resourceType, resourceId, fromStatus = null, toStatus }) {
  const type = String(resourceType || '').trim();
  const id = Number(resourceId);
  const nextStatus = String(toStatus || '').trim();

  if (!type || !Number.isFinite(id) || !nextStatus) return;

  try {
    await conn.execute(
      'INSERT INTO status_history (resource_type, resource_id, from_status, to_status) VALUES (?, ?, ?, ?)',
      [type, id, fromStatus ? String(fromStatus).trim() : null, nextStatus]
    );
  } catch (err) {
    if (!shouldIgnoreHistoryError(err)) {
      console.error('record status history failed:', err && err.message ? err.message : err);
    }
  }
}

async function loadStatusHistory(conn, { resourceType, resourceId }) {
  const type = String(resourceType || '').trim();
  const id = Number(resourceId);

  if (!type || !Number.isFinite(id)) return [];

  try {
    const [rows] = await conn.query(
      `SELECT history_id, resource_type, resource_id, from_status, to_status, created_at
       FROM status_history
       WHERE resource_type = ? AND resource_id = ?
       ORDER BY created_at ASC, history_id ASC`,
      [type, id]
    );
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    if (shouldIgnoreHistoryError(err)) return [];
    throw err;
  }
}

module.exports = {
  loadStatusHistory,
  recordStatusHistory,
};