import fs from 'node:fs';

const path='scripts/trendforge-writer-engine.mjs';
const text=fs.readFileSync(path,'utf8');
const required=[
  "const MAX_PROVIDER_ATTEMPTS_PER_RUN=10;",
  "const MAX_PROVIDER_ATTEMPTS_PER_CANDIDATE=4;",
  "const MAX_REPAIR_PROVIDER_ATTEMPTS=4;",
  "Cloudflare:'CLOUDFLARE_API_TOKEN'",
  "Cloudflare:process.env.CLOUDFLARE_MODEL||'@cf/meta/llama-3.3-70b-instruct-fp8-fast'",
  "Cloudflare:{type:'json_object'}",
  "generateWithTrendForgeRepair"
];
const missing=required.filter(x=>!text.includes(x));
if(missing.length){throw new Error(`Writer runtime compatibility check failed: missing ${missing.join(' | ')}`);}
console.log('Writer runtime prepared: source writer-engine configuration preserved; no runtime mutation applied.');
