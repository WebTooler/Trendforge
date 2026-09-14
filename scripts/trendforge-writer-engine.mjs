import { available, mark } from './ai-provider-router.mjs';
import { buildWriterContract } from './trendforge-editorial-policy.mjs';

const request=async(provider,prompt)=>{
  if(provider==='Groq'){
    const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${process.env.GROQ_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.GROQ_MODEL||'openai/gpt-oss-20b',max_completion_tokens:4000,response_format:{type:'json_object'},messages:[{role:'system',content:'You are the TrendForge Writer Engine. The editorial policy in the prompt is mandatory. Follow the supplied research only. Produce original, factual, useful journalism. Never fabricate facts.'},{role:'user',content:prompt}]})});
    if(!r.ok)throw new Error(`${r.status}: ${(await r.text()).slice(0,500)}`); const j=await r.json(); return j.choices?.[0]?.message?.content||'';
  }
  if(provider==='Gemini'){
    const model=process.env.GEMINI_MODEL||'gemini-3.6-flash';
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'x-goog-api-key':process.env.GEMINI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json'}})});
    if(!r.ok)throw new Error(`${r.status}: ${(await r.text()).slice(0,500)}`); const j=await r.json(); return j.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
  }
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.6-luna',input:prompt})});
  if(!r.ok)throw new Error(`${r.status}: ${(await r.text()).slice(0,500)}`); const j=await r.json(); return j.output_text||j.output?.flatMap(x=>x.content||[]).filter(x=>x.type==='output_text'&&x.text).map(x=>x.text).join('')||'';
};

export async function generateWithTrendForgeWriter({prompt,category='Technology'}){
  const inferred=category&&category!=='Technology'?category:prompt.match(/(?:category|section)\s*[:=]\s*(AI|Technology|How-To|Innovation|Product Launches|Digital Life|Crypto)/i)?.[1]||category;
  const contract=buildWriterContract(inferred);
  const enginePrompt=`${contract}\n\nRESEARCH / ARTICLE BRIEF:\n${prompt}\n\nFINAL INSTRUCTION:\nWrite the strongest useful article supported by the supplied evidence. Do not pad to hit a word count. If the evidence cannot support a complete article, return empty title, description and content rather than inventing material.`;
  for(const provider of available){
    const key=provider==='Groq'?'GROQ_API_KEY':provider==='Gemini'?'GEMINI_API_KEY':'OPENAI_API_KEY';
    if(!process.env[key])continue;
    try{
      const text=await request(provider,enginePrompt);
      if(text.trim()){console.log(`TrendForge Writer Engine provider: ${provider}`);return{text,provider,policyVersion:'1.0'};}
      mark(provider,200,'Empty model response');
    }catch(e){const message=e instanceof Error?e.message:String(e);const status=Number(message.match(/^(\d+)/)?.[1]||0);mark(provider,status,message);console.log(`TrendForge Writer Engine: ${provider} failed; trying next provider.`);}
  }
  throw new Error('TrendForge Writer Engine: no available AI provider.');
}
