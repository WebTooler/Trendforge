import fs from 'node:fs';
import { validateAuthoritativeEvidencePack } from './authoritative-evidence-pack.mjs';

const normalizeEvidence=value=>String(value||'').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/\s+/g,' ').trim();

export function loadCanonicalRepairEvidence({briefTitle, failedClaims, path='data/authoritative-evidence-pack.json'}={}){
  if(!briefTitle) throw new Error('Canonical repair evidence requires the current brief title.');
  if(!fs.existsSync(path)) throw new Error('Authoritative Evidence Pack missing; grounding repair blocked.');
  let root;
  try{root=JSON.parse(fs.readFileSync(path,'utf8'));}catch{throw new Error('Authoritative Evidence Pack is unreadable; grounding repair blocked.');}
  const packs=Array.isArray(root?.candidates)?root.candidates:[];
  const pack=packs.find(item=>item?.candidate?.title===briefTitle);
  if(!pack||!validateAuthoritativeEvidencePack(pack)) throw new Error('Authoritative Evidence Pack is missing or invalid for grounding repair.');
  const byUrl=new Map(pack.sources.map(source=>[source.url,source]));
  const claims=Array.isArray(failedClaims)?failedClaims:[];
  const canonicalClaims=claims.map((claim,index)=>{
    const url=String(claim?.bestUrl||claim?.url||'').trim();
    if(!url) throw new Error(`Failed claim ${index+1} has no canonical evidence URL.`);
    const source=byUrl.get(url);
    if(!source) throw new Error(`Failed claim ${index+1} references non-canonical evidence URL: ${url}`);
    const passage=String(claim?.bestPassage||claim?.evidence||'').trim();
    const canonicalPassages=Array.isArray(source.passages)?source.passages:[];
    const passageId=String(claim?.bestPassageId||'').trim();
    let canonicalMatch='';
    if(/^S\d+-P\d+$/i.test(passageId)){
      const idMatch=passageId.match(/^S(\d+)-P(\d+)$/i);
      const expectedSourceId=`S${Number(idMatch?.[1]||0)}`;
      const passageIndex=Number(idMatch?.[2]||0)-1;
      const claimSourceId=String(claim?.sourceId||'').trim().toUpperCase();
      // The URL has already resolved to this canonical source. Therefore a valid
      // passage ID is authoritative even when the verifier omitted sourceId.
      if(expectedSourceId===String(source.id||'').toUpperCase() &&
         (!claimSourceId||claimSourceId===expectedSourceId) &&
         Number.isInteger(passageIndex)&&passageIndex>=0){
        canonicalMatch=canonicalPassages[passageIndex]||'';
      }
    }else if(/^S\d+-BODY$/i.test(passageId)){
      const idMatch=passageId.match(/^S(\d+)-BODY$/i);
      const expectedSourceId=`S${Number(idMatch?.[1]||0)}`;
      const claimSourceId=String(claim?.sourceId||'').trim().toUpperCase();
      if(expectedSourceId===String(source.id||'').toUpperCase() &&
         (!claimSourceId||claimSourceId===expectedSourceId)){
        // The strict verifier can select the canonical publisher article body
        // when it is more semantically relevant than an extracted passage.
        canonicalMatch=String(source.body||'').trim();
      }
    }
    if(!canonicalMatch){
      canonicalMatch=canonicalPassages.find(p=>normalizeEvidence(p)===normalizeEvidence(passage))||'';
    }
    if(!passage||!canonicalMatch) throw new Error(`Failed claim ${index+1} uses evidence outside the canonical passage set.`);
    return {...claim,bestUrl:source.url,bestSource:source.title||source.domain||source.url,bestPassage:canonicalMatch};
  });
  return {pack,claims:canonicalClaims,sources:[...byUrl.values()]};
}
