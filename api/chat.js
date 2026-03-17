const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const messages = (req.body && req.body.messages) ? req.body.messages : [];

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages array required' });
    return;
  }

  const API_KEY = '4a4d67f6-416d-4ae3-b7f1-41c947f3afe9';

  const SYSTEM = 'You are J.A.R.V.I.S., Tony Stark\'s AI assistant. Always reply in Brazilian Portuguese (pt-BR). Be intelligent, concise, slightly formal. Occasionally say "Senhor". Maximum 2 short paragraphs.';

  const payload = JSON.stringify({
    model: 'Meta-Llama-3.3-70B-Instruct',
    max_tokens: 400,
    temperature: 0.7,
    stream: false,
    messages: [
      { role: 'system', content: SYSTEM },
      ...messages.slice(-10)
    ]
  });

  function callApi() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.sambanova.ai',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + API_KEY,
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (apiRes) => {
        let data = '';
        apiRes.on('data', chunk => { data += chunk; });
        apiRes.on('end', () => {
          resolve({ status: apiRes.statusCode, body: data });
        });
      });

      req.on('error', (err) => reject(err));
      req.setTimeout(25000, () => {
        req.destroy();
        reject(new Error('Request timeout after 25s'));
      });

      req.write(payload);
      req.end();
    });
  }

  try {
    const { status, body } = await callApi();

    if (status !== 200) {
      console.error('SambaNova error:', status, body.slice(0, 300));
      res.status(502).json({ error: 'SambaNova returned ' + status, detail: body.slice(0, 300) });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (e) {
      res.status(502).json({ error: 'Invalid JSON from SambaNova', detail: body.slice(0, 200) });
      return;
    }

    let reply = '';
    if (parsed.choices && parsed.choices[0] && parsed.choices[0].message) {
      reply = parsed.choices[0].message.content || '';
    }

    // Strip <think> tags (DeepSeek models)
    reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    if (!reply) {
      res.status(502).json({ error: 'Empty reply from model' });
      return;
    }

    res.status(200).json({ reply: reply });

  } catch (err) {
    console.error('Handler error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
