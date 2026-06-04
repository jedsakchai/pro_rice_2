const pool = require('../database/mysql');

function parseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

async function upsertLineUser({ lineUserId, displayName = null, phone = null }) {
  if (!lineUserId) return null;

  await pool.execute(
    `INSERT INTO users (line_user_id, display_name, phone, role, current_flow, flow_data)
     VALUES (?, ?, ?, 'customer', NULL, NULL)
     ON DUPLICATE KEY UPDATE
       display_name = COALESCE(NULLIF(VALUES(display_name), ''), display_name),
       phone = COALESCE(NULLIF(VALUES(phone), ''), phone),
       updated_at = CURRENT_TIMESTAMP`,
    [String(lineUserId), displayName || null, phone || null]
  );

  return getLineUser(lineUserId);
}

async function getLineUser(lineUserId) {
  if (!lineUserId) return null;

  const [rows] = await pool.execute(
    `SELECT user_id, line_user_id, display_name, phone, role, current_flow, flow_data, chat_state_json, pending_intent, pending_payload_json, created_at, updated_at
     FROM users
     WHERE line_user_id = ?
     LIMIT 1`,
    [String(lineUserId)]
  );

  if (!rows || rows.length === 0) return null;
  const row = rows[0];
  return {
    ...row,
    flow_data: parseJson(row.flow_data),
    chat_state_json: parseJson(row.chat_state_json),
    pending_payload_json: parseJson(row.pending_payload_json),
  };
}

async function updateFlowState(lineUserId, currentFlow, flowData) {
  if (!lineUserId) return;

  await pool.execute(
    `UPDATE users
     SET current_flow = ?, flow_data = ?, updated_at = CURRENT_TIMESTAMP
     WHERE line_user_id = ?`,
    [currentFlow || null, flowData ? JSON.stringify(flowData) : null, String(lineUserId)]
  );
}

async function clearFlowState(lineUserId) {
  await updateFlowState(lineUserId, null, null);
}

module.exports = {
  clearFlowState,
  getLineUser,
  updateFlowState,
  upsertLineUser,
};