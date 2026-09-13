import type { Metadata } from 'next';
import { articles } from '@/lib/articles';
import { optimizeArticle } from '@/lib/content-optimizer';

export const metadata: Metadata = {
  title: 'Content Optimization Engine',
  description: 'Automated content quality and SEO opportunity analysis for TrendForge articles.',
  robots: { index: false, follow: false },
};

export default function OptimizePage() {
  const reports = articles.map((article) => ({ article, report: optimizeArticle(article) }));
  return <main className="optimizer-page">
    <header className="optimizer-header">
      <a className="legal-back" href="/Trendforge/">← TrendForge</a>
      <div className="eyebrow">Owner tool · automated analysis</div>
      <h1>Content optimization <span>engine.</span></h1>
      <p>Review every published article against the same measurable rules. The engine flags title, description, depth, structure, evidence and topic-coverage opportunities without changing article copy automatically.</p>
    </header>
    {reports.map(({ article, report }) => <section className="optimizer-card" key={article.slug}>
      <div className="optimizer-card-head"><div><div className="tag">{article.category}</div><h2>{article.title}</h2></div><div className="optimizer-badge">{report.score}/100</div></div>
      <div className="optimizer-metrics"><div><strong>{report.wordCount}</strong><span>Words</span></div><div><strong>{report.headingCount}</strong><span>H2 sections</span></div><div><strong>{report.sourceCount}</strong><span>HTTPS sources</span></div></div>
      <div className="optimizer-meta"><h3>SEO output</h3><p><b>Title:</b> {report.seoTitle}</p><p><b>Description:</b> {report.seoDescription}</p></div>
      <div className="optimizer-list"><h3>Recommendations</h3>{report.items.map((item, index) => <article className={`optimizer-item ${item.level}`} key={`${item.area}-${index}`}><div><b>{item.area}</b><span>{item.level}</span></div><p>{item.finding}</p><small>{item.action}</small></article>)}</div>
    </section>)}
  </main>;
}
