import fs from 'node:fs';
const path='scripts/generate-article-adaptive.mjs';
const text=fs.readFileSync(path,'utf8');
if(text.includes('Evergreen fallback published without AI provider')) throw new Error('Evergreen publication bypass still present');
if(text.includes('const evergreenFallbacks=')) throw new Error('Synthetic evergreen fallback data still present');
if(!text.includes('no evergreen or synthetic fallback publication is allowed')) throw new Error('Fail-closed fallback guard missing');
console.log('Phase 3 adaptive publication bypass test passed.');
