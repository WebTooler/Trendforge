import fs from 'node:fs';

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
const input = 'data/article-brief.json';

if (!apiKey) {
  console.log('OPENAI_API_KEY is not configured; skipping AI generation.');
  process.exit(0);
}
if (!fs.existsSync(input)) {
  console.log(`No ${input} found; skipping AI generation.`);
  process.exit(0);
}

const { brief, prompt } = JSON.parse(fs.readFileSync(input, 'utf8'));
const response = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model,
    input: prompt,
  }),
});

if (!response.ok) throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`);
const data = await response.json();
const text = data.output_text || '';
if (!text.trim()) throw new Error('OpenAI returned no article text.');

fs.writeFileSync('data/generated-article.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  model,
  brief,
  text,
}, null, 2));
console.log(`Generated article draft with ${model}.`);
