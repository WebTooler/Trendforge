import fs from 'node:fs';
import { validateAuthoritativeEvidencePack } from './authoritative-evidence-pack.mjs';

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
    if(!passage||!canonicalPassages.some(p=>p===passage)) throw new Error(`Failed claim ${index+1} uses evidence outside the canonical passage set.`);
    return {...claim,bestUrl:source.url,bestSource:source.title||source.domain||source.url,bestPassage:passage};
  });
  return {pack,claims:canonicalClaims,sources:[...byUrl.values()]};
}
