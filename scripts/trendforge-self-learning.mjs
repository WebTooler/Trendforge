import fs from 'node:fs';

const DATA = 'data';
const MEMORY_PATH = `${DATA}/trendforge-memory.json`;
const LEARNING_PATH = `${DATA}/trendforge-learning.json`;
const now = new Date().toISOString();

function readJson(path, fallback = null) {
  try { return JSON.parse(fs.readFileSync(path, 'utf8')); }
  catch { return fallback; }
}
function num(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function avg(values) { const valid = values.map(num).filter((v) => v != null); return valid.length ? Math.round(valid.reduce((a,b)=>a+b,0)/valid.length) : null; }
function rate(success,total) { const s=num(success), t=num(total); return t>0 && s!=null ? Math.round((s/t)*100) : null; }
function delta(current, previous) { return current != null && previous != null ? current - previous : null; }
function pctChange(current, previous) { return current != null && previous != null && previous !== 0 ? Math.round(((current-previous)/Math.abs(previous))*100) : null; }

const memory = readJson(MEMORY_PATH);
if (!memory || typeof memory !== 'object') throw new Error(`Invalid or missing ${MEMORY_PATH}`);
const runs = Array.isArray(memory.runs) ? memory.runs : [];
const topics = Array.isArray(memory.topics) ? memory.topics : [];
const previousRun = runs.length > 1 ? runs[runs.length - 2] : null;
const latestRun = runs.at(-1) ?? null;

function totals(key, fields) {
  return runs.reduce((acc, run) => {
    const source = run?.[key]; if (!source) return acc;
    for (const field of fields) acc[field] = (acc[field] ?? 0) + (num(source[field]) ?? 0);
    acc.samples += 1; return acc;
  }, { samples: 0 });
}
const decisionTotals = totals('decisions',['total','publishCandidates','review','hold','reject','strongEvidenceReady','singleSourceVerifiedReady']);
const evidenceTotals = totals('evidence',['candidates','passed','blocked','strong','singleSource']);
const claimRuns = runs.map(r=>r?.claims).filter(Boolean);
const claimLearning = {
  samples: claimRuns.length,
  passRate: claimRuns.length ? rate(claimRuns.filter(c=>c.pass).length,claimRuns.length) : null,
  averageConfidence: avg(claimRuns.map(c=>c.averageConfidence)),
  averageUnsupported: avg(claimRuns.map(c=>c.unsupported)),
  averageClaimsPerArticle: avg(claimRuns.map(c=>c.claimCount)),
};

const providerNames = new Set();
for (const run of runs) for (const name of Object.keys(run?.providers ?? {})) providerNames.add(name);
const providers = {};
for (const name of [...providerNames].sort()) {
  const samples = runs.map(r=>r?.providers?.[name]).filter(Boolean);
  const successes=samples.reduce((s,p)=>s+(num(p.successes)??0),0);
  const failures=samples.reduce((s,p)=>s+(num(p.failures)??0),0);
  const latest=samples.at(-1)??null;
  providers[name]={samples:samples.length,successes,failures,successRate:rate(successes,successes+failures),cooldownRuns:samples.filter(p=>p.inCooldown).length,latestStatus:latest?.lastStatus??null,latestClass:latest?.lastClass??null};
}

const categoryBuckets = new Map();
for (const topic of topics) {
  const category=String(topic.category||'Unknown').trim()||'Unknown';
  if(!categoryBuckets.has(category)) categoryBuckets.set(category,[]);
  categoryBuckets.get(category).push(topic);
}
const categories=Object.fromEntries([...categoryBuckets.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([category,items])=>[category,{
  topicSamples:items.length,
  averageScore:avg(items.map(t=>t.score)),
  averageConfidence:avg(items.map(t=>t.confidence)),
  evidenceLevels:items.reduce((a,t)=>{const k=t.evidenceLevel??'none';a[k]=(a[k]??0)+1;return a;},{}),
  decisions:items.reduce((a,t)=>{const k=t.decision??'unknown';a[k]=(a[k]??0)+1;return a;},{}),
}]));

function latestMetric(section, field) { return num(latestRun?.[section]?.[field]); }
function previousMetric(section, field) { return num(previousRun?.[section]?.[field]); }
const deltas={
  evidencePassRate:delta(rate(latestMetric('evidence','passed'),latestMetric('evidence','candidates')),rate(previousMetric('evidence','passed'),previousMetric('evidence','candidates'))),
  evidenceBlockRate:delta(rate(latestMetric('evidence','blocked'),latestMetric('evidence','candidates')),rate(previousMetric('evidence','blocked'),previousMetric('evidence','candidates'))),
  claimConfidence:delta(latestMetric('claims','averageConfidence'),previousMetric('claims','averageConfidence')),
  claimUnsupported:delta(latestMetric('claims','unsupported'),previousMetric('claims','unsupported')),
  editorialAverage:delta(latestMetric('editorial','averageScore'),previousMetric('editorial','averageScore')),
};

const signals=[];
function add(id, type, observation, detail, confidence='low', evidence={}) { signals.push({id,type,observation,detail,confidence,sampleRuns:runs.length,evidence}); }
add('evidence-single-source-dominance','evidence',evidenceTotals.singleSource>evidenceTotals.strong,'Historical evidence currently contains more single-source candidates than strong multi-source candidates.',runs.length>=5?'medium':'low',{singleSource:evidenceTotals.singleSource,strong:evidenceTotals.strong});
add('claim-verification-pressure','claims',(claimLearning.averageUnsupported??0)>0,'Claim-verification history contains unsupported claims in at least some observed article runs.',claimRuns.length>=5?'medium':'low',{averageUnsupported:claimLearning.averageUnsupported});
add('provider-reliability-signal','provider',Object.keys(providers).length>0,'Provider success/failure and cooldown history is available for reliability learning.',runs.length>=5?'medium':'low',{providers:Object.keys(providers).length});
if (deltas.evidencePassRate != null) add('evidence-pass-rate-change','trend',Math.abs(deltas.evidencePassRate)>=5,`Evidence pass rate changed by ${deltas.evidencePassRate >= 0 ? '+' : ''}${deltas.evidencePassRate} percentage points versus the previous run.`,runs.length>=5?'medium':'low',{delta:deltas.evidencePassRate});
if (deltas.claimConfidence != null) add('claim-confidence-change','trend',Math.abs(deltas.claimConfidence)>=5,`Average claim confidence changed by ${deltas.claimConfidence >= 0 ? '+' : ''}${deltas.claimConfidence} points versus the previous run.`,runs.length>=5?'medium':'low',{delta:deltas.claimConfidence});
if (deltas.claimUnsupported != null) add('claim-unsupported-change','trend',deltas.claimUnsupported!==0,`Unsupported-claim count changed by ${deltas.claimUnsupported >= 0 ? '+' : ''}${deltas.claimUnsupported} versus the previous run.`,runs.length>=5?'medium':'low',{delta:deltas.claimUnsupported});

const previous=readJson(LEARNING_PATH,{});
const next={
 version:2,updatedAt:now,mode:'shadow',
 policy:{advisoryOnly:true,influencesDecisions:false,changesPublicationGates:false,changesEvidenceThresholds:false,changesClaimThresholds:false,minimumLearningRuns:5},
 sample:{runs:runs.length,topics:topics.length,articles:Array.isArray(memory.articles)?memory.articles.length:0},
 decisions:{samples:decisionTotals.samples,publishCandidateRate:rate(decisionTotals.publishCandidates,decisionTotals.total),reviewRate:rate(decisionTotals.review,decisionTotals.total),holdRate:rate(decisionTotals.hold,decisionTotals.total),rejectRate:rate(decisionTotals.reject,decisionTotals.total),strongEvidenceRate:rate(decisionTotals.strongEvidenceReady,decisionTotals.total),singleSourceReadyRate:rate(decisionTotals.singleSourceVerifiedReady,decisionTotals.total)},
 evidence:{samples:evidenceTotals.samples,passRate:rate(evidenceTotals.passed,evidenceTotals.candidates),blockRate:rate(evidenceTotals.blocked,evidenceTotals.candidates),strongRate:rate(evidenceTotals.strong,evidenceTotals.candidates),singleSourceRate:rate(evidenceTotals.singleSource,evidenceTotals.candidates)},
 claims:claimLearning,providers,categories,
 trends:{latestVsPrevious:deltas,latestRunAt:latestRun?.recordedAt??null,previousRunAt:previousRun?.recordedAt??null},
 signals,
 history:{previousUpdatedAt:previous.updatedAt??null,previousVersion:previous.version??null},
};
fs.mkdirSync(DATA,{recursive:true});
fs.writeFileSync(LEARNING_PATH,`${JSON.stringify(next,null,2)}\n`);
console.log(`TrendForge Self-Learning v2: ${runs.length} run(s), ${topics.length} topic(s), ${claimRuns.length} claim sample(s), ${signals.length} signal(s).`);
console.log('Mode: SHADOW — learning is advisory only and cannot change publication, evidence, claim, editorial, safety, or monetization gates.');
console.log(`Learning output: ${LEARNING_PATH}`);
