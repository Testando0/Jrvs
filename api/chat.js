const https = require('https');

const APIKEY = '4a4d67f6-416d-4ae3-b7f1-41c947f3afe9';
const SYSTEM  = 'Você é J.A.R.V.I.S., assistente de Tony Stark. Responda SEMPRE em português do Brasil. Seja direto e inteligente. Máximo 2 frases curtas.';

function readBody(req) {
  // Se Vercel já parseou o body, usa direto
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }
  // Senão, lê o stream manualmente
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function callAPI(messages) {
  const payload = JSON.stringify({
    model: 'Meta-Llama-3.3-70B-Instruct',
    max_tokens: 300,
    temperature: 0.7,
    stream: false,
    messages: [{ role: 'system', content: SYSTEM }, ...messages.slice(-10)]
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.sambanova.ai',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + APIKEY,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(25000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'only POST' }); return; }

  const body = await readBody(req);
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (!messages.length) { res.status(400).json({ error: 'messages vazio' }); return; }

  try {
    const { status, body: raw } = await callAPI(messages);
    if (status !== 200) {
      res.status(502).json({ error: `SambaNova ${status}`, detail: raw.slice(0, 200) });
      return;
    }
    const json = JSON.parse(raw);
    let reply = json?.choices?.[0]?.message?.content ?? '';
    reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    if (!reply) { res.status(502).json({ error: 'resposta vazia', raw: raw.slice(0, 200) }); return; }
    res.status(200).json({ reply });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
