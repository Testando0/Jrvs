const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  // Vercel auto-parses JSON body when Content-Type: application/json
  const body = req.body || {};
  const messages = Array.isArray(body.messages) ? body.messages : [];

  if (messages.length === 0) {
    res.status(400).json({ error: 'No messages provided' });
    return;
  }

  const API_KEY = '4a4d67f6-416d-4ae3-b7f1-41c947f3afe9';

  const SYSTEM = 'Você é J.A.R.V.I.S., assistente de IA de Tony Stark. Responda SEMPRE em português do Brasil. Seja inteligente e direto. Máximo 2 frases curtas.';

  const payload = JSON.stringify({
    model: 'Meta-Llama-3.3-70B-Instruct',
    max_tokens: 200,
    temperature: 0.7,
    stream: false,
    messages: [
      { role: 'system', content: SYSTEM },
      ...messages.slice(-8)
    ]
  });

  try {
    const result = await new Promise((resolve, reject) => {
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

      const req = https.request(options, (r) => {
        let data = '';
        r.on('data', c => { data += c; });
        r.on('end', () => resolve({ status: r.statusCode, body: data }));
      });

      req.on('error', reject);
      req.setTimeout(28000, () => { req.destroy(); reject(new Error('Timeout 28s')); });
      req.write(payload);
      req.end();
    });

    if (result.status !== 200) {
      console.error('SambaNova HTTP', result.status, result.body.slice(0, 200));
      res.status(502).json({ error: 'SambaNova error ' + result.status, detail: result.body.slice(0, 200) });
      return;
    }

    const json = JSON.parse(result.body);
    let reply = (json.choices?.[0]?.message?.content || '').trim();
    reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    if (!reply) {
      res.status(502).json({ error: 'Empty reply', raw: result.body.slice(0, 200) });
      return;
    }

    res.status(200).json({ reply });

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
