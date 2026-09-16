import fs from 'node:fs';
import path from 'node:path';
import './control-center.css';

export const dynamic = 'force-static';

function readJson(name: string): any {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', name), 'utf8')); }
  catch { return null; }
}
function fmt(v: any, fallback = '—') { return v === null || v === undefined || v === '' ? fallback : String(v); }
function arr(v: any) { return Array.isArray(v) ? v : []; }
function pct(a: any, b: any) { const x = Number(a), y = Number(b); return y > 0 ? `${Math.round((x / y) * 100)}%` : '—'; }

const memory = readJson('trendforge-memory.json');
const supervisor = readJson('trendforge-supervisor.json');
const audit = readJson('trendforge-audit-trail.json');
const performance = readJson('trendforge-performance.json');
const security = readJson('trendforge-security-reliability.json');
const learning = readJson('trendforge-learning.json');
const monetization = readJson('trendforge-monetization-intelligence.json');
const runs = arr(memory?.runs);
const latest = runs[runs.length - 1] ?? {};
const decisions = latest.decisions ?? {};
const evidence = latest.evidence ?? {};
const claims = latest.claims ?? {};
const editorial = latest.editorial ?? {};
const lifecycle = latest.lifecycle ?? {};
const distribution = latest.distribution ?? {};
const providers = latest.providers ?? {};
const health = supervisor?.overall ?? 'unknown';
const healthLabel = health === 'healthy' ? 'Running normally' : health === 'attention' ? 'Attention needed' : health === 'watch' ? 'Watch required' : 'Status unavailable';
const healthIcon = health === 'healthy' ? '🟢' : health === 'attention' ? '🟡' : health === 'watch' ? '🟠' : '⚪';
const bottlenecks = arr(supervisor?.bottlenecks);
const recommendations = arr(supervisor?.recommendations).slice(0, 3);
const auditEvents = Number(audit?.eventCount ?? arr(audit?.events).length ?? 0);
const providerEntries = Object.entries(providers) as [string, any][];
const articleCount = Number(editorial.articleCount ?? latest.articleCount ?? 0);
const evidencePassed = Number(evidence.passed ?? 0);
const evidenceBlocked = Number(evidence.blocked ?? 0);
const singleSource = Number(evidence.singleSource ?? decisions.singleSourceVerifiedReady ?? 0);
const strongEvidence = Number(evidence.strong ?? decisions.strongEvidenceReady ?? 0);
const generated = Number(latest.articlesGenerated ?? latest.generatedArticles ?? articleCount ?? 0);

function Card({label, value, help}: {label:string; value:any; help:string}) {
  return <div className="cc-card"><div className="cc-label">{label}</div><div className="cc-value">{fmt(value)}</div><div className="cc-help">{help}</div></div>;
}
function Status({name, state, help}: {name:string; state:'good'|'watch'|'unknown'; help:string}) {
  const icon = state === 'good' ? '🟢' : state === 'watch' ? '🟡' : '⚪';
  return <div className="cc-status"><span>{icon}</span><div><strong>{name}</strong><small>{help}</small></div></div>;
}
function Section({eyebrow, title, children, help}: {eyebrow:string; title:string; children:React.ReactNode; help:string}) {
  return <section className="cc-section"><div className="cc-section-title"><div className="cc-label">{eyebrow}</div><h2>{title}</h2><p>{help}</p></div>{children}</section>;
}

