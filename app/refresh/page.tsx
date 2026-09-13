import type { Metadata } from 'next';
import { articles } from '@/lib/articles';
import { getRefreshQueue } from '@/lib/article-refresh';

export const metadata: Metadata = {
  title: 'Article Refresh Queue',
  description: 'Automated freshness checks for TrendForge articles.',
  robots: { index: false, follow: false },
};

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1100, margin: '0 auto', padding: '60px 5vw 90px', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif', color: '#171717' },
  header: { maxWidth: 850, paddingBottom: 30 },
  back: { color: '#e85d2a', fontWeight: 800, textDecoration: 'none' },
  eyebrow: { marginTop: 28, fontSize: 11, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', color: '#e85d2a' },
  h1: { fontSize: 'clamp(46px, 7vw, 82px)', lineHeight: .94, letterSpacing: -4, margin: '14px 0 20px' },
  lead: { fontSize: 19, lineHeight: 1.65, color: '#5d5d5d' },
  card: { background: '#fff', border: '1px solid #deded8', borderRadius: 24, padding: 28, marginTop: 18, boxShadow: '0 8px 30px rgba(0,0,0,.035)' },
  head: { display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start' },
  title: { fontSize: 27, lineHeight: 1.15, margin: '8px 0' },
  badge: { borderRadius: 999, padding: '8px 13px', fontWeight: 900, fontSize: 12, whiteSpace: 'nowrap' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 20 },
  metric: { padding: 16, background: '#f5f5f0', borderRadius: 16 },
  small: { display: 'block', fontSize: 11, color: '#777', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 800 },
  value: { display: 'block', marginTop: 6, fontSize: 24, fontWeight: 900 },
  section: { marginTop: 22 },
  list: { margin: '8px 0 0', paddingLeft: 20, color: '#5d5d5d', lineHeight: 1.7 },
};

function badgeStyle(level: string): React.CSSProperties {
  if (level === 'refresh') return { ...styles.badge, background: '#ffe5dd', color: '#a43b18' };
  if (level === 'watch') return { ...styles.badge, background: '#eee8df', color: '#76512f' };
  return { ...styles.badge, background: '#e8f2e8', color: '#2d6635' };
}

export default function RefreshPage() {
  const queue = getRefreshQueue(articles);
  return <main style={styles.page}>
    <header style={styles.header}>
      <a style={styles.back} href="/Trendforge/">← TrendForge</a>
      <div style={styles.eyebrow}>Owner tool · automated freshness</div>
      <h1 style={styles.h1}>Article refresh <span style={{ color: '#e85d2a' }}>queue.</span></h1>
      <p style={styles.lead}>Every published article is checked against the same freshness rules. The system recommends when to review an article; it never overwrites published copy automatically.</p>
    </header>
    {queue.map(({ article, report }) => <section style={styles.card} key={article.slug}>
      <div style={styles.head}><div><div style={styles.eyebrow}>{article.category}</div><h2 style={styles.title}>{article.title}</h2></div><span style={badgeStyle(report.level)}>{report.level.toUpperCase()}</span></div>
      <div style={styles.grid}><div style={styles.metric}><span style={styles.small}>Age</span><strong style={styles.value}>{report.ageDays} days</strong></div><div style={styles.metric}><span style={styles.small}>Freshness score</span><strong style={styles.value}>{report.score}/100</strong></div><div style={styles.metric}><span style={styles.small}>Sources</span><strong style={styles.value}>{article.sources.length}</strong></div></div>
      <div style={styles.section}><strong>Why</strong><ul style={styles.list}>{report.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>
      <div style={styles.section}><strong>Recommended action</strong><ul style={styles.list}>{report.actions.map((action) => <li key={action}>{action}</li>)}</ul></div>
    </section>)}
  </main>;
}
