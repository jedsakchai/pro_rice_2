const https = require('https');

function postJson(urlString, token, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const body = JSON.stringify(payload);

    const req = https.request(
      {
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode || 0, body: data });
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function replyToLine(replyToken, messages) {
  const token = String(process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim();
  if (!token) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not configured');
  }

  const items = Array.isArray(messages) ? messages : [messages];
  return postJson('https://api.line.me/v2/bot/message/reply', token, {
    replyToken,
    messages: items,
  });
}

module.exports = {
  replyToLine,
};