import { available, mark, markSuccess } from './ai-provider-router.mjs';
import { buildWriterContract, validateDraft } from './trendforge-editorial-policy.mjs';

const MAX_TRANSIENT_RETRIES=1;
const providerTimeout=provider=>({OpenRouter:25000,Cohere:20000,Groq:20000,Gemini:20000}[provider]||20000);
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const retryDelay=(response,attempt)=>{const header=Number(response.headers.get('retry-after')||0);if(Number.isFinite(header)&&header>0)return Math.min(header*1000,5000);return Math.min(600*(2**attempt)+Math.floor(Math.random()*300),3500);};
const keyFor=provider=>({Groq:'GROQ_API_KEY',Gemini:'GEMINI_API_KEY',OpenRouter:'OPENROUTER_API_KEY',Cohere:'COHERE_API_KEY'}[provider]);
const providerModel=provider=>({
  Groq:process.env.GROQ_MODEL||'openai/gpt-oss-20b',
  Gemini:process.env.GEMINI_MODEL||'gemini-3.6-flash',
  OpenRouter:process.env.OPENROUTER_MODEL||'openrouter/free',
  Cohere:process.env.COHERE_MODEL||'command-a-plus-05-2026'
}[provider]);
const commonSystem='You are the TrendForge Writer Engine. Follow the editorial policy in the prompt. Use only supplied research. Every material factual statement must be directly supported by the supplied evidence; if evidence does not support a detail, omit it. Produce original, factual, useful journalism. Never fabricate facts. Return ONLY a JSON object with exactly these string fields: title, description, content.';
const schema={type:'object',properties:{title:{type:'string'},description:{type:'string'},content:{type:'string'}},required:['title','description','content'],additionalProperties:false};
const openRouterFormat={type:'json_schema',json_schema:{name:'trendforge_article',strict:true,schema}};
const groqFormat={type:'json_schema',json_schema:{name:'trendforge_article',strict:true,schema}};
const cohereFormat={type:'json_object',schema};

