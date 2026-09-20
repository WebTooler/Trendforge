const clean=(s='')=>String(s).replace(/\s+/g,' ').trim();

export function buildAuthoritativeEvidencePack({candidate={},sources=[],coverage={},blueprint={},generatedAt=new Date().toISOString()}={}){
  const normalizedSources=sources.map((source,index)=>({
    id:`S${index+1}`,url:source.url||'',finalUrl:source.url||'',domain:source.domain||'',
    publisherFamily:source.publisherFamily||'',title:clean(source.title||candidate.title||''),
    verified:source.verified!==false,primary:source.primary===true,
    credibilityTier:source.credibilityTier||'unknown',
    lineage:source.lineage||{id:`lineage-unknown-${index+1}`,type:'unknown',members:1},
    passages:Array.isArray(source.passages)?source.passages.map(clean).filter(Boolean):[],
    body:clean(source.body||''),extraction:source.extraction||null
  }));
  return {version:1,status:'authoritative',generatedAt,
    candidate:{title:candidate.title||'',link:candidate.link||'',category:candidate.category||''},
    policy:'Single canonical evidence pack for downstream writer, claim-verification and editorial stages. Downstream stages must not silently replace or expand factual evidence outside this pack.',
    sources:normalizedSources,coverage,blueprint};
}

export function validateAuthoritativeEvidencePack(pack){
  if(!pack||pack.version!==1||pack.status!=='authoritative')return false;
  if(!pack.candidate?.link||!Array.isArray(pack.sources)||!pack.coverage||!pack.blueprint)return false;
  return pack.sources.every(source=>typeof source.id==='string'&&/^S\d+$/.test(source.id)&&typeof source.url==='string'&&source.url.length>0&&typeof source.publisherFamily==='string'&&Array.isArray(source.passages)&&source.passages.length>0&&source.lineage&&typeof source.lineage.id==='string');
}
