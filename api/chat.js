const https = require('https');

const API_KEY = '4a4d67f6-416d-4ae3-b7f1-41c947f3afe9';
const SYSTEM = 'Voce e J.A.R.V.I.S., assistente de Tony Stark. Responda SEMPRE em portugues do Brasil. Maximo 2 frases diretas.';

function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }
  return new Promise(function(resolve) {
    var chunks = [];
    req.on('data', function(c) { chunks.push(c); });
    req.on('end', function() {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch(e) { resolve({}); }
    });
    req.on('error', function() { resolve({}); });
  });
}

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'use POST' }); return; }

  var body = await readBody(req);
  var messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) { res.status(400).json({ error: 'messages[] vazio' }); return; }

  var payload = Buffer.from(JSON.stringify({
    model: 'Meta-Llama-3.3-70B-Instruct',
    max_tokens: 250,
    temperature: 0.7,
    stream: false,
    messages: [{ role: 'system', content: SYSTEM }].concat(messages.slice(-8))
  }));

  try {
    var result = await new Promise(function(resolve, reject) {
      var r = https.request({
        hostname: 'api.sambanova.ai',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + API_KEY,
          'Content-Length': payload.length
        }
      }, function(apiRes) {
        var d = '';
        apiRes.on('data', function(c) { d += c; });
        apiRes.on('end', function() { resolve({ status: apiRes.statusCode, body: d }); });
      });
      r.on('error', reject);
      r.setTimeout(25000, function() { r.destroy(); reject(new Error('timeout 25s')); });
      r.write(payload);
      r.end();
    });

    if (result.status !== 200) {
      res.status(502).json({ error: 'SambaNova HTTP ' + result.status, detail: result.body.slice(0, 400) });
      return;
    }

    var json = JSON.parse(result.body);
    var reply = ((json.choices || [])[0] || {}).message;
    reply = ((reply || {}).content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    if (!reply) { res.status(502).json({ error: 'reply vazio', raw: result.body.slice(0, 200) }); return; }
    res.status(200).json({ reply: reply });

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};
