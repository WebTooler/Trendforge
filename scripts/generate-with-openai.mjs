import fs from 'node:fs';

const input = 'data/article-brief.json';
if (!fs.existsSync(input)) {
  console.log(`No ${input} found; skipping AI generation.`);
  process.exit(0);
}

const { brief, prompt } = JSON.parse(fs.readFileSync(input, 'utf8'));
const openaiKey = process.env.OPENAI_API_KEY;
const groqKey = process.env.GROQ_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;
const openaiModel = process.env.OPENAI_MODEL || 'gpt-5.6-luna';

async function save(text, provider, model) {
  if (!text?.trim()) throw new Error(`${provider} returned no article text.`);
  fs.writeFileSync('data/generated-article.json', JSON.stringify({
    generatedAt: new Date().toISOString(), provider, model, brief, text,
  }, null, 2));
  console.log(`Generated article draft with ${provider} (${model}).`);
}

async function tryOpenAI() {
  if (!openaiKey) return false;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: openaiModel, input: prompt }),
  });
  if (!response.ok) {
    const body = await response.text();
    console.log(`OpenAI unavailable (${response.status}); trying fallback provider.`);
    if (response.status !== 429 && response.status < 500) console.log(body.slice(0, 300));
    return false;
  }
  const data = await response.json();
  await save(data.output_text || '', 'OpenAI', openaiModel);
  return true;
}

async function tryGroq() {
  if (!groqKey) return false;
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_completion_tokens: 5000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!response.ok) return false;
  const data = await response.json();
  await save(data.choices?.[0]?.message?.content || '', 'Groq', model);
  return true;
}

async function tryGemini() {
  if (!geminiKey) return false;
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': geminiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!response.ok) return false;
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  await save(text, 'Gemini', model);
  return true;
}

if (await tryOpenAI()) process.exit(0);
if (await tryGroq()) process.exit(0);
if (await tryGemini()) process.exit(0);
throw new Error('No configured AI provider could generate the article draft.');
