/* ==========================================================================
   Gen 3 Academy — Socratic AI Proxy (Cloudflare Worker)
   --------------------------------------------------------------------------
   PURPOSE: keeps the Google Gemini API key SECRET. The website never sees it.
   The browser calls this Worker; the Worker adds the key and calls Google.

   SETUP (about 10 minutes, all free):
     1. Create a free account at https://dash.cloudflare.com
     2. Compute (Workers) -> Create -> "Hello World" -> Deploy
     3. Click "Edit code", delete everything, paste THIS file, Deploy
     4. Go to Settings -> Variables and Secrets -> Add:
          Type:  Secret   (IMPORTANT: Secret, not plain text)
          Name:  GEMINI_API_KEY
          Value: <your key from aistudio.google.com>
        Optionally add a plain variable  MODEL  (default: gemini-2.5-flash)
     5. Copy your Worker URL (like https://xxxx.workers.dev) and send ONLY
        that URL to Claude. The URL is safe to share; the key never leaves here.

   NOTE: never put the key in this file or in the GitHub repo.
   ========================================================================== */

// Only these sites may use this Worker (stops strangers burning your free quota)
const ALLOWED_ORIGINS = [
  'https://wassimdragon.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
];

// The Socratic rules. This is the heart of the pedagogy — edit with care.
const SYSTEM_RULES = `
You are the Generation 3 Academy Socratic Teacher for Muslim students (grades 6-12).

YOUR METHOD — guide, never tell:
- NEVER give the student the answer, and never confirm a final answer outright.
- Reply with ONE guiding question at a time, plus a short hint if they are stuck.
- Build on what the student already said. Make them reason it out themselves.
- When the student reaches the idea themselves, affirm it warmly and deepen it
  with a follow-up question.
- Keep replies SHORT (2-4 sentences). You are a patient teacher, not a lecture.

HARD RULES — never break these:
- NEVER invent, paraphrase, or "recall" a Qur'anic verse or hadith. Only refer to
  text that appears in the LESSON MATERIAL provided below.
- NEVER issue a religious ruling (fatwa). If asked, say it is a question for a
  qualified scholar or their teacher.
- Stay strictly within the lesson topic. If asked something unrelated, kindly
  bring the student back to the lesson.
- If you are unsure, say so plainly and point them to their teacher.
- Tone: warm, calm, respectful. Suitable for a child. No music references.
`.trim();

