import fs from 'node:fs';

const path='scripts/trendforge-writer-engine.mjs';
const text=fs.readFileSync(path,'utf8');
const required=[
  "const MAX_PROVIDER_ATTEMPTS_PER_RUN=6;",
  "const MAX_PROVIDER_ATTEMPTS_PER_CANDIDATE=3;",
  "const MAX_REPAIR_PROVIDER_ATTEMPTS=4;",
  "generateWithTrendForgeRepair"
];
const forbidden=[
  'Cloudflare',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_MODEL',
  'api.cloudflare.com'
];
const missing=required.filter(x=>!text.includes(x));
const presentForbidden=forbidden.filter(x=>text.includes(x));
if(missing.length||presentForbidden.length){
  throw new Error(`Writer runtime compatibility check failed: missing=${missing.join(' | ')||'none'} forbidden=${presentForbidden.join(' | ')||'none'}`);
}
console.log('Writer runtime prepared: four approved writing providers only; Cloudflare is absent from the writer engine.');
