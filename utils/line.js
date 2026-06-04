const crypto = require('crypto');
const https = require('https');

function normalizeText(value) {
  return String(value || '').trim();
}

function isConfirmText(value) {
  const text = normalizeText(value).toLowerCase();
  return ['ยืนยัน', 'confirm', 'ตกลง', 'ใช่', 'ok', 'yes', 'ถูกต้อง'].some((word) => text.includes(word));
}

function isCancelText(value) {
  const text = normalizeText(value).toLowerCase();
  return ['ยกเลิก', 'cancel', 'ไม่เอา', 'ไม่ยืนยัน', 'แก้ไข'].some((word) => text.includes(word));
}

function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!channelSecret) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''));
  const digest = crypto.createHmac('sha256', channelSecret).update(body).digest('base64');
  return digest === String(signature || '').trim();
}

function normalizeMessages(messages) {
  if (!messages) return [];
  if (Array.isArray(messages)) return messages.filter(Boolean);
  return [messages];
}

function buildTextMessage(text) {
  return { type: 'text', text: String(text || '') };
}

function replyLineMessage({ replyToken, messages, channelAccessToken }) {
  const payload = JSON.stringify({
    replyToken,
    messages: normalizeMessages(messages),
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      'https://api.line.me/v2/bot/message/reply',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${channelAccessToken}`,
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ success: true, statusCode: res.statusCode, data });
            return;
          }

          reject(new Error(`LINE reply failed: ${res.statusCode} ${data}`));
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = {
  buildTextMessage,
  isCancelText,
  isConfirmText,
  normalizeMessages,
  normalizeText,
  replyLineMessage,
  verifyLineSignature,
};