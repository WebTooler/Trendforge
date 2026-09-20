import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const articleDir='content/articles';
const briefPath='data/article-brief.json';
const claimPath='data/claim-verification.json';
const evidencePackPath='data/authoritative-evidence-pack.json';
const backupDir='.trendforge-claim-fixture-backup';
const source='Reuters reports that Acme launched its Nova AI model in London on Tuesday, with the company saying the model reduced inference costs by 20 percent. The company said the launch will initially target enterprise customers. Mozilla says paying for closed frontier models buys about a four-month head start at about five times the per-task cost, but only when tasks take between eight and 12 hours. However, open models are still lagging behind closed frontier models in revenue. The shift has accelerated the use of open models since Mozilla’s inaugural State of Open Source AI report was published on July 14. The report says organizations still pay for closed frontier models because they work out of the box and come bundled with compliance packaging, support, and accountability, while many organizations lack staff to run open-weight models well. The report highlights how Moonshot AI’s Kimi K3 achieves a composite AI performance score just three points behind Anthropic’s Fable 5 while costing 30 percent of the latter.';
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
  {name:'numeric contextual paraphrase',sentence:'Paying for closed frontier models gives roughly a four-month head start at around five times the per-task cost, but only for tasks lasting eight to 12 hours.',expect:x=>x.status==='verified'&&x.numericMismatch===false},
  {name:'revenue paraphrase',sentence:'Open models continue to trail closed frontier models when it comes to revenue.',expect:x=>x.status==='verified'&&x.numericMismatch===false},
  {name:'temporal paraphrase',sentence:'Use of open models accelerated after Mozilla published its inaugural State of Open Source AI report on July 14.',expect:x=>x.status==='verified'&&x.contradicted===false},
  {name:'editorial tipping point',sentence:'The Mozilla findings suggest that the AI landscape is at a tipping point.',expectArticle:true,articleOnly:true},
  {name:'canonical-pack isolation',sentence:'Acme introduced its Nova AI model in London on Tuesday, and said inference costs were reduced by 20 percent.',briefPassage:'This tampered brief passage claims Acme closed its London office and increased costs.',expect:x=>x.status==='verified'&&x.numericMismatch===false},
  {name:'model-number-and-percent normalization',sentence:'Moonshot AI’s Kimi K3 scores three points behind Anthropic’s Fable 5 while costing 30 % of the latter.',expect:x=>x.status==='verified'&&x.numericMismatch===false&&x.contradicted===false},
  {name:'attribution-preserved',sentence:'According to Reuters, Acme said the launch will initially target enterprise customers.',expect:x=>x.status==='verified'},
  {name:'uncertainty-preserved',sentence:'The launch could initially target enterprise customers, according to the company.',expect:x=>x.status==='verified'},
  {name:'certainty-escalation',sentence:'The launch will initially target enterprise customers.',expect:x=>x.status==='unsupported'||x.status==='partial'}
];

  ;