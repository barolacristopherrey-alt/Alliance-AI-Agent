// Vercel serverless function (Node.js runtime).
// Replaces window.cowork.askClaude(prompt, data), which only exists inside a live Cowork
// session. The frontend's cowork-bridge shim (see public/index.html) posts { prompt, data }
// here; this function reconstructs the same "Input N" convention every PROMPTS.* string in
// the portal already relies on, calls the real Anthropic API with a server-side key, and
// returns { text } in the same shape askClaudeSafe() expects back from window.cowork.askClaude.
//
// Required environment variable (set in Vercel Project Settings -> Environment Variables):
//   ANTHROPIC_API_KEY   — a real API key from https://console.anthropic.com (Claude Platform).
//                          NOT the same as a claude.ai Pro/Max subscription — this is billed
//                          separately, per token, through the API console.
// Optional:
//   ANTHROPIC_MODEL     — defaults to claude-sonnet-5 if not set.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('generate.js: ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'Server is not configured with an Anthropic API key.' });
  }

  const { prompt, data } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing "prompt" string in request body.' });
  }

  // Every PROMPTS.* string in the portal is written to reference "Input 1", "Input 2", etc.
  // positionally against the `data` array — this mirrors that exactly so the model sees the
  // same shape of message it would have inside Cowork.
  const inputsBlock = Array.isArray(data) && data.length
    ? '\n\n' + data.map((d, i) => 'Input ' + (i + 1) + ':\n' + (typeof d === 'string' ? d : JSON.stringify(d))).join('\n\n')
    : '';

  const userMessage = prompt + inputsBlock;

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
        max_tokens: 8000,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('Anthropic API error:', anthropicRes.status, errText);
      return res.status(502).json({ error: 'The Claude API request failed (status ' + anthropicRes.status + ').' });
    }

    const json = await anthropicRes.json();
    const text = (json.content || []).map((block) => block.text || '').join('');
    return res.status(200).json({ text });
  } catch (err) {
    console.error('generate.js: unexpected error', err);
    return res.status(500).json({ error: 'Unexpected server error.' });
  }
}
