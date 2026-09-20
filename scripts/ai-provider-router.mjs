import fs from 'node:fs';

const statePath='data/ai-provider-state.json';
const COOLDOWN_RATE_MS=8*1000;
const COOLDOWN_SERVER_MS=2*60*1000;
const COOLDOWN_TRANSIENT_MS=30*1000;
const COOLDOWN_HARD_QUOTA_MS=6*60*60*1000;
const HISTORY_LIMIT=20;
const PROVIDER_PRIORITY={Groq:0,Gemini:1,Cohere:2,OpenRouter:3};
const MAX_STARTUP_RECOVERY_WAIT_MS=45*1000;
const providerConfig={Gemini:{key:'GEMINI_API_KEY'},Groq:{key:'GROQ_API_KEY'},OpenRouter:{key:'OPENROUTER_API_KEY'},Cohere:{key:'COHERE_API_KEY'}};
const providers=Object.keys(providerConfig);
const providerOnly=process.env.TRENDFORGE_PROVIDER_ONLY?.trim()||'';
if(providerOnly&&!providerConfig[providerOnly])throw new Error(`AI router provider-only mode requested unknown provider: ${providerOnly}.`);
let state={version:10,providers:{},rotationCursor:0,updatedAt:new Date().toISOString()};
try{state={...state,...JSON.parse(fs.readFileSync(statePath,'utf8'))};}catch{}
for(const name of providers){state.providers[name]??={failures:0,successes:0,quotaBlockedUntil:0,lastStatus:null,lastError:null,lastClass:null,lastSuccessAt:0};}

const classify=(status,message='')=>{
  const s=String(message).toLowerCase();
  if(/free-models-per-day|daily quota|daily limit|quota_exceeded|exceeded your current quota|monthly quota|credit_balance_exhausted|insufficient_quota|no credits remaining|payment_required|tokens per day|tpd|requests per day|rpd|account limited|3036/.test(s))return 'quota';
  if(status===429||/rate.?limit|too many requests|tokens per minute|tpm|retry-after|resource_exhausted|requests per minute|rpm|out of capacity|3040/.test(s))return 'rate_limit';
  if(status>=500)return 'server';
  if(status===401||status===403)return 'auth';
  if(status===400||status===404)return 'request';
  if(/timeout|timed out|operation was aborted|network|fetch failed|econnreset|enotfound|socket|deadline exceeded|service unavailable|temporarily unavailable|empty model response|invalid structured output|topic drift|response-shape/.test(s))return 'transient';
  return 'error';
};

