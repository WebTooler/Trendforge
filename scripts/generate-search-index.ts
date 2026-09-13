import { mkdir, writeFile } from 'node:fs/promises';
import { articles } from '../lib/articles';

const index = articles.map((article) => ({
  slug: article.slug,
  title: article.title,
  description: article.description,
  category: article.category,
  date: article.date,
  readTime: article.readTime,
  content: article.content.join(' '),
}));

await mkdir('public', { recursive: true });
await writeFile('public/search-index.json', JSON.stringify(index));
console.log(`Search index generated: ${index.length} articles`);
