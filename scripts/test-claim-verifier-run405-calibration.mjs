import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';

const artifactId=10713098432;
const repo=process.env.GITHUB_REPOSITORY||'WebTooler/Trendforge';
const token=process.env.GITHUB_TOKEN;
if(!token) throw new Error('GITHUB_TOKEN is required for Run 405 verifier calibration.');

const root=fs.mkdtempSync(path.join(os.tmpdir(),'trendforge-run405-'));
const zip=path.join(root,'run405.zip');
const extract=path.join(root,'extract');
fs.mkdirSync(extract);

const res=await fetch(`https://api.github.com/repos/${repo}/actions/artifacts/${artifactId}/zip`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
if(!res.ok) throw new Error(`Failed to download Run 405 artifact: HTTP ${res.status}`);
fs.writeFileSync(zip,Buffer.from(await res.arrayBuffer()));
execFileSync('unzip',['-q',zip,'-d',extract],{stdio:'inherit'});

const target=path.join(extract,'article-attempts','20260922-184621-san-francisco-files-suit-against-trump-media-over-paid-early-access-service');
const articlePath=path.join(target,'article.md');
const briefPath=path.join(target,'article-brief.json');
const evidencePath=path.join(target,'authoritative-evidence-pack.json');
for(const p of [articlePath,briefPath,evidencePath]) if(!fs.existsSync(p)) throw new Error(`Run 405 calibration fixture missing: ${p}`);

const out=path.join(root,'claim-verification.json');
const result=spawnSync(process.execPath,['scripts/verify-article-claims-smart.mjs'],{env:{...process.env,TREND_FORGE_VERIFY_ARTICLE_DIR:path.dirname(articlePath),TREND_FORGE_VERIFY_BRIEF_PATH:briefPath,TREND_FORGE_VERIFY_EVIDENCE_PACK_PATH:evidencePath,TREND_FORGE_VERIFY_OUTPUT:out,GITHUB_RUN_ID:'35768815681'},encoding:'utf8'});
process.stdout.write(result.stdout||''); process.stderr.write(result.stderr||'');
if(!fs.existsSync(out)) throw new Error('Run 405 verifier produced no claim-verification output.');
const report=JSON.parse(fs.readFileSync(out,'utf8'));
console.log(`Run 405 updated verifier: ${report.verified} supported, ${report.partial} partial, ${report.unsupported} unsupported, average confidence ${report.averageConfidence}`);
for(const c of report.claims) console.log(`C${c.index}: ${c.status} / ${c.classification} / ${c.confidence} / ${c.matchingMode||'-'} — ${c.claim}`);
if(report.verified!==11||report.partial!==2||report.unsupported!==2) throw new Error(`Run 405 verifier calibration mismatch: expected 11/2/2, got ${report.verified}/${report.partial}/${report.unsupported}`);
console.log('Run 405 verifier calibration: PASS (11 supported / 2 partial / 2 unsupported)');
