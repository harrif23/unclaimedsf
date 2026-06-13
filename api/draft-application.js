// Vercel serverless function: drafts a pre-filled application for a matched program.
// This is the ONE place AI runs at runtime — it DRAFTS the form only; it never decides
// eligibility (that stays deterministic). ANTHROPIC_API_KEY is a server-side Vercel env
// var, never shipped to the browser. Only the fields needed for the draft are sent.
const MODEL = process.env.DRAFT_MODEL || 'claude-sonnet-4-6';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: 'Drafting is not configured yet (ANTHROPIC_API_KEY is not set).' });

  const { programName, benefitText = '', ruleText = [], answers = {} } = req.body || {};
  if (!programName) return res.status(400).json({ error: 'programName is required' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        messages: [{ role: 'user', content: buildPrompt({ programName, benefitText, ruleText, answers }) }],
      }),
    });
    if (!r.ok) return res.status(502).json({ error: `Anthropic API error (${r.status})`, detail: (await r.text()).slice(0, 300) });
    const data = await r.json();
    const draft = (data.content || []).map((b) => b.text || '').join('').trim();
    return res.status(200).json({ draft });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}

function buildPrompt({ programName, benefitText, ruleText, answers }) {
  const known = Object.entries(answers)
    .filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join('\n');
  return [
    `You help a San Francisco resident START their application for "${programName}" (${benefitText}).`,
    `Write a short, friendly, ready-to-submit application summary they can paste or hand to a caseworker.`,
    ``,
    `Rules:`,
    `- Use ONLY the facts below. Do NOT invent income, names, addresses, SSNs, or any detail not given.`,
    `- For required identity fields we don't have, insert a clearly marked blank like [Your full name], [Home address], [Phone].`,
    `- Do NOT assess or re-decide eligibility — they already qualify. Just organize their information.`,
    `- Plain language, about 150-220 words. End with a one-line "Next step:" telling them where to submit.`,
    ``,
    `Why they qualify: ${ruleText.join(' ') || '(qualifying rule on file)'}`,
    `What they told us:`,
    known || '- (no attributes provided)',
  ].join('\n');
}
