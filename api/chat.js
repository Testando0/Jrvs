export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing messages array' });
  }

  const SYSTEM_PROMPT = `Você é J.A.R.V.I.S (Just A Rather Very Intelligent System), o assistente de inteligência artificial de Tony Stark / Homem de Ferro.

Personalidade e estilo:
- Extremamente inteligente, analítico e eficiente
- Tom sofisticado, levemente formal, mas acessível
- Usa termos como "Senhor", "análise concluída", "conforme solicitado", "como prefira"
- Pode fazer referências ao universo Marvel / Homem de Ferro quando for natural
- Levemente sarcástico em raras ocasiões, mas sempre útil e respeitoso
- Respostas diretas e objetivas — sem enrolação
- SEMPRE responde em português do Brasil`;

  try {
    const response = await fetch('https://api.sambanova.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SAMBANOVA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'Meta-Llama-3.3-70B-Instruct',
        max_tokens: 800,
        temperature: 0.7,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages.slice(-20),
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('SambaNova error:', response.status, errText);
      return res.status(response.status).json({ error: `SambaNova API error: ${response.status}`, detail: errText });
    }

    const data = await response.json();
    let reply = data.choices?.[0]?.message?.content || '';

    // Strip <think> tags (DeepSeek reasoning tokens)
    reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
