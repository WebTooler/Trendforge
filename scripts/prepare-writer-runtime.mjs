import fs from 'node:fs';

const path='scripts/trendforge-writer-engine.mjs';
let text=fs.readFileSync(path,'utf8');
const replacements=[
  ["const MAX_PROVIDER_ATTEMPTS_PER_RUN=10;","const MAX_PROVIDER_ATTEMPTS_PER_RUN=6;"],
  ["const MAX_PROVIDER_ATTEMPTS_PER_CANDIDATE=4;","const MAX_PROVIDER_ATTEMPTS_PER_CANDIDATE=2;"],
  ["const MAX_REPAIR_PROVIDER_ATTEMPTS=4;","const MAX_REPAIR_PROVIDER_ATTEMPTS=3;"],
  ["const providerTimeout=provider=>({OpenRouter:40000,Cohere:35000,Groq:35000,Gemini:35000}[provider]||35000);","const providerTimeout=provider=>({OpenRouter:22000,Cloudflare:45000,Cohere:35000,Groq:35000,Gemini:35000}[provider]||35000);"],
  ["const keyFor=provider=>({Groq:'GROQ_API_KEY',Gemini:'GEMINI_API_KEY',OpenRouter:'OPENROUTER_API_KEY',Cohere:'COHERE_API_KEY'}[provider]);","const keyFor=provider=>({Groq:'GROQ_API_KEY',Gemini:'GEMINI_API_KEY',OpenRouter:'OPENROUTER_API_KEY',Cohere:'COHERE_API_KEY',Cloudflare:'CLOUDFLARE_API_TOKEN'}[provider]);"],
  ["const providerModel=provider=>({Groq:process.env.GROQ_MODEL||'openai/gpt-oss-20b',Gemini:process.env.GEMINI_MODEL||'gemini-3.6-flash',OpenRouter:process.env.OPENROUTER_MODEL||'openrouter/free',Cohere:process.env.COHERE_MODEL||'command-a-plus-05-2026'}[provider]);","const providerModel=provider=>({Groq:process.env.GROQ_MODEL||'openai/gpt-oss-20b',Gemini:process.env.GEMINI_MODEL||'gemini-3.6-flash',OpenRouter:process.env.OPENROUTER_MODEL||'openrouter/free',Cohere:process.env.COHERE_MODEL||'command-a-plus-05-2026',Cloudflare:process.env.CLOUDFLARE_MODEL||'@cf/meta/llama-3.3-70b-instruct-fp8-fast'}[provider]);"],
  ["else if(provider==='Cohere')r=await fetch('https://api.cohere.com/v2/chat'","else if(provider==='Cloudflare')r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${providerModel(provider)}`,{method:'POST',signal,headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'system',content:system},{role:'user',content:prompt}],max_tokens:3600,temperature:0.1,response_format:{type:'json_object'}})});else if(provider==='Cohere')r=await fetch('https://api.cohere.com/v2/chat'"]
];
for(const [from,to] of replacements){if(!text.includes(from))throw new Error(`Writer runtime patch target missing: ${from.slice(0,90)}`);text=text.replace(from,to);}
const old="if(provider==='Gemini')return j.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';if(provider==='Cohere')";
const next="if(provider==='Gemini')return j.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';if(provider==='Cloudflare')return j.result?.response||'';if(provider==='Cohere')";
if(!text.includes(old))throw new Error('Writer runtime patch target for response parsing missing.');
text=text.replace(old,next);
fs.writeFileSync(path,text);
console.log('Writer runtime prepared: Cloudflare Workers AI / Llama 3.3 70B enabled; writer budget capped at 6/run and 2/candidate; OpenRouter timeout bounded to 22s.');
