const https = require('https');

function readBody(req) {
  return new Promise(function(resolve, reject) {
    if (req.body && typeof req.body === 'object') {
      resolve(req.body); return;
    }
    var chunks = [];
    req.on('data', function(c) { chunks.push(c); });
    req.on('end', function() {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch(e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

function callSambaNova(messages, model) {
  var SYSTEM = 'Você é J.A.R.V.I.S., assistente de Tony Stark. Responda SEMPRE em português do Brasil. Seja direto. Máximo 2 frases curtas.';
  var payload = JSON.stringify({
    model: model,
    max_tokens: 200,
    temperature: 0.7,
    stream: false,
    messages: [{ role: 'system', content: SYSTEM }].concat(messages.slice(-8))
  });

  return new Promise(function(resolve, reject) {
    var r = https.request({
      hostname: 'api.sambanova.ai', port: 443,
      path: '/v1/chat/completions', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 4a4d67f6-416d-4ae3-b7f1-41c947f3afe9',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() { resolve({ status: res.statusCode, body: d }); });
    });
    r.on('error', reject);
    r.setTimeout(25000, function() { r.destroy(); reject(new Error('Timeout 25s')); });
    r.write(payload); r.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  var body = await readBody(req).catch(function() { return {}; });
  var messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) { res.status(400).json({ error: 'No messages' }); return; }

  var models = [
    'Meta-Llama-3.3-70B-Instruct',
    'Meta-Llama-3.1-8B-Instruct',
    'Qwen2.5-72B-Instruct'
  ];

  var lastErr = '';
  for (var i = 0; i < models.length; i++) {
    try {
      var result = await callSambaNova(messages, models[i]);
      if (result.status !== 200) {
        lastErr = 'Model ' + models[i] + ' HTTP ' + result.status + ': ' + result.body.slice(0,100);
        continue;
      }
      var json = JSON.parse(result.body);
      var reply = ((json.choices || [])[0] || {}).message;
      reply = (reply && reply.content || '').replace(/<think>[\s\S]*?<\/think>/gi,'').trim();
      if (!reply) { lastErr = 'Empty reply from ' + models[i]; continue; }
      res.status(200).json({ reply: reply, model: models[i] });
      return;
    } catch(e) {
      lastErr = models[i] + ': ' + e.message;
    }
  }

  res.status(502).json({ error: lastErr });
};