const request=async(provider,prompt)=>{
  for(let attempt=0;attempt<=MAX_TRANSIENT_RETRIES;attempt++){
    const signal=AbortSignal.timeout(providerTimeout(provider));let r;
    if(provider==='Groq'){
      r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',signal,headers:{Authorization:`Bearer ${process.env.GROQ_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:providerModel(provider),max_completion_tokens:2400,reasoning_effort:'low',response_format:groqFormat,messages:[{role:'system',content:commonSystem},{role:'user',content:prompt}]})});
    }else if(provider==='Gemini'){
      r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${providerModel(provider)}:generateContent`,{method:'POST',signal,headers:{'x-goog-api-key':process.env.GEMINI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:`${commonSystem}\n\n${prompt}`}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:2800}})});
    }else if(provider==='OpenRouter'){
      r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',signal,headers:{Authorization:`Bearer ${process.env.OPENROUTER_API_KEY}`,'Content-Type':'application/json','HTTP-Referer':'https://github.com/WebTooler/Trendforge','X-Title':'TrendForge'},body:JSON.stringify({model:providerModel(provider),max_tokens:2600,response_format:openRouterFormat,plugins:[{id:'response-healing'}],provider:{allow_fallbacks:true,sort:'latency'},messages:[{role:'system',content:commonSystem},{role:'user',content:prompt}]})});
    }else if(provider==='Cohere'){
      r=await fetch('https://api.cohere.com/v2/chat',{method:'POST',signal,headers:{Authorization:`Bearer ${process.env.COHERE_API_KEY}`,'Content-Type':'application/json','X-Client-Name':'TrendForge'},body:JSON.stringify({model:providerModel(provider),max_tokens:2800,temperature:0.15,seed:42,response_format:cohereFormat,messages:[{role:'system',content:commonSystem},{role:'user',content:prompt}]})});
    }
    if(r.ok){const j=await r.json();if(provider==='Gemini')return j.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';if(provider==='Cohere'){const content=j.message?.content;return Array.isArray(content)?content.filter(x=>x?.type==='text').map(x=>x.text||'').join(''):(typeof content==='string'?content:'');}return j.choices?.[0]?.message?.content||'';}
    const body=(await r.text()).slice(0,1200);const retryable=r.status===429||r.status>=500;if(retryable&&attempt<MAX_TRANSIENT_RETRIES){await sleep(retryDelay(r,attempt));continue;}throw new Error(`${r.status}: ${body}`);
  }
  throw new Error('Provider request exhausted');
};

const parseWriterJson=(text='')=>{const cleaned=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/i,'').trim();for(const candidate of [cleaned,cleaned.replace(/^\s*json\s*/i,''),(()=>{const start=cleaned.indexOf('{'),end=cleaned.lastIndexOf('}');return start>=0&&end>start?cleaned.slice(start,end+1):'';})()]){if(!candidate)continue;try{const parsed=JSON.parse(candidate);if(parsed&&typeof parsed==='object')return parsed;}catch{}}return null;};
const topicTokens=(text='')=>{const stop=new Set(['about','after','again','also','been','being','could','from','have','into','more','most','over','said','some','than','that','their','there','these','they','this','what','when','which','with','will','would','your','technology','tech','digital','latest','news','update','today','company','industry','development','developments']);return new Set(String(text).toLowerCase().replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(w=>w.length>=4&&!stop.has(w)));};
const requestedTitle=prompt=>{const m=String(prompt).match(/^Title:\s*(.+)$/im);return (m?.[1]||'').replace(/\s+-\s+(Reuters|Yahoo Finance|finance\.yahoo\.com|CNBC|The Guardian|TechCrunch|GeekWire|Mistral|Microsoft|Apple)$/i,'').trim();};
const topicAlignment=(requested,draft)=>{const a=topicTokens(requested),b=topicTokens(`${draft.title} ${draft.description} ${draft.content.slice(0,7000)}`),titleB=topicTokens(draft.title);const shared=[...a].filter(x=>b.has(x)),titleShared=[...a].filter(x=>titleB.has(x));return{score:shared.length,shared:shared.slice(0,12),titleShared:titleShared.slice(0,12),passed:titleShared.length>=2||shared.length>=5};};

export async function generateWithTrendForgeWriter({prompt,category='Technology'}){
  const inferred=category&&category!=='Technology'?category:prompt.match(/(?:category|section)\s*[:=]\s*(AI|Technology|How-To|Innovation|Product Launches|Digital Life|Crypto)/i)?.[1]||category;
  const contract=buildWriterContract(inferred);
  const enginePrompt=`${contract}\n\nRESEARCH / ARTICLE BRIEF:\n${prompt}\n\nFINAL INSTRUCTION:\nWrite a complete, useful article supported by the supplied evidence. Target 650-850 words when the evidence supports it; 450 words is the publishable floor. Use 3-6 useful H2 sections. Never pad, repeat, or invent material. If evidence is insufficient for a complete article, return empty title, description and content rather than inventing material. The requested story title is the hard topic boundary: do not switch to another story merely because it shares a broad category or keyword. For every material factual claim, use the supplied research evidence and preserve attribution/uncertainty. Do not add background facts unless they are explicitly supported by the supplied evidence. Generate a JSON object with exactly the fields title, description and content. Keep the JSON valid and compact.`;
  const requested=requestedTitle(prompt);
  for(const provider of available){if(!process.env[keyFor(provider)])continue;const started=Date.now();try{const text=await request(provider,enginePrompt);if(!text.trim()){mark(provider,200,'Empty model response');console.log(`TrendForge Writer Engine: ${provider} returned an empty response after ${Date.now()-started}ms; trying next provider.`);continue;}const draft=parseWriterJson(text);if(!draft||typeof draft.title!=='string'||typeof draft.description!=='string'||typeof draft.content!=='string'){mark(provider,200,'Invalid structured output');console.log(`TrendForge Writer Engine: ${provider} returned invalid structured output after ${Date.now()-started}ms; trying next provider.`);continue;}const alignment=topicAlignment(requested,draft);if(requested&&!alignment.passed){console.log(`TrendForge Writer Engine: ${provider} output rejected for topic drift after ${Date.now()-started}ms — requested topic overlap ${alignment.score}; title overlap ${alignment.titleShared.join(', ')||'none'}.`);mark(provider,200,'Topic drift');continue;}const validation=validateDraft({title:draft.title,description:draft.description,content:draft.content,category:inferred});if(!validation.passed){console.log(`TrendForge Writer Engine: ${provider} output rejected before publication after ${Date.now()-started}ms — ${validation.errors.join('; ')}.`);continue;}if(validation.metrics.words<700)console.log(`TrendForge Writer Engine: ${provider} produced a valid short-form draft (${validation.metrics.words} words); downstream gates remain mandatory.`);else console.log(`TrendForge Writer Engine: ${provider} produced ${validation.metrics.words} words.`);markSuccess(provider);return{text:JSON.stringify(draft),provider,policyVersion:'1.7',topicAlignment:alignment};}catch(e){const message=e instanceof Error?e.message:String(e);const status=Number(message.match(/^(\d+)/)?.[1]||0);mark(provider,status,message);console.log(`TrendForge Writer Engine: ${provider} failed after ${Date.now()-started}ms [${status||'network'}] — ${message.slice(0,260)}; trying next provider.`);}}
  throw new Error('TrendForge Writer Engine: no provider produced a policy-valid article.');
}
