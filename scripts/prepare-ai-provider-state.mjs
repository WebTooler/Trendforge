import fs from 'node:fs';

const path='data/ai-provider-state.json';
const providers=['Groq','Gemini','OpenAI'];
const now=Date.now();
const cooldown=6*60*60*1000;
let state={version:1,providers:{},updatedAt:new Date().toISOString()};
try{state=JSON.parse(fs.readFileSync(path,'utf8'));}catch{}
for(const name of providers)state.providers[name]??={failures:0,quotaBlockedUntil:0,lastStatus:null,lastError:null};

// Keep the state useful across runs without requiring paid infrastructure.
for(const name of providers){
  const p=state.providers[name];
  if((p.quotaBlockedUntil||0)<=now)p.quotaBlockedUntil=0;
}

// GitHub Actions can optionally provide explicit provider status through environment variables.
// This avoids making another paid/quota-consuming API request just to classify a provider.
for(const name of providers){
  const key=`${name.toUpperCase()}_PROVIDER_STATUS`;
  const status=process.env[key];
  if(status==='quota'){const p=state.providers[name];p.lastStatus='quota';p.lastError='quota/rate-limit reported by provider health check';p.failures=(p.failures||0)+1;p.quotaBlockedUntil=now+cooldown;}
  else if(status==='ok'){state.providers[name].lastStatus='ok';state.providers[name].quotaBlockedUntil=0;}
}

fs.mkdirSync('data',{recursive:true});
fs.writeFileSync(path,JSON.stringify(state,null,2)+'\n');
console.log('AI provider state persisted.');
for(const name of providers){const p=state.providers[name];console.log(`${name}: ${p.quotaBlockedUntil>now?'COOLDOWN':'AVAILABLE'}`);}
