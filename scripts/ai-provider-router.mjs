import fs from 'node:fs';

const statePath='data/ai-provider-state.json';
const now=Date.now();
const COOLDOWN_MS=6*60*60*1000;
const providers=['Groq','Gemini','OpenAI'];
let state={version:1,providers:{},updatedAt:new Date().toISOString()};
try{state=JSON.parse(fs.readFileSync(statePath,'utf8'));}catch{}
for(const name of providers){state.providers[name]??={failures:0,quotaBlockedUntil:0,lastStatus:null,lastError:null};}

const classify=(status,message='')=>{const s=String(message).toLowerCase();if(status===429||/rate.?limit|quota|exhausted|insufficient.*credit|too many requests/.test(s))return 'quota';if(status>=500)return 'server';return 'error';};
const mark=(name,status,message)=>{const p=state.providers[name]??={failures:0,quotaBlockedUntil:0};p.lastStatus=status;p.lastError=String(message).slice(0,300);p.failures=(p.failures||0)+1;if(classify(status,message)==='quota')p.quotaBlockedUntil=now+COOLDOWN_MS;state.updatedAt=new Date().toISOString();fs.mkdirSync('data',{recursive:true});fs.writeFileSync(statePath,JSON.stringify(state,null,2)+'\n');};
const available=providers.filter(name=>(state.providers[name]?.quotaBlockedUntil||0)<=now).sort((a,b)=>(state.providers[a]?.failures||0)-(state.providers[b]?.failures||0));
console.log(`AI router available providers: ${available.length}/${providers.length}.`);
for(const name of providers){const p=state.providers[name];if((p.quotaBlockedUntil||0)>now)console.log(`AI router cooldown: ${name} until ${new Date(p.quotaBlockedUntil).toISOString()}.`);}
export {state,available,mark,classify};
