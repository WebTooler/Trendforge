import fs from 'node:fs';
import path from 'node:path';

const dir = 'content/articles';
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort() : [];

type Article = {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
  readTime: string;
  content: string[];
  sources: { title: string; url: string }[];
};

function field(text: string, key: string) {
  const match = text.match(new RegExp(`^${key}:\\s*"([\\s\\S]*?)"\\s*$`, 'm'));
  return match ? match[1].replace(/\\"/g, '"') : '';
}

function estimateReadTime(text: string) {
  return `${Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length / 220))} min read`;
}

const articles: Article[] = [];
for (const file of files) {
  const raw = fs.readFileSync(path.join(dir, file), 'utf8');
  const parts = raw.split(/^---$/m);
  if (parts.length < 3) continue;

  const front = parts[1];
  const body = parts.slice(2).join('---').trim();
  const sourceMarker = /^## Sources$/m;
  const main = body.split(sourceMarker)[0].trim();
  const sourceText = body.split(sourceMarker)[1] ?? '';

  const content = main.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const sources = [...sourceText.matchAll(/^- \[(.*?)\]\((https:\/\/[^)]+)\)$/gm)]
    .map((m) => ({ title: m[1], url: m[2] }));

  const slug = field(front, 'slug') || file.replace(/\.md$/, '');
  const title = field(front, 'title');
  const description = field(front, 'description');
  const category = field(front, 'category') || 'Technology';
  const date = field(front, 'publishedAt').slice(0, 10) || new Date().toISOString().slice(0, 10);

  if (!title || !description || content.length === 0) continue;
  articles.push({ slug, title, description, category, date, readTime: estimateReadTime(main), content, sources });
}

const safe = JSON.stringify(articles, null, 2);
const output = `export type Article = { slug: string; title: string; description: string; category: string; date: string; readTime: string; content: string[]; sources: { title: string; url: string }[] };\n\nexport const articles: Article[] = ${safe};\n\nexport function getArticle(slug: string) { return articles.find((a) => a.slug === slug); }\n`;

fs.writeFileSync('lib/articles.ts', output);
console.log(`Synced ${articles.length} published articles into lib/articles.ts.`);
