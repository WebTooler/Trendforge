import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-static';

function readJson(name: string): any {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', name), 'utf8')); }
  catch { return null; }
}

const memory = readJson('trendforge-memory.json');
const supervisor = readJson('trendforge-supervisor.json');
const audit = readJson('trendforge-audit-trail.json');
const performance = readJson('trendforge-performance.json');
const security = readJson('trendforge-security-reliability.json');

const runs = Array.isArray(memory?.runs) ? memory.runs : [];
const latest = runs[runs.length - 1] ?? {};
const decisions = latest.decisions ?? {};
const evidence = latest.evidence ?? {};
const claims = latest.claims ?? {};
const health = supervisor?.overall ?? 'unknown';
const healthLabel = health === 'healthy' ? 'Running normally' : health === 'attention' ? 'Attention needed' : 'Watch required';
const healthIcon = health === 'healthy' ? '🟢' : health === 'attention' ? '🟡' : '🔴';

function fmt(v: any, fallback = '—') { return v === null || v === undefined ? fallback : String(v); }
function Card({label, value, help}: {label:string; value:any; help:string}) {
  return <div className="cc-card"><div className="cc-label">{label}</div><div className="cc-value">{fmt(value)}</div><div className="cc-help">{help}</div></div>;
}
function Status({name, ok, help}: {name:string; ok:boolean; help:string}) {
  return <div className="cc-status"><span>{ok ? '🟢' : '🟡'}</span><div><strong>{name}</strong><small>{help}</small></div></div>;
}

export default function ControlCenterPage() {
  const bottlenecks = Array.isArray(supervisor?.bottlenecks) ? supervisor.bottlenecks : [];
  const recommendations = Array.isArray(supervisor?.recommendations) ? supervisor.recommendations.slice(0, 3) : [];
  const eventCount = audit?.eventCount ?? 0;
  return <main className="cc-page">
    <header className="cc-hero">
      <div><p className="cc-eyebrow">TREND FORGE</p><h1>Control Center</h1><p>One simple view of what TrendForge is doing, what needs attention, and why.</p></div>
      <div className="cc-health"><span>{healthIcon}</span><div><strong>{healthLabel}</strong><small>Supervisor status</small></div></div>
    </header>

    <section><div className="cc-section-title"><h2>Today at a glance</h2><p>These numbers explain the latest publishing run.</p></div><div className="cc-grid">
      <Card label="Topics found" value={decisions.total ?? evidence.candidates} help="Topics discovered and evaluated." />
      <Card label="Evidence ready" value={decisions.singleSourceVerifiedReady ?? evidence.singleSource} help="Topics with at least one validated publisher source." />
      <Card label="Articles generated" value={latest.articles?.length ?? latest.articleCount} help="Articles produced by the latest run." />
      <Card label="Publish candidates" value={decisions.publishCandidates} help="Articles that reached the publishing-candidate stage." />
    </div></section>

    <section><div className="cc-section-title"><h2>Pipeline health</h2><p>Green means the stage passed its current checks. Yellow means it needs attention.</p></div><div className="cc-status-grid">
      <Status name="Research & Evidence" ok={Number(evidence.blocked ?? 0) < Number(evidence.candidates ?? 1)} help={`${fmt(evidence.passed, '0')} passed • ${fmt(evidence.blocked, '0')} blocked`} />
      <Status name="Claim Verification" ok={claims.pass !== false} help={`${fmt(claims.verified, '0')} verified • ${fmt(claims.unsupported, '0')} unsupported`} />
      <Status name="Supervisor" ok={health === 'healthy'} help={`${bottlenecks.length} bottleneck(s) detected`} />
      <Status name="Security & Reliability" ok={security?.passed !== false} help={security?.passed === true ? 'Latest security snapshot passed.' : 'No passing snapshot available.'} />
      <Status name="Performance" ok={true} help={`${fmt(performance?.insights?.length, '0')} insights recorded.`} />
      <Status name="Audit Trail" ok={eventCount > 0} help={`${eventCount} audit event(s) retained.`} />
    </div></section>

    <section className="cc-two"><div className="cc-panel"><div className="cc-section-title"><h2>🧠 Supervisor</h2><p>What TrendForge thinks needs attention.</p></div>{bottlenecks.length ? <div className="cc-list">{bottlenecks.slice(0, 5).map((b:any, i:number) => <div className="cc-list-row" key={i}><strong>{b.name ?? b.type ?? 'Bottleneck'}</strong><span>{b.reason ?? b.message ?? 'Needs investigation.'}</span></div>)}</div> : <p className="cc-empty">No current bottlenecks detected.</p>}</div>
      <div className="cc-panel"><div className="cc-section-title"><h2>🔧 Recommended actions</h2><p>Advisory suggestions only. They do not override publishing gates.</p></div>{recommendations.length ? <div className="cc-list">{recommendations.map((r:any, i:number) => <div className="cc-list-row" key={i}><strong>{r.action ?? 'Review'}</strong><span>{r.reason ?? r.description ?? 'Review this area.'}</span></div>)}</div> : <p className="cc-empty">No recommendations right now.</p>}</div></section>

    <section className="cc-explain"><h2>❓ Why is this important?</h2><p>Control Center combines existing TrendForge observations. It explains the state of the system; it does not lower thresholds, bypass evidence, change safety rules, rewrite articles, delete articles, or auto-publish.</p></section>

    <footer className="cc-footer"><span>Phase 25 • V2 Control Center</span><span>Audit events: {eventCount} • Historical runs: {runs.length}</span></footer>
  </main>;
}
