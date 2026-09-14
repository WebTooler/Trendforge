import { available, mark } from './ai-provider-router.mjs';

const profiles={AI:'Lead with the concrete development, explain the technology and its implications, separate evidence from interpretation, and avoid hype.',Technology:'Explain the product or technical change in plain language, focusing on practical impact, limitations, and what changes for readers.','How-To':'Use a task-first structure with clear steps, prerequisites, safety notes, and a short verification/check section. Do not invent UI labels or device-specific behavior.',Innovation:'Explain the problem, the new approach, evidence of progress, limitations, and what would need to happen next.','Product Launches':'Explain what launched, availability, notable capabilities, pricing or access only when sourced, and meaningful alternatives or limitations.','Digital Life':'Prioritize practical reader value, privacy/security implications, compatibility caveats, and actionable takeaways.',Crypto:'Separate confirmed facts from market interpretation. Never invent prices, partnerships, token utility, or forecasts; clearly label uncertainty.'};

const request=async(provider,prompt)=>{
  if(provider==='Groq'){
    const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${process.env.GROQ_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.GROQ_MODEL||'openai/gpt-oss-20b',max_completion_tokens:3000,response_format:{type:'json_object'},messages:[{role:'system',content:'You are the TrendForge Writer Engine. Follow the supplied research only. Produce original, factual, useful journalism. Never fabricate facts.'},{role:'user',content:prompt}]})});
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

export async function generateWithTrendForgeWriter({prompt,category}){
  const inferred=category||prompt.match(/(?:category|section)\s*[:=]\s*([A-Za-z][A-Za-z -]{2,40})/i)?.[1]?.trim()||'Technology';
  const style=profiles[inferred]||profiles.Technology;
  const enginePrompt=`TRENDFORGE WRITER ENGINE\nCategory: ${inferred}\nEditorial profile: ${style}\n\nWriter contract:\n- Use the supplied sources/research as the factual boundary.\n- Distinguish sourced facts, reasonable synthesis, and uncertainty.\n- Do not invent quotes, statistics, dates, product capabilities, prices, or events.\n- Do not copy source wording or headlines.\n- Prefer specific, natural sentences over generic AI filler.\n- Make every section add reader value.\n- Return ONLY valid JSON with exactly: title, description, content.\n\n${prompt}`;
  for(const provider of available){
    const key=provider==='Groq'?'GROQ_API_KEY':provider==='Gemini'?'GEMINI_API_KEY':'OPENAI_API_KEY';
    if(!process.env[key])continue;
    try{const text=await request(provider,enginePrompt);if(text.trim()){console.log(`TrendForge Writer Engine provider: ${provider}`);return{text,provider};}mark(provider,200,'Empty model response');}
    catch(e){const message=e instanceof Error?e.message:String(e);console.log(`TrendForge Writer Engine: ${provider} failed; router recorded ${message}.`);const status=Number(message.match(/^(\d+)/)?.[1]||0);mark(provider,status,message);}
  }
  throw new Error('TrendForge Writer Engine: no available AI provider.');
}
