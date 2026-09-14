import { available, mark } from './ai-provider-router.mjs';
import { buildWriterContract, validateDraft } from './trendforge-editorial-policy.mjs';

const request=async(provider,prompt)=>{
  if(provider==='Groq'){
    const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${process.env.GROQ_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.GROQ_MODEL||'openai/gpt-oss-20b',max_completion_tokens:4000,response_format:{type:'json_object'},messages:[{role:'system',content:'You are the TrendForge Writer Engine. The editorial policy in the prompt is mandatory. Follow the supplied research only. Produce original, factual, useful journalism. Never fabricate facts.'},{role:'user',content:prompt}]})});
    if(!r.ok)throw new Error(`${r.status}: ${(await r.text()).slice(0,500)}`); const j=await r.json(); return j.choices?.[0]?.message?.content||'';
  }
  if(provider==='Gemini'){
    const model=process.env.GEMINI_MODEL||'gemini-3.6-flash';
    const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',headers:{'x-goog-api-key':process.env.GEMINI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:5000}})});
    if(!r.ok)throw new Error(`${r.status}: ${(await r.text()).slice(0,500)}`); const j=await r.json(); return j.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
  }
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.6-luna',input:prompt})});
  if(!r.ok)throw new Error(`${r.status}: ${(await r.text()).slice(0,500)}`); const j=await r.json(); return j.output_text||j.output?.flatMap(x=>x.content||[]).filter(x=>x.type==='output_text'&&x.text).map(x=>x.text).join('')||'';
};

const parseWriterJson=(text='')=>{
  try{
    const parsed=JSON.parse(text);
    return parsed&&typeof parsed==='object' ? parsed : null;
  }catch{
    const match=text.match(/\{[\s\S]*\}/);
    try{return match?JSON.parse(match[0]):null;}catch{return null;}
  }
};

export async function generateWithTrendForgeWriter({prompt,category='Technology'}){
  const inferred=category&&category!=='Technology'?category:prompt.match(/(?:category|section)\s*[:=]\s*(AI|Technology|How-To|Innovation|Product Launches|Digital Life|Crypto)/i)?.[1]||category;
  const contract=buildWriterContract(inferred);
  const enginePrompt=`${contract}\n\nRESEARCH / ARTICLE BRIEF:\n${prompt}\n\nFINAL INSTRUCTION:\nWrite a complete, useful article supported by the supplied evidence. Target 850-1100 words and normally 4-6 useful H2 sections. The article MUST contain at least 700 words unless the evidence is genuinely insufficient; never pad with repetition. If evidence is insufficient, return empty title, description and content rather than inventing material.`;
  for(const provider of available){
    const key=provider==='Groq'?'GROQ_API_KEY':provider==='Gemini'?'GEMINI_API_KEY':'OPENAI_API_KEY';
    if(!process.env[key])continue;
    try{
      const text=await request(provider,enginePrompt);
      if(!text.trim()){mark(provider,200,'Empty model response');continue;}
      const draft=parseWriterJson(text);
      if(!draft||typeof draft.title!=='string'||typeof draft.description!=='string'||typeof draft.content!=='string'){
        console.log(`TrendForge Writer Engine: ${provider} returned invalid structured output; trying next provider.`);
        continue;
      }
      const validation=validateDraft({title:draft.title,description:draft.description,content:draft.content,category:inferred});
      if(!validation.passed){
        console.log(`TrendForge Writer Engine: ${provider} output rejected before publication — ${validation.errors.join('; ')}.`);
        continue;
      }
      console.log(`TrendForge Writer Engine provider: ${provider}`);
      return{text:JSON.stringify(draft),provider,policyVersion:'1.0'};
    }catch(e){const message=e instanceof Error?e.message:String(e);const status=Number(message.match(/^(\d+)/)?.[1]||0);mark(provider,status,message);console.log(`TrendForge Writer Engine: ${provider} failed; trying next provider.`);}
  }
  throw new Error('TrendForge Writer Engine: no provider produced a policy-valid article.');
}
