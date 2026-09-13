import type { Metadata } from 'next';
import { articles } from '@/lib/articles';
import { optimizeArticle } from '@/lib/content-optimizer';

export const metadata: Metadata = {
  title: 'Content Optimization Engine',
  description: 'Automated content quality and SEO opportunity analysis for TrendForge articles.',
  robots: { index: false, follow: false },
};

const styles = `
.optimizer-page{max-width:1180px;margin:auto;padding:60px 5vw 100px;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#171717;background:#f5f5f0;min-height:100vh}.optimizer-page *{box-sizing:border-box}.optimizer-header{max-width:850px;margin-bottom:40px}.optimizer-header a{color:#e85d2a;font-weight:900;text-decoration:none}.optimizer-header .eyebrow{margin-top:28px;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;color:#e85d2a}.optimizer-header h1{font-size:clamp(44px,7vw,80px);line-height:.94;letter-spacing:-4px;margin:14px 0 22px}.optimizer-header h1 span{color:#e85d2a}.optimizer-header>p{font-size:19px;line-height:1.65;color:#5d5d5d}.optimizer-card{background:#fff;border:1px solid #deded8;border-radius:26px;padding:30px;margin:0 0 24px;box-shadow:0 8px 30px rgba(0,0,0,.035)}.optimizer-card-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.optimizer-card-head h2{font-size:clamp(25px,4vw,40px);line-height:1.05;letter-spacing:-1.5px;margin:9px 0 24px}.tag{font-size:10px;font-weight:900;letter-spacing:1.7px;text-transform:uppercase;color:#e85d2a}.optimizer-badge{display:grid;place-items:center;min-width:76px;height:76px;border-radius:50%;background:#171717;color:#fff;font-weight:950}.optimizer-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}.optimizer-metrics div{padding:18px;border:1px solid #e1e1db;border-radius:16px;background:#f8f8f4}.optimizer-metrics strong{display:block;font-size:26px}.optimizer-metrics span{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#777}.optimizer-meta{padding:20px;border-radius:18px;background:#eee8df;margin-bottom:24px}.optimizer-meta h3,.optimizer-list h3{margin:0 0 13px;font-size:20px}.optimizer-meta p{margin:8px 0;line-height:1.55;color:#555}.optimizer-item{border-top:1px solid #e2e2dc;padding:16px 3px}.optimizer-item>div{display:flex;justify-content:space-between;gap:12px}.optimizer-item>div span{font-size:9px;font-weight:950;text-transform:uppercase;letter-spacing:1px}.optimizer-item p{margin:7px 0;color:#555;line-height:1.5}.optimizer-item small{display:block;color:#777;line-height:1.5}.optimizer-item.high>div span{color:#b33a20}.optimizer-item.medium>div span{color:#9a641b}.optimizer-item.good>div span{color:#37734d}@media(max-width:760px){.optimizer-page{padding-top:45px}.optimizer-header h1{letter-spacing:-2.5px}.optimizer-card{padding:22px}.optimizer-card-head{display:block}.optimizer-badge{margin-bottom:20px}.optimizer-metrics{grid-template-columns:1fr}.optimizer-header>p{font-size:17px}}
`;

export default function OptimizePage() {
  const reports = articles.map((article) => ({ article, report: optimizeArticle(article) }));
  return <><style dangerouslySetInnerHTML={{ __html: styles }} /><main className="optimizer-page">
    <header className="optimizer-header">
      <a href="/Trendforge/">← TrendForge</a>
      <div className="eyebrow">Owner tool · automated analysis</div>
      <h1>Content optimization <span>engine.</span></h1>
      <p>Review every published article against the same measurable rules. The engine flags title, description, depth, structure, evidence and topic-coverage opportunities without changing article copy automatically.</p>
    </header>
    {reports.map(({ article, report }) => <section className="optimizer-card" key={article.slug}>
      <div className="optimizer-card-head"><div><div className="tag">{article.category}</div><h2>{article.title}</h2></div><div className="optimizer-badge">{report.score}/100</div></div>
      <div className="optimizer-metrics"><div><strong>{report.wordCount}</strong><span>Words</span></div><div><strong>{report.headingCount}</strong><span>H2 sections</span></div><div><strong>{report.sourceCount}</strong><span>HTTPS sources</span></div></div>
      <div className="optimizer-meta"><h3>SEO output</h3><p><b>Title:</b> {report.seoTitle}</p><p><b>Description:</b> {report.seoDescription}</p></div>
      <div className="optimizer-list"><h3>Recommendations</h3>{report.items.map((item, index) => <article className={`optimizer-item ${item.level}`} key={`${item.area}-${index}`}><div><b>{item.area}</b><span>{item.level}</span></div><p>{item.finding}</p><small>Action: {item.action}</small></article>)}</div>
    </section>)}
  </main></>;
}
