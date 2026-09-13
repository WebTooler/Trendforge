import { articles } from '@/lib/articles';

const siteUrl = 'https://webtooler.github.io/Trendforge';

export const dynamic = 'force-static';

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function GET() {
  const items = articles.map((article) => `
    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${siteUrl}/article/${article.slug}/</link>
      <guid>${siteUrl}/article/${article.slug}/</guid>
      <pubDate>${new Date(article.date).toUTCString()}</pubDate>
      <description>${escapeXml(article.description)}</description>
      <category>${escapeXml(article.category)}</category>
    </item>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>TrendForge — What Matters, Explained</title>
    <link>${siteUrl}/</link>
    <description>Smart, useful stories about AI, technology, digital life and how-to guides.</description>
    <language>en</language>${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
