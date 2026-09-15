import fs from 'node:fs';

const statePath='data/ai-provider-state.json';
const now=Date.now();
const COOLDOWN_RATE_MS=60*1000;
const COOLDOWN_SERVER_MS=2*60*1000;
const COOLDOWN_HARD_QUOTA_MS=6*60*60*1000;
const providers=['Groq','Gemini','OpenAI'];
let state={version:2,providers:{},updatedAt:new Date().toISOString()};
try{state=JSON.parse(fs.readFileSync(statePath,'utf8'));}catch{}
for(const name of providers){state.providers[name]??={failures:0,quotaBlockedUntil:0,lastStatus:null,lastError:null,lastClass:null};}

const classify=(status,message='')=>{
  const s=String(message).toLowerCase();
  if(/insufficient_quota|credit_balance_exhausted|no credits remaining|daily quota|quota_exceeded|exceeded your current quota/.test(s))return 'quota';
  if(status===429||/rate.?limit|too many requests|tokens per minute|tpm|retry-after|resource_exhausted/.test(s))return 'rate_limit';
  if(status>=500)return 'server';
  return 'error';
};

const mark=(name,status,message)=>{
  const p=state.providers[name]??={failures:0,quotaBlockedUntil:0};
  const kind=classify(status,message);
  p.lastStatus=status;
  p.lastError=String(message).slice(0,500);
  p.lastClass=kind;
  p.failures=(p.failures||0)+1;
  if(kind==='quota')p.quotaBlockedUntil=now+COOLDOWN_HARD_QUOTA_MS;
  else if(kind==='rate_limit')p.quotaBlockedUntil=now+COOLDOWN_RATE_MS;
  else if(kind==='server')p.quotaBlockedUntil=now+COOLDOWN_SERVER_MS;
  state.version=2;
  state.updatedAt=new Date().toISOString();
  fs.mkdirSync('data',{recursive:true});
  fs.writeFileSync(statePath,JSON.stringify(state,null,2)+'\n');
};

const available=providers.filter(name=>(state.providers[name]?.quotaBlockedUntil||0)<=now).sort((a,b)=>(state.providers[a]?.failures||0)-(state.providers[b]?.failures||0));
console.log(`AI router available providers: ${available.length}/${providers.length}.`);
for(const name of providers){const p=state.providers[name];if((p.quotaBlockedUntil||0)>now)console.log(`AI router cooldown: ${name} until ${new Date(p.quotaBlockedUntil).toISOString()} (${p.lastClass||'blocked'}).`);}
export {state,available,mark,classify};
