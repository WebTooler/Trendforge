import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const articleDir='content/articles';
const briefPath='data/article-brief.json';
const claimPath='data/claim-verification.json';
const backupDir='.trendforge-claim-fixture-backup';

const source='Reuters reports that Acme launched its Nova AI model in London on Tuesday, with the company saying the model reduced inference costs by 20 percent. The company said the launch will initially target enterprise customers.';
const baseFrontmatter=`---\ntitle: "Acme Nova AI launch"\ndescription: "A test article for deterministic claim verification."\n---`;

const cases=[
  {name:'paraphrase',sentence:'Acme introduced its Nova AI model in London on Tuesday, and said inference costs were reduced by 20 percent.',expect:x=>x.status==='verified'&&x.classification==='supported'},
  {name:'contextual synthesis',sentence:'Acme launched Nova AI in London on Tuesday while initially targeting enterprise customers, according to the company.',expect:x=>x.status==='verified'&&(x.classification==='supported'||x.classification==='supported_with_context')},
  {name:'editorial analysis',sentence:'The launch highlights how lower inference costs could change the competitive picture.',expectArticle:true,articleOnly:true},
  {name:'unsupported addition',sentence:'Acme also signed a $2 billion government contract that day.',expect:x=>x.status==='unsupported'},
  {name:'numeric mismatch',sentence:'Acme reduced inference costs by 50 percent.',expect:x=>x.status==='unsupported'&&x.numericMismatch===true},
  {name:'contradiction',sentence:'Acme increased inference costs by 20 percent.',expect:x=>x.status==='unsupported'&&x.contradicted===true},
  {name:'reverse polarity',sentence:'Acme lowered inference costs by 20 percent.',expect:x=>x.status==='verified'&&x.contradicted===false},
  {name:'rise-fall contradiction',sentence:'Acme raised inference costs by 20 percent.',expect:x=>x.status==='unsupported'&&x.contradicted===true},
  {name:'off topic',sentence:'The weather forecast calls for rain across northern India.',expect:x=>x.status==='unsupported'&&x.offTopic===true},
];

function runCase(test){
  const article=`${baseFrontmatter}\n\n## Test\n${test.sentence}\n\n## Sources\n- [Reuters](https://example.com/reuters)`;
  fs.writeFileSync(`${articleDir}/fixture.md`,article);
  fs.writeFileSync(briefPath,JSON.stringify({brief:{title:'Acme Nova AI launch',summary:'Acme Nova AI launch and inference costs.'},grounding:{sources:[{title:'Reuters — Acme Nova AI launch',url:'https://example.com/reuters',passages:[source]}]}},null,2));
  const r=spawnSync(process.execPath,['scripts/verify-article-claims-v2.mjs'],{encoding:'utf8'});
  let report=null;try{report=JSON.parse(fs.readFileSync(claimPath,'utf8'));}catch{}
  if(test.expectArticle)return {ok:report?.editorial?.some(x=>x.type==='editorial-analysis'&&x.status==='editorial-excluded')===true,detail:`editorial records=${JSON.stringify(report?.editorial||[])}`};
  const claim=report?.claims?.[0];
  return {ok:Boolean(claim&&test.expect(claim)),detail:JSON.stringify(claim||report)};
}

function main(){
  fs.mkdirSync('data',{recursive:true});
  fs.mkdirSync(backupDir,{recursive:true});
  const hadArticles=fs.existsSync(articleDir);
  const hadBrief=fs.existsSync(briefPath);
  const hadClaim=fs.existsSync(claimPath);
  let failed=0;
  try{
    if(hadArticles)fs.renameSync(articleDir,`${backupDir}/articles`);
    fs.mkdirSync(articleDir,{recursive:true});
    if(hadBrief)fs.copyFileSync(briefPath,`${backupDir}/article-brief.json`);
    if(hadClaim)fs.copyFileSync(claimPath,`${backupDir}/claim-verification.json`);
    for(const test of cases){
      const result=runCase(test);
      if(result.ok)console.log(`CLAIM FIXTURE PASS: ${test.name}`);
      else{failed++;console.error(`CLAIM FIXTURE FAIL: ${test.name} — ${result.detail}`);}
      fs.rmSync(`${articleDir}/fixture.md`,{force:true});
    }
    if(failed)process.exitCode=1;
    else console.log(`Claim Verifier deterministic integration fixtures: ${cases.length} PASS — no AI provider calls made.`);
  }finally{
    fs.rmSync(articleDir,{recursive:true,force:true});
    if(hadArticles)fs.renameSync(`${backupDir}/articles`,articleDir);
    if(hadBrief)fs.copyFileSync(`${backupDir}/article-brief.json`,briefPath);else fs.rmSync(briefPath,{force:true});
    if(hadClaim)fs.copyFileSync(`${backupDir}/claim-verification.json`,claimPath);else fs.rmSync(claimPath,{force:true});
    fs.rmSync(backupDir,{recursive:true,force:true});
  }
  if(failed)process.exit(1);
}
main();
