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
          if ((res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300) {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(null);
            }
            return;
          }
          reject(new Error(`LLM request failed: ${res.statusCode} ${data}`));
        });
      }
    );

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function generateGeneralAnswer(text) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return '';

  try {
    const response = await postJson('https://api.openai.com/v1/chat/completions', apiKey, {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'You are a helpful Thai LINE chatbot for a rice mill. Answer briefly and politely in Thai.' },
        { role: 'user', content: String(text || '') },
      ],
    });

    return String(response?.choices?.[0]?.message?.content || '').trim();
  } catch {
    return '';
  }
}

module.exports = {
  generateGeneralAnswer,
};