function cors(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

// Remembers the model between requests so we only look it up once.
let cachedModel = null;

// Ask Google which models this key can actually use, and pick the best "flash".
// This means we never have to hard-code a model name that Google might retire.
async function resolveModel(env) {
  if (env.MODEL) return env.MODEL;              // manual override wins
  if (cachedModel) return cachedModel;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`);
    if (!r.ok) return 'gemini-flash-latest';
    const d = await r.json();
    const usable = (d.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => m.name.replace('models/', ''))
      // skip specialised variants we don't want for chat
      .filter(n => !/(image|tts|audio|live|embedding|vision|thinking)/i.test(n));

    const flash = usable.filter(n => /flash/i.test(n));
    cachedModel =
      flash.find(n => n === 'gemini-flash-latest') ||
      flash.filter(n => /^gemini-[\d.]+-flash$/.test(n)).sort().reverse()[0] ||
      flash.sort().reverse()[0] ||
      usable[0] ||
      'gemini-flash-latest';
    return cachedModel;
  } catch {
    return 'gemini-flash-latest';
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const h = cors(origin);
    const reqUrl = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { headers: h });

    // Debug helper: GET ?list=models  -> shows which models your key supports.
    if (request.method === 'GET' && reqUrl.searchParams.get('list') === 'models') {
      if (!env.GEMINI_API_KEY) return json({ error: 'Server not configured' }, 500, h);
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${env.GEMINI_API_KEY}`);
      const d = await r.json();
      const names = (d.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name);
      return json({ chosen: await resolveModel(env), available: names }, 200, h);
    }

    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, h);
    if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: 'Origin not allowed' }, 403, h);
    if (!env.GEMINI_API_KEY) return json({ error: 'Server not configured' }, 500, h);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400, h); }

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const lesson  = typeof body.lesson === 'string' ? body.lesson.slice(0, 20000) : '';
    const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
    const mode    = ['summary', 'checkpoint'].includes(body.mode) ? body.mode : 'chat';
    // checkpoint mode: the understanding the student must reach in their OWN words
    const goal    = typeof body.goal === 'string' ? body.goal.slice(0, 1500) : '';
    const turns   = Number.isFinite(body.turns) ? Math.max(0, Math.min(20, body.turns)) : 0;

    if (!message && mode !== 'summary') return json({ error: 'Missing message' }, 400, h);
    if (message.length > 2000) return json({ error: 'Message too long' }, 400, h);

    // CHECKPOINT mode: the student must reach a specific understanding by discussion.
    // The model returns JSON so the game knows when to award the reward.
    const checkpointTask = `CHECKPOINT DISCUSSION.

The student must demonstrate THIS understanding, in their own words:
"${goal}"

How to run it:
- Discuss with them. Ask ONE guiding question at a time. Keep replies 2-4 sentences.
- NEVER state the target understanding yourself, and never reveal it to "check" if they agree.
- Build on their words. If they are close, ask them to explain WHY before you judge.

Setting "mastered":
- true  ONLY when the student has expressed the core idea THEMSELVES with some reasoning.
- false for a lucky one-word guess, for simply repeating your own words back, or for
  a vague answer with no reasoning behind it.
- When you set true, your reply should warmly affirm what THEY worked out.

They have already exchanged ${turns} messages on this checkpoint.
${turns >= 6 ? 'They have struggled a while: you may now gently explain it, and set "mastered" to false.' : ''}

STUDENT: ${message}`;

    // In summary mode we ask for the "what you discovered" report instead.
    const task = mode === 'checkpoint' ? checkpointTask : mode === 'summary'
      ? `The conversation is finished. Write a short report FOR THE STUDENT titled "What You Discovered".
Use simple, warm language and this exact structure:
1. **What you worked out** - 2-4 bullets of the ideas THEY reached.
2. **The evidence you used** - only evidence that appears in the LESSON MATERIAL.
3. **Worth thinking about next** - 1-2 gentle next questions.
Do not introduce new facts that are not in the lesson material or the conversation.`
      : `STUDENT: ${message}`;

    const contents = [
      ...history.map(t => ({
        role: t.role === 'ai' ? 'model' : 'user',
        parts: [{ text: String(t.text || '').slice(0, 2000) }],
      })),
      { role: 'user', parts: [{ text: `LESSON MATERIAL (your ONLY permitted source):\n${lesson}\n\n${task}` }] },
    ];

    const model = await resolveModel(env);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_RULES }] },
          contents,
          // Chat replies stay short on purpose (a teacher, not a lecture).
          // The end-of-session report needs more room so it isn't cut off.
          // Checkpoint mode returns JSON so the game can award the reward.
          generationConfig: {
            temperature: 0.7,
            // Chat stays short; summary and checkpoint (JSON) need headroom so
            // the response is never cut off mid-structure.
            maxOutputTokens: mode === 'chat' ? 800 : 2048,
            ...(mode === 'checkpoint' ? {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  reply:    { type: 'STRING'  },
                  mastered: { type: 'BOOLEAN' },
                },
                required: ['reply', 'mastered'],
              },
            } : {}),
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          ],
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        return json({ error: 'Upstream error', status: res.status, detail: detail.slice(0, 300) }, 502, h);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return json({ error: 'No reply produced' }, 502, h);

      // Checkpoint mode returns JSON: { reply, mastered }
      if (mode === 'checkpoint') {
        try {
          const parsed = JSON.parse(text);
          return json({
            reply: String(parsed.reply || '').trim(),
            mastered: parsed.mastered === true,
          }, 200, h);
        } catch {
          // Malformed/truncated JSON. Salvage the teacher's words if we can, and
          // NEVER show raw JSON to the student. Fail safe: never auto-award.
          let salvaged = '';
          const m = text.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          if (m) { try { salvaged = JSON.parse('"' + m[1] + '"'); } catch { salvaged = m[1]; } }
          return json({
            reply: salvaged || 'Let us think about this together — can you explain your reasoning a little more?',
            mastered: false,
          }, 200, h);
        }
      }

      return json({ reply: text }, 200, h);

    } catch (e) {
      return json({ error: 'Request failed', detail: String(e).slice(0, 200) }, 500, h);
    }
  },
};