const persist=()=>{state.version=10;state.updatedAt=new Date().toISOString();fs.mkdirSync('data',{recursive:true});fs.writeFileSync(statePath,JSON.stringify(state,null,2)+'\n');};
const record=(p,event)=>{p.history=Array.isArray(p.history)?p.history:[];p.history.push(event);if(p.history.length>HISTORY_LIMIT)p.history=p.history.slice(-HISTORY_LIMIT);};
const reliabilityScore=(name)=>{const p=state.providers[name]||{};const h=Array.isArray(p.history)?p.history:[];if(!h.length)return 50;const recent=h.slice(-10);const successes=recent.filter(x=>x.ok).length;const failures=recent.length-successes;const hardQuota=recent.filter(x=>x.class==='quota').length;return successes*8-failures*5-hardQuota*20+(PROVIDER_PRIORITY[name]===undefined? -5:5-PROVIDER_PRIORITY[name]);};
const mark=(name,status,message)=>{if(!providerConfig[name])return;const p=state.providers[name]??={failures:0,successes:0,quotaBlockedUntil:0};const kind=classify(status,message);record(p,{at:Date.now(),ok:false,class:kind,status:Number(status)||0});p.lastStatus=status;p.lastError=String(message).slice(0,500);p.lastClass=kind;p.failures=(p.failures||0)+1;if(kind==='quota')p.quotaBlockedUntil=Date.now()+COOLDOWN_HARD_QUOTA_MS;else if(kind==='rate_limit')p.quotaBlockedUntil=Date.now()+COOLDOWN_RATE_MS;else if(kind==='server')p.quotaBlockedUntil=Date.now()+COOLDOWN_SERVER_MS;else if(kind==='transient')p.quotaBlockedUntil=Date.now()+COOLDOWN_TRANSIENT_MS;persist();};
const markSuccess=(name)=>{if(!providerConfig[name])return;const p=state.providers[name]??={failures:0,successes:0,quotaBlockedUntil:0};record(p,{at:Date.now(),ok:true,class:'success',status:200});p.successes=(p.successes||0)+1;p.lastSuccessAt=new Date().toISOString();p.lastStatus=200;p.lastError=null;p.lastClass='success';p.quotaBlockedUntil=0;persist();};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const configuredAll=providers.filter(name=>Boolean(process.env[providerConfig[name].key]));
const configured=providerOnly?configuredAll.filter(name=>name===providerOnly):configuredAll;
if(providerOnly&&!configured.length)throw new Error(`AI router provider-only mode: ${providerOnly} is not configured.`);
if(providerOnly)console.log(`AI router provider-only mode: ${providerOnly}. Other providers are disabled for this run.`);
const isHardQuotaState=p=>p?.lastClass==='quota';
const buildHealthy=timestamp=>configured.filter(name=>(state.providers[name]?.quotaBlockedUntil||0)<=timestamp);
let now=Date.now();let healthy=buildHealthy(now);
if(!healthy.length&&configured.length){const recoverable=configured.filter(name=>!isHardQuotaState(state.providers[name])).map(name=>Number(state.providers[name]?.quotaBlockedUntil||0)).filter(until=>until>now).sort((a,b)=>a-b);const earliest=recoverable[0]||0;const waitMs=Math.min(MAX_STARTUP_RECOVERY_WAIT_MS,Math.max(0,earliest-Date.now()));if(waitMs>0){console.log(`AI router recovery wait: all configured providers are temporarily cooling down; waiting ${Math.ceil(waitMs/1000)}s for provider recovery.`);await sleep(waitMs);now=Date.now();healthy=buildHealthy(now);console.log(`AI router recovery re-check: ${healthy.length}/${configured.length} provider(s) recovered after bounded wait.`);}}
const healthPriority={Gemini:0,Groq:1,Cohere:2,OpenRouter:3};
const healthRank=[...healthy].sort((a,b)=>{const scoreA=reliabilityScore(a),scoreB=reliabilityScore(b);if(scoreA!==scoreB)return scoreB-scoreA;return (healthPriority[a]??99)-(healthPriority[b]??99);});
const rotationBase=healthRank.length?healthRank:[];const cursor=rotationBase.length?Number(state.rotationCursor||0)%rotationBase.length:0;const available=rotationBase.map((_,index)=>rotationBase[(index+cursor)%rotationBase.length]);if(rotationBase.length){state.rotationCursor=(cursor+1)%rotationBase.length;persist();}
console.log(`AI router available providers: ${available.length}/${providerOnly?1:providers.length}.`);
for(const name of providers){const p=state.providers[name];if(!process.env[providerConfig[name].key])console.log(`AI router not configured: ${name}.`);else if(providerOnly&&name!==providerOnly)console.log(`AI router provider-only excluded: ${name}.`);else if((p.quotaBlockedUntil||0)>Date.now())console.log(`AI router cooldown: ${name} until ${new Date(p.quotaBlockedUntil).toISOString()} (${p.lastClass||'blocked'}).`);}
console.log('AI router excluded from production: Cloudflare, OpenAI (credit-dependent), Cerebras (payment-required).');
console.log(`AI router writer rotation: ${available.join(' -> ')||'none'}.`);
export {state,available,mark,markSuccess,classify,providerConfig,reliabilityScore};
