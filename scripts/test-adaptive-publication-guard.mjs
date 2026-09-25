import fs from 'node:fs';
const path='scripts/generate-article-adaptive.mjs';
const text=fs.readFileSync(path,'utf8');
if(text.includes('Evergreen fallback published without AI provider')) throw new Error('Evergreen publication bypass still present');
if(text.includes('const evergreenFallbacks=')) throw new Error('Synthetic evergreen fallback data still present');
if(!text.includes('no evergreen or synthetic fallback publication is allowed')) throw new Error('Fail-closed fallback guard missing');
console.log('Phase 3 adaptive publication bypass test passed.');

const writerSource=fs.readFileSync('scripts/generate-article.ts','utf8');
if(!writerSource.includes('TRENDFORGE_WRITER_CANDIDATE_LINK')) throw new Error('Adaptive writer candidate link handoff missing');
if(!writerSource.includes('requestedCandidate=requestedLink?eligible.find(candidate=>candidate.link===requestedLink):null')) throw new Error('Writer must honor the exact adaptive candidate link');
if(!text.includes('TRENDFORGE_WRITER_CANDIDATE_LINK:String(candidate.link)')) throw new Error('Adaptive queue must pass the selected candidate link to the writer');
console.log('Adaptive candidate -> authoritative evidence-pack handoff guard passed.');
