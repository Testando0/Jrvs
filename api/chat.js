export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request: messages array required' });
  }

  const SYSTEM = `Você é J.A.R.V.I.S (Just A Rather Very Intelligent System), assistente de IA de Tony Stark.
Personalidade: inteligente, sofisticado, levemente formal. Use "Senhor" ocasionalmente.
Responda SEMPRE em português do Brasil. Respostas diretas e úteis, máximo 3 parágrafos.`;

  const apiKey = process.env.SAMBANOVA_API_KEY || '4a4d67f6-416d-4ae3-b7f1-41c947f3afe9';

  // Try models in order until one works
  const models = [
    'Meta-Llama-3.3-70B-Instruct',
    'Llama-3.2-3B-Instruct',
    'Meta-Llama-3.1-8B-Instruct',
  ];

  let lastError = null;

  for (const model of models) {
    try {
      const response = await fetch('https://api.sambanova.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: 600,
          temperature: 0.7,
          stream: false,
          messages: [
            { role: 'system', content: SYSTEM },
            ...messages.slice(-16),
          ],
        }),
        signal: AbortSignal.timeout(25000),
      });

      const text = await response.text();

      if (!response.ok) {
        lastError = `${model}: HTTP ${response.status} — ${text.slice(0, 200)}`;
        console.error('Model failed:', lastError);
        continue;
      }

      const data = JSON.parse(text);
      let reply = data?.choices?.[0]?.message?.content || '';
      reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      if (!reply) {
        lastError = `${model}: empty reply`;
        continue;
      }

      return res.status(200).json({ reply, model });

    } catch (err) {
      lastError = `${model}: ${err.message}`;
      console.error('Fetch error:', lastError);
      continue;
    }
  }

  return res.status(502).json({
    error: 'All models failed',
    detail: lastError,
  });
}