export default function ControlCenterPage() {
  const evidenceState = evidencePassed > 0 ? 'good' : 'watch';
  const claimState = claims.pass === true ? 'good' : claims.claimCount ? 'watch' : 'unknown';
  const securityState = security?.passed === true ? 'good' : security?.passed === false ? 'watch' : 'unknown';
  const auditState = auditEvents > 0 ? 'good' : 'unknown';
  return <main className="cc-page">
    <header className="cc-hero">
      <div><p className="cc-eyebrow">TREND FORGE • PHASE 25</p><h1>Control Center</h1><p>One simple command view of what TrendForge is doing, where work is stuck, and why.</p></div>
      <div className="cc-health"><span>{healthIcon}</span><div><strong>{healthLabel}</strong><small>Supervisor status • observational only</small></div></div>
    </header>

    <Section eyebrow="01 • OVERVIEW" title="Today at a glance" help="The latest recorded publishing run, translated into plain language.">
      <div className="cc-grid">
        <Card label="Topics found" value={decisions.total ?? evidence.candidates} help="Topics discovered and evaluated." />
        <Card label="Evidence ready" value={decisions.singleSourceVerifiedReady ?? singleSource} help="Topics with at least one validated publisher source." />
        <Card label="Articles generated" value={generated || articleCount} help="Articles recorded from the latest run." />
        <Card label="Publish candidates" value={decisions.publishCandidates ?? 0} help="Articles that cleared the decision stage." />
      </div>
      <div className="cc-flow"><div><b>{fmt(decisions.total ?? evidence.candidates, '0')}</b><span>topics evaluated</span></div><i>→</i><div><b>{fmt(singleSource, '0')}</b><span>single-source ready</span></div><i>→</i><div><b>{fmt(generated || articleCount, '0')}</b><span>articles produced</span></div><i>→</i><div><b>{fmt(decisions.publishCandidates ?? 0, '0')}</b><span>publish candidates</span></div></div>
    </Section>

    <Section eyebrow="02 • PIPELINE" title="Pipeline health" help="A green stage is healthy according to its available telemetry. Yellow means something needs investigation. White means the snapshot is missing, not that the stage passed.">
      <div className="cc-status-grid">
        <Status name="Research & Evidence" state={evidenceState} help={`${fmt(evidencePassed,'0')} passed • ${fmt(evidenceBlocked,'0')} blocked • ${fmt(strongEvidence,'0')} strong`} />
        <Status name="Claim Verification" state={claimState} help={claims.claimCount ? `${fmt(claims.verified,'0')} verified • ${fmt(claims.unsupported,'0')} unsupported • avg ${fmt(claims.averageConfidence,'—')}` : 'No claim snapshot available'} />
        <Status name="Editorial Quality" state={editorial.status === 'pass' ? 'good' : editorial.status ? 'watch' : 'unknown'} help={editorial.articleCount ? `${fmt(editorial.articleCount,'0')} articles • avg score ${fmt(editorial.averageScore,'—')}` : 'No editorial snapshot available'} />
        <Status name="Supervisor" state={health === 'healthy' ? 'good' : health === 'attention' || health === 'watch' ? 'watch' : 'unknown'} help={`${bottlenecks.length} bottleneck(s) detected`} />
        <Status name="Security & Reliability" state={securityState} help={security?.passed === true ? 'Latest security snapshot passed.' : security?.passed === false ? 'Latest security snapshot reported issues.' : 'Snapshot not available in this build.'} />
        <Status name="Audit Trail" state={auditState} help={auditEvents ? `${auditEvents} audit event(s) retained.` : 'Audit snapshot not available in this build.'} />
      </div>
    </Section>

    <Section eyebrow="03 • PUBLISHING DESK" title="Where articles stand" help="This is a status board, not an override panel. TrendForge keeps its existing publication gates intact.">
      <div className="cc-board">
        <div><span>📰 Published</span><b>{fmt(latest.publishedCount ?? latest.published, '0')}</b><small>Already live</small></div>
        <div><span>✍️ In production</span><b>{fmt(generated || articleCount, '0')}</b><small>Generated / being processed</small></div>
        <div><span>🔎 Review</span><b>{fmt(decisions.review, '0')}</b><small>Needs another decision</small></div>
        <div><span>⏸️ Held</span><b>{fmt(decisions.hold, '0')}</b><small>Waiting for conditions</small></div>
        <div><span>🚫 Rejected</span><b>{fmt(decisions.reject, '0')}</b><small>Not suitable for publication</small></div>
      </div>
      <div className="cc-callout"><strong>Why are publish candidates at {fmt(decisions.publishCandidates,'0')}?</strong><p>TrendForge only moves an article forward when the required evidence, writing, claim verification, editorial and safety checks are satisfied. A high topic score alone does not publish an article.</p></div>
    </Section>

    <div className="cc-two">
      <Section eyebrow="04 • EVIDENCE" title="Research & Evidence" help="Evidence readiness is separate from topic popularity. Discovery feeds are not treated as evidence.">
        <div className="cc-mini-grid"><Card label="Candidates" value={evidence.candidates} help="Topics entering evidence evaluation."/><Card label="Passed" value={evidencePassed} help={`${pct(evidencePassed,evidence.candidates)} of candidates.`}/><Card label="Single source" value={singleSource} help="At least one validated publisher."/><Card label="Strong" value={strongEvidence} help="Independent publisher-family coverage."/></div>
        <div className="cc-reason"><b>Common meaning</b><p>Single-source readiness means generation may be allowed, but the article still has to pass downstream verification. Strong multi-source evidence is preferred, not a shortcut around other gates.</p></div>
      </Section>
      <Section eyebrow="05 • ARTICLE QUALITY" title="Quality chain" help="Every article is checked through multiple independent quality layers.">
        <div className="cc-chain"><span>Writer</span><b>→</b><span>Claims</span><b>→</b><span>Grounding</span><b>→</b><span>Editorial</span><b>→</b><span>Safety</span><b>→</b><span>SEO</span></div>
        <div className="cc-quality-stats"><div><b>{fmt(claims.verified,'0')}</b><span>claims verified</span></div><div><b>{fmt(claims.averageConfidence,'—')}</b><span>claim confidence</span></div><div><b>{fmt(editorial.averageScore,'—')}</b><span>editorial score</span></div></div>
      </Section>
    </div>

    <Section eyebrow="06 • AI PROVIDERS" title="Provider center" help="Provider failures are operational signals. A quota or timeout does not change evidence or quality rules.">
      {providerEntries.length ? <div className="cc-provider-grid">{providerEntries.map(([name,p]) => <div className="cc-provider" key={name}><div><strong>{name}</strong><span>{p?.inCooldown ? '🟡 Cooldown' : p?.lastClass === 'quota' ? '🟡 Quota' : p?.successes ? '🟢 Available history' : '⚪ No recent success'}</span></div><p>Successes: {fmt(p?.successes,'0')} • Failures: {fmt(p?.failures,'0')}</p><small>Last: {fmt(p?.lastClass,'unknown')} {p?.lastStatus ? `• status ${p.lastStatus}` : ''}</small></div>)}</div> : <div className="cc-empty">No provider snapshot available.</div>}
    </Section>

    <div className="cc-two">
      <Section eyebrow="07 • SUPERVISOR" title="What needs attention" help="Phase 23 diagnoses bottlenecks and offers bounded recommendations. It does not repair or override gates here.">
        {bottlenecks.length ? <div className="cc-list">{bottlenecks.slice(0,6).map((b:any,i:number)=><div className="cc-list-row" key={i}><strong>{b.name ?? b.type ?? 'Bottleneck'}</strong><span>{b.reason ?? b.message ?? 'Needs investigation.'}</span></div>)}</div> : <div className="cc-empty">No current bottlenecks detected in the available snapshot.</div>}
        {recommendations.length > 0 && <div className="cc-recommend"><b>Recommended next checks</b>{recommendations.map((r:any,i:number)=><p key={i}>• {r.action ?? 'Review'} — {r.reason ?? r.description ?? 'Inspect the affected stage.'}</p>)}</div>}
      </Section>
      <Section eyebrow="08 • PERFORMANCE & LEARNING" title="What TrendForge is learning" help="These layers are observational/shadow intelligence. They do not silently change publishing decisions.">
        <div className="cc-learning"><div><b>{fmt(performance?.runs,'0')}</b><span>runs analysed</span></div><div><b>{fmt(performance?.insights?.length,'0')}</b><span>performance insights</span></div><div><b>{fmt(learning?.signals?.length,'0')}</b><span>learning signals</span></div></div>
        <div className="cc-reason"><b>Safety rule</b><p>Performance and learning can identify patterns and bottlenecks, but the current contracts keep them out of publication gates.</p></div>
      </Section>
    </div>

    <Section eyebrow="09 • SECURITY" title="Security & Reliability" help="Operational health is shown separately from content quality.">
      <div className="cc-security-grid"><div><b>{security?.passed === true ? 'PASS' : security?.passed === false ? 'ATTENTION' : 'UNKNOWN'}</b><span>Security snapshot</span></div><div><b>{fmt(security?.checksPassed ?? security?.passedChecks,'—')}</b><span>checks passed</span></div><div><b>{fmt(security?.build,'—')}</b><span>build status</span></div><div><b>{fmt(security?.staticOutputs,'—')}</b><span>static outputs</span></div></div>
    </Section>

    <div className="cc-two">
      <Section eyebrow="10 • AUDIT" title="Audit timeline" help="Phase 24 records operational history without influencing decisions.">
        <div className="cc-audit-head"><b>{auditEvents || '—'}</b><span>events retained</span></div>
        {arr(audit?.events).slice(-5).reverse().map((e:any,i:number)=><div className="cc-audit-row" key={e?.id ?? i}><span>{e?.recordedAt ? new Date(e.recordedAt).toLocaleString() : 'Recorded event'}</span><b>{e?.type ?? 'event'}</b><small>{e?.phase ? `Phase ${e.phase}` : ''} {e?.status ? `• ${e.status}` : ''}</small></div>)}
        {!auditEvents && <div className="cc-empty">The audit snapshot was not available when this page was generated.</div>}
      </Section>
      <Section eyebrow="11 • MONETIZATION" title="Revenue readiness" help="Monetization intelligence observes fit and readiness; it does not lower editorial or safety standards.">
        <div className="cc-monetize"><div><b>{monetization?.readyForAdSenseFoundation === true ? 'Ready' : 'Not ready'}</b><span>Ad foundation</span></div><div><b>{fmt(monetization?.articleCount ?? latest.monetization?.articleCount,'—')}</b><span>articles assessed</span></div><div><b>{fmt(monetization?.evergreenCount ?? '—')}</b><span>evergreen opportunities</span></div></div>
      </Section>
    </div>

    <section className="cc-explain"><h2>❓ How to read this Control Center</h2><div className="cc-explain-grid"><p><b>🟢 Green</b><br/>The available telemetry says this stage passed.</p><p><b>🟡 Yellow</b><br/>There is an operational or quality condition worth investigating.</p><p><b>⚪ White</b><br/>The required snapshot is missing. It is not treated as a pass.</p><p><b>🔒 Protected pipeline</b><br/>Control Center cannot lower thresholds, bypass evidence, bypass safety, rewrite/delete articles automatically, or auto-publish.</p></div></section>

    <footer className="cc-footer"><span>TrendForge V2 • Phase 25 Control Center</span><span>Historical runs: {runs.length} • Audit events: {auditEvents || '—'}</span></footer>
  </main>;
}